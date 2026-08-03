import { expect, test } from "../support/fixtures";

/**
 * 라우트 `/job_posting/:site/:postingId` — 공고 상세.
 *
 * 어느 공고를 여는지는 목록에서 얻거나 전제 검사가 발견해 준다 — 명세가 특정 공고를 알지 않는다.
 */

test("목록에서 공고를 열면 그 공고의 상세가 나온다", async ({ app }) => {
  await app.visit("jobPostings");
  await expect
    .poll(async () => (await app.jobPostingList.listedTitles()).length)
    .toBeGreaterThan(0);

  const [firstTitle] = await app.jobPostingList.listedTitles();
  expect(firstTitle, "목록의 첫 공고에 제목이 있다").toBeTruthy();

  await app.jobPostingList.openFirstListed();

  await expect
    .poll(() => app.currentRoute(), { message: "공고 상세 라우트로 들어간다" })
    .toBe("jobPostingDetail");

  await expect
    .poll(() => app.jobPostingDetail.title(), {
      message: "목록에서 고른 그 공고의 상세다",
    })
    .toBe(firstTitle);
});

test("리뷰가 달린 회사의 공고 상세에는 리뷰가 나열된다", async ({
  app,
  data,
}) => {
  await app.visitJobPosting(data.postingWithReviews);

  await expect.poll(() => app.currentRoute()).toBe("jobPostingDetail");

  await expect
    .poll(() => app.jobPostingDetail.reviewCountInSummary(), {
      message: "회사 리뷰 요약이 나온다",
    })
    .toBeGreaterThan(0);

  const summarised = await app.jobPostingDetail.reviewCountInSummary();
  const listed = await app.jobPostingDetail.listedReviewCount();

  expect(listed, "리뷰가 실제로 나열된다").toBeGreaterThan(0);
  expect(
    listed,
    "한 화면에 나열되는 리뷰는 요약이 말하는 전체 수를 넘지 않는다",
  ).toBeLessThanOrEqual(summarised);
});
