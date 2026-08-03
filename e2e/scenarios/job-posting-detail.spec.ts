import { expect, test } from "../support/fixtures";
import { openJobPostingList } from "../support/steps";

/**
 * 라우트 `/job_posting/:site/:postingId` — 공고 상세.
 *
 * **어느 공고를 열지는 목록이 알려준다** — 명세가 특정 공고의 좌표를 알지 않는다.
 * 데이터 전제(리뷰가 달린 공고가 있는가 등)는 `test.skip`으로 명시해 실패와 구분한다.
 */

test("목록에서 공고를 열면 그 공고의 상세가 나온다", async ({ app }) => {
  const postings = await openJobPostingList(app);
  const [first] = postings;
  expect(first?.title, "목록의 첫 공고에 제목이 있다").toBeTruthy();
  expect(first?.companyName, "목록의 첫 공고에 회사명이 있다").toBeTruthy();

  await app.jobPostingList.openListed(0);

  await expect
    .poll(() => app.currentRoute(), { message: "공고 상세 라우트로 들어간다" })
    .toBe("jobPostingDetail");

  await expect
    .poll(() => app.jobPostingDetail.title(), {
      message: "목록에서 고른 그 공고의 상세다",
    })
    .toBe(first?.title);

  expect(
    await app.jobPostingDetail.companyName(),
    "상세가 말하는 회사가 목록에서 본 회사와 같다",
  ).toBe(first?.companyName);
});

test("리뷰가 달린 회사의 공고 상세에는 리뷰가 나열된다", async ({ app }) => {
  const postings = await openJobPostingList(app);
  const index = postings.findIndex((posting) => posting.reviewCount > 0);
  test.skip(index < 0, "전제 미충족: 목록에 리뷰가 달린 공고가 없다");

  await app.jobPostingList.openListed(index);
  await expect.poll(() => app.currentRoute()).toBe("jobPostingDetail");

  await expect
    .poll(() => app.jobPostingDetail.reviewCountInSummary(), {
      message: "회사 리뷰 요약이 나온다",
    })
    .toBeGreaterThan(0);

  const summarised = await app.jobPostingDetail.reviewCountInSummary();
  const listed = await app.jobPostingDetail.listedReviewSummaries();

  expect(listed.length, "리뷰가 실제로 나열된다").toBeGreaterThan(0);
  expect(
    listed.length,
    "한 화면에 나열되는 리뷰는 요약이 말하는 전체 수를 넘지 않는다",
  ).toBeLessThanOrEqual(summarised);
});

test("리뷰의 다음 페이지는 다른 리뷰를 준다", async ({ app }) => {
  const postings = await openJobPostingList(app);
  // 리뷰가 가장 많은 공고를 고른다 — 페이지가 나뉠 가능성이 가장 큰 곳이다.
  const index = postings.reduce(
    (best, posting, current) =>
      posting.reviewCount > (postings[best]?.reviewCount ?? 0) ? current : best,
    0,
  );
  test.skip(
    (postings[index]?.reviewCount ?? 0) === 0,
    "전제 미충족: 목록에 리뷰가 달린 공고가 없다",
  );

  await app.jobPostingList.openListed(index);
  await expect.poll(() => app.currentRoute()).toBe("jobPostingDetail");

  // 한 페이지에 리뷰를 몇 개 보이는지는 앱이 정한다 — 몇 페이지인지도 앱에게 묻는다.
  test.skip(
    (await app.jobPostingDetail.reviewPageCount()) < 2,
    "전제 미충족: 리뷰가 두 페이지 이상인 공고가 없다",
  );

  const firstPage = await app.jobPostingDetail.listedReviewSummaries();

  await app.jobPostingDetail.goToReviewPage(2);

  await expect
    .poll(() => app.jobPostingDetail.listedReviewSummaries(), {
      message: "리뷰 2페이지는 1페이지와 다른 항목을 준다",
    })
    .not.toEqual(firstPage);

  const secondPage = await app.jobPostingDetail.listedReviewSummaries();
  expect(secondPage.length, "리뷰 2페이지도 비어 있지 않다").toBeGreaterThan(0);
});
