import { expect, test } from "../support/fixtures";
import type { JobPostingListScreen } from "../support/driver";
import { openJobPostingList } from "../support/steps";

/**
 * 라우트 `/job_posting` — 공고 목록(검색·필터·페이지네이션).
 *
 * 어서션은 불변식만 쓴다 — 결정적 데이터가 없으므로 건수·제목 같은 우연한 사실에 결합할 수 없다.
 * **여정에 필요한 값은 화면이 알려준다** — 목록에 나온 공고가 달고 있는 기술스택·회사·경력으로
 * 검색한다. 사용자가 하는 일이 그것이고, 그러면 명세가 특정 값을 알 필요가 없다.
 *
 * 데이터 전제는 `test.skip`으로 명시한다 — 전제가 안 갖춰지면 **건너뛴 것으로 보고**되므로
 * 앱 회귀(빨간 실패)와 같은 신호가 되지 않는다.
 */

/** 좁히는 조건은 축마다 다르지만 여정은 하나다 — 걸면 좁아지고, 풀면 되돌아온다. */
async function expectNarrowsAndRestores(
  list: JobPostingListScreen,
  narrow: () => Promise<void>,
) {
  const pagesBefore = await list.totalPages();

  await narrow();

  await expect
    .poll(async () => (await list.listedJobPostings()).length, {
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
  const postings = await openJobPostingList(app);

  expect(postings[0]?.title, "나열된 공고는 제목을 말한다").toBeTruthy();
  expect(postings[0]?.companyName, "나열된 공고는 회사를 말한다").toBeTruthy();
});

test("목록에서 본 기술스택으로 검색하면 결과가 좁혀지고, 풀면 되돌아온다", async ({
  app,
}) => {
  const postings = await openJobPostingList(app);
  const skill = postings.flatMap((posting) => posting.skills)[0];
  test.skip(!skill, "전제 미충족: 목록의 공고가 기술스택을 말하지 않는다");

  await expectNarrowsAndRestores(app.jobPostingList, () =>
    app.jobPostingList.searchBySkill(skill as string),
  );
});

test("목록에서 본 회사로 찾으면 결과가 좁혀지고, 풀면 되돌아온다", async ({
  app,
}) => {
  const postings = await openJobPostingList(app);
  const company = postings[0]?.companyName;
  test.skip(!company, "전제 미충족: 목록의 공고가 회사를 말하지 않는다");

  await expectNarrowsAndRestores(app.jobPostingList, () =>
    app.jobPostingList.searchByCompany(company as string),
  );
});

test("목록에서 본 경력 조건으로 거르면 결과가 좁혀지고, 풀면 되돌아온다", async ({
  app,
}) => {
  const postings = await openJobPostingList(app);
  const years = postings
    .map((posting) => posting.minCareer)
    .find((value): value is number => value !== null && value > 0);
  test.skip(
    years === undefined,
    "전제 미충족: 목록에 경력을 요구하는 공고가 없다",
  );

  await expectNarrowsAndRestores(app.jobPostingList, () =>
    app.jobPostingList.filterByMinCareer(years as number),
  );
});

test("다음 페이지는 다른 공고를 준다", async ({ app }) => {
  await openJobPostingList(app);
  test.skip(
    (await app.jobPostingList.totalPages()) < 2,
    "전제 미충족: 목록이 한 페이지뿐이다",
  );

  const firstPage = await app.jobPostingList.listedJobPostings();

  await app.jobPostingList.goToPage(2);

  await expect
    .poll(() => app.jobPostingList.listedJobPostings(), {
      message: "2페이지는 1페이지와 다른 항목을 준다",
    })
    .not.toEqual(firstPage);

  const secondPage = await app.jobPostingList.listedJobPostings();
  expect(secondPage.length, "2페이지도 비어 있지 않다").toBeGreaterThan(0);
});
