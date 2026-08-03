import { expect, test } from "../support/fixtures";

/**
 * 라우트 `/job_posting` — 공고 목록(검색·필터·페이지네이션).
 *
 * 어서션은 불변식만 쓴다 — 결정적 데이터가 없으므로 건수·제목 같은 우연한 사실에 결합할 수 없다.
 * 검색어는 전제 검사가 실데이터에서 발견해 넘겨준 것이다.
 */

test("공고 목록에 공고가 나열된다", async ({ app }) => {
  await app.visit("jobPostings");

  await expect
    .poll(async () => (await app.jobPostingList.listedTitles()).length, {
      message: "목록에 공고가 하나 이상 나열된다",
    })
    .toBeGreaterThan(0);
});

test("검색하면 결과가 좁혀지고, 검색을 풀면 되돌아온다", async ({
  app,
  data,
}) => {
  await app.visit("jobPostings");
  await expect
    .poll(async () => (await app.jobPostingList.listedTitles()).length)
    .toBeGreaterThan(0);

  const pagesBeforeSearch = await app.jobPostingList.totalPages();

  await app.jobPostingList.searchBySkill(data.searchableSkill);

  await expect
    .poll(async () => (await app.jobPostingList.listedTitles()).length, {
      message: "검색 결과가 비어 있지 않다",
    })
    .toBeGreaterThan(0);

  const pagesAfterSearch = await app.jobPostingList.totalPages();
  expect(
    pagesAfterSearch,
    "검색은 결과를 좁힌다 — 넓히지 않는다",
  ).toBeLessThanOrEqual(pagesBeforeSearch);

  await app.jobPostingList.clearSearch();

  await expect
    .poll(() => app.jobPostingList.totalPages(), {
      message: "검색을 풀면 좁히기 전의 결과로 돌아온다",
    })
    .toBe(pagesBeforeSearch);
});

test("다음 페이지는 다른 공고를 준다", async ({ app }) => {
  await app.visit("jobPostings");
  await expect
    .poll(async () => (await app.jobPostingList.listedTitles()).length)
    .toBeGreaterThan(0);

  const firstPage = await app.jobPostingList.listedTitles();

  await app.jobPostingList.goToPage(2);

  await expect
    .poll(() => app.jobPostingList.listedTitles(), {
      message: "2페이지는 1페이지와 다른 항목을 준다",
    })
    .not.toEqual(firstPage);

  const secondPage = await app.jobPostingList.listedTitles();
  expect(secondPage.length, "2페이지도 비어 있지 않다").toBeGreaterThan(0);
});
