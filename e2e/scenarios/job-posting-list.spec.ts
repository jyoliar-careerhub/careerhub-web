import { expect, test } from "../support/fixtures";
import type {
  ConditionSearch,
  JobPostingListScreen,
  ListedJobPosting,
} from "../support/driver";
import {
  offerCandidates,
  openJobPostingList,
  searchAndChoose,
} from "../support/steps";

/**
 * 라우트 `/job_posting` — 공고 목록(검색·필터·페이지네이션).
 *
 * 어서션은 불변식만 쓴다 — 결정적 데이터가 없으므로 건수·제목 같은 우연한 사실에 결합할 수 없다.
 * **여정에 필요한 값은 화면이 알려준다** — 목록에 나온 공고가 달고 있는 기술스택·회사·직군·경력으로
 * 검색한다. 사용자가 하는 일이 그것이고, 그러면 명세가 특정 값을 알 필요가 없다.
 *
 * 조건을 거는 일은 두 단계다 — **검색어를 넣어 후보를 보고, 골라서 건다.** 이 둘을 갈라 명세하는
 * 이유는 갈라져 있어야 하는 흐름이기 때문이다: 넣기만 한 것으로 결과가 바뀌면 사용자는 아직
 * 고르지도 않은 조건에 걸린 화면을 보게 된다.
 *
 * 데이터 전제는 `test.skip`으로 명시한다 — 전제가 안 갖춰지면 **건너뛴 것으로 보고**되므로
 * 앱 회귀(빨간 실패)와 같은 신호가 되지 않는다.
 */

/** 검색으로 후보를 받아 거는 조건 축들. 흐름이 같으므로 시나리오도 한 벌이면 된다. */
interface SearchableAxis {
  name: string;
  search: (list: JobPostingListScreen) => ConditionSearch;
  /** 이 축의 검색어를 목록에서 얻는다 — 명세는 검색어를 알지 못한다. */
  keywordFrom: (postings: ListedJobPosting[]) => string | undefined;
  absent: string;
}

const SEARCHABLE_AXES: SearchableAxis[] = [
  {
    name: "기술스택",
    search: (list) => list.skillSearch,
    keywordFrom: (postings) => postings.flatMap((posting) => posting.skills)[0],
    absent: "전제 미충족: 목록의 공고가 기술스택을 말하지 않는다",
  },
  {
    name: "회사",
    search: (list) => list.companySearch,
    keywordFrom: (postings) => postings[0]?.companyName,
    absent: "전제 미충족: 목록의 공고가 회사를 말하지 않는다",
  },
];

/**
 * 아무 회사에도 걸리지 않도록 고른 검색어.
 *
 * 데이터의 사실을 어서션하는 값이 아니라 **입력**이다 — "찾은 것이 없을 때 앱이 무엇을 하는가"를
 * 물으려면 찾히지 않을 것을 넣어야 한다. 언젠가 이런 이름의 회사가 생기면 이 값을 바꾼다.
 */
const UNMATCHABLE_KEYWORD = "찾아도없을회사이름zzqq";

