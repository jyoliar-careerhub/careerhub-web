import { expect, test } from "../support/fixtures";
import type { JobPostingListScreen } from "../support/driver";

/**
 * 라우트 `/job_posting` — 공고 목록(검색·필터·페이지네이션).
 *
 * 어서션은 불변식만 쓴다 — 결정적 데이터가 없으므로 건수·제목 같은 우연한 사실에 결합할 수 없다.
 * 검색어·경력 값은 전제 검사가 실데이터에서 발견해 넘겨준 것이다.
 */

/** 좁히는 조건은 축마다 다르지만 여정은 하나다 — 걸면 좁아지고, 풀면 되돌아온다. */
async function expectNarrowsAndRestores(
  list: JobPostingListScreen,
  narrow: () => Promise<void>,
) {
  await expect
    .poll(async () => (await list.listedTitles()).length)
    .toBeGreaterThan(0);
  const pagesBefore = await list.totalPages();

  await narrow();

  await expect
    .poll(async () => (await list.listedTitles()).length, {
      message: "좁힌 결과가 비어 있지 않다",
    })
    .toBeGreaterThan(0);
  expect(
    await list.totalPages(),
    "조건을 걸면 결과가 좁아진다 — 넓어지지 않는다",
  ).toBeLessThanOrEqual(pagesBefore);

  await list.clearFilters();

  await expect
    .poll(() => list.totalPages(), {
      message: "조건을 풀면 좁히기 전의 결과로 돌아온다",
    })
    .toBe(pagesBefore);
}

test("공고 목록에 공고가 나열된다", async ({ app }) => {
  await app.visit("jobPostings");

  await expect
    .poll(async () => (await app.jobPostingList.listedTitles()).length, {
      message: "목록에 공고가 하나 이상 나열된다",
    })
    .toBeGreaterThan(0);
});

test("기술스택으로 검색하면 결과가 좁혀지고, 풀면 되돌아온다", async ({
  app,
  data,
}) => {
  await app.visit("jobPostings");

  await expectNarrowsAndRestores(app.jobPostingList, () =>
    app.jobPostingList.searchBySkill(data.searchableSkill),
  );
});

test("회사 이름으로 찾으면 결과가 좁혀지고, 풀면 되돌아온다", async ({
  app,
  data,
}) => {
  await app.visit("jobPostings");

  await expectNarrowsAndRestores(app.jobPostingList, () =>
    app.jobPostingList.searchByCompany(data.searchableCompany),
  );
});

test("경력 조건으로 거르면 결과가 좁혀지고, 풀면 되돌아온다", async ({
  app,
  data,
}) => {
  await app.visit("jobPostings");

  await expectNarrowsAndRestores(app.jobPostingList, () =>
    app.jobPostingList.filterByMinCareer(data.filterableMinCareer),
  );
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