/** 좁히는 조건은 축마다 다르지만 여정은 하나다 — 걸면 드러나고 좁아지고, 풀면 되돌아온다. */
async function expectNarrowsAndRestores(
  list: JobPostingListScreen,
  narrow: () => Promise<void>,
) {
  const pagesBefore = await list.totalPages();

  await narrow();

  await expect
    .poll(async () => (await list.appliedConditions()).length, {
      message: "건 조건이 화면에 드러난다",
    })
    .toBeGreaterThan(0);
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
    .poll(() => list.appliedConditions(), {
      message: "조건을 풀면 걸린 것이 남지 않는다",
    })
    .toEqual([]);
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

for (const axis of SEARCHABLE_AXES) {
  test(`${axis.name} 검색어를 넣으면 고를 후보가 제시된다 — 고르기 전에는 아직 걸리지 않는다`, async ({
    app,
  }) => {
    const list = app.jobPostingList;
    const postings = await openJobPostingList(app);
    const keyword = axis.keywordFrom(postings);
    test.skip(!keyword, axis.absent);

    const pagesBefore = await list.totalPages();

    const candidates = await offerCandidates(
      axis.search(list),
      keyword as string,
    );

    expect(
      candidates.every((candidate) => candidate.trim().length > 0),
      "제시된 후보는 무엇인지 이름으로 말한다 — 고를 수 있어야 하므로",
    ).toBe(true);
    expect(
      await list.appliedConditions(),
      "검색어를 넣은 것만으로는 조건이 걸리지 않는다",
    ).toEqual([]);
    expect(
      await list.totalPages(),
      "고르기 전에는 결과도 그대로다",
    ).toBe(pagesBefore);
  });

  test(`${axis.name} 후보를 고르면 조건으로 걸려 결과가 좁혀진다 — 풀면 되돌아온다`, async ({
    app,
  }) => {
    const list = app.jobPostingList;
    const postings = await openJobPostingList(app);
    const keyword = axis.keywordFrom(postings);
    test.skip(!keyword, axis.absent);

    await expectNarrowsAndRestores(list, async () => {
      await searchAndChoose(axis.search(list), keyword as string);
    });
  });
}

test("찾는 회사가 없으면 후보가 비고, 조건도 걸리지 않는다", async ({ app }) => {
  const list = app.jobPostingList;
  await openJobPostingList(app);
  const pagesBefore = await list.totalPages();

  await list.companySearch.type(UNMATCHABLE_KEYWORD);

  expect(
    await list.companySearch.candidates(),
    "찾은 것이 없으면 고를 후보도 없다",
  ).toEqual([]);
  expect(
    await list.appliedConditions(),
    "고를 것이 없었으니 조건도 걸리지 않는다",
  ).toEqual([]);
  expect(await list.totalPages(), "결과도 그대로다").toBe(pagesBefore);
});

test("직군 카테고리를 고르면 그 직군의 공고로 좁혀지고, 풀면 되돌아온다", async ({
  app,
}) => {
  const list = app.jobPostingList;
  const postings = await openJobPostingList(app);

  // 직군은 검색해 찾는 축이 아니라 화면이 통째로 제시하는 축이다.
  const offered = await list.jobCategories();
  const listed = new Set(postings.flatMap((posting) => posting.categories));
  // 목록에 실제로 나와 있는 직군을 고른다 — 결과가 비지 않는 것이 그래서 보장된다.
  const chosen = offered.find((category) => listed.has(category));
  test.skip(
    chosen === undefined,
    "전제 미충족: 화면이 제시하는 직군 중 목록의 공고가 말하는 것이 없다",
  );

  const category = chosen as string;
  const pagesBefore = await list.totalPages();

  await list.chooseJobCategory(category);

  await expect
    .poll(async () => (await list.appliedConditions()).length, {
      message: "고른 직군이 걸린 조건으로 드러난다",
    })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await list.listedJobPostings()).length, {
      message: "좁힌 결과가 비어 있지 않다",
    })
    .toBeGreaterThan(0);
  expect(
    await list.totalPages(),
    "직군을 걸면 결과가 좁아진다 — 넓어지지 않는다",
  ).toBeLessThanOrEqual(pagesBefore);

  const narrowed = await list.listedJobPostings();
  expect(
    narrowed.every((posting) => posting.categories.includes(category)),
    "좁힌 결과는 전부 그 직군의 공고다",
  ).toBe(true);

  await list.clearFilters();

  await expect
    .poll(() => list.appliedConditions(), {
      message: "직군을 풀면 걸린 것이 남지 않는다",
    })
    .toEqual([]);
  await expect
    .poll(() => list.totalPages(), {
      message: "직군을 풀면 좁히기 전의 결과로 돌아온다",
    })
    .toBe(pagesBefore);
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

test("조건을 겹쳐 걸면 결과가 더 좁아진다", async ({ app }) => {
  const list = app.jobPostingList;
  const postings = await openJobPostingList(app);
  const target = postings.find(
    (posting) => posting.skills.length > 0 && posting.companyName !== "",
  );
  test.skip(
    target === undefined,
    "전제 미충족: 기술스택과 회사를 함께 말하는 공고가 없다",
  );

  const posting = target as ListedJobPosting;

  await searchAndChoose(list.skillSearch, posting.skills[0] as string);
  const pagesWithOne = await list.totalPages();
  const conditionsWithOne = (await list.appliedConditions()).length;

  await searchAndChoose(list.companySearch, posting.companyName);

  await expect
    .poll(async () => (await list.appliedConditions()).length, {
      message: "두 축의 조건이 함께 걸린다 — 뒤에 건 것이 앞의 것을 밀어내지 않는다",
    })
    .toBeGreaterThan(conditionsWithOne);
  expect(
    await list.totalPages(),
    "조건을 더 걸면 결과가 더 좁아진다 — 넓어지지 않는다",
  ).toBeLessThanOrEqual(pagesWithOne);
});

test("조건을 새로 걸면 결과를 첫 페이지부터 다시 본다", async ({ app }) => {
  const list = app.jobPostingList;
  const postings = await openJobPostingList(app);
  const keyword = postings.flatMap((posting) => posting.skills)[0];
  test.skip(!keyword, "전제 미충족: 목록의 공고가 기술스택을 말하지 않는다");
  test.skip(
    (await list.totalPages()) < 2,
    "전제 미충족: 목록이 한 페이지뿐이다",
  );

  await list.goToPage(2);
  expect(await list.currentPage(), "2페이지를 보고 있다").toBe(2);

  await searchAndChoose(list.skillSearch, keyword as string);

  await expect
    .poll(() => list.currentPage(), {
      message: "조건이 바뀌면 보던 페이지가 아니라 새 결과의 처음을 보여준다",
    })
    .toBe(1);
});

test("걸어 둔 조건은 화면을 다시 열어도 유지된다", async ({ app }) => {
  const list = app.jobPostingList;
  const postings = await openJobPostingList(app);
  const keyword = postings.flatMap((posting) => posting.skills)[0];
  test.skip(!keyword, "전제 미충족: 목록의 공고가 기술스택을 말하지 않는다");

  await searchAndChoose(list.skillSearch, keyword as string);
  await expect
    .poll(async () => (await list.appliedConditions()).length)
    .toBeGreaterThan(0);

  const applied = await list.appliedConditions();
  const pages = await list.totalPages();

  await app.reopenCurrent();

  await expect
    .poll(() => app.currentRoute(), { message: "같은 화면이 다시 열린다" })
    .toBe("jobPostings");
  await expect
    .poll(() => list.appliedConditions(), {
      message: "다시 열어도 걸어 둔 조건이 그대로다 — 주소가 조건을 담고 있다",
    })
    .toEqual(applied);
  expect(await list.totalPages(), "같은 조건이니 결과도 같다").toBe(pages);
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
