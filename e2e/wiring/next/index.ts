import type { ElementHandle, Locator, Page } from "@playwright/test";

import type {
  AuthEntryPoint,
  EntryRoute,
  ConditionSearch,
  JourneyDriver,
  ListedJobPosting,
  Route,
} from "../../support/driver";

/**
 * 새 앱(careerhub-web)용 배선 — **지어진 화면만큼 채워진다.**
 *
 * 화면이 지어지는 순간 그 화면 Task가 여기의 해당 부분을 채운다.
 * 시나리오는 이미 존재하므로, 화면 Task의 완료 조건은 "이 배선으로 그 시나리오가 통과한다"가 된다.
 * 기존 앱 배선(`../legacy`)을 베끼지 않는다 — 기존 앱의 선택자는 새 앱에 없다 (ops-workflow#9).
 *
 * 서 있는 것은 **로그인 진입점**(ops-workflow#59) · **공고 목록**(ops-workflow#70) ·
 * **공고 상세**(ops-workflow#71)다.
 *
 * 새 앱이 흡수하는 특성:
 * - **경로 라우팅**이다 — 기존 앱의 해시(`#/login`)가 아니다.
 * - **로그인 진입점은 발급자를 직접 가리키는 앵커**다. 같은 오리진의 라우트를 거쳐
 *   리다이렉트하지 않으므로, 앵커의 `href`만 보고 "앱 밖인가"를 판정할 수 있다.
 * - **목록 화면의 상태는 주소에 있다.** 다만 조건을 켜고 끄는 것은 이동이 아니라 동작이라
 *   버튼이고(직군·후보·조건 해제), 진짜 이동인 페이지 넘김만 앵커다.
 * - **다 그려졌는지를 화면이 말한다.** 결과 영역도 리뷰 영역도 `aria-busy`로 자기 상태를
 *   내므로, 기존 앱 배선처럼 "두 번 재서 같으면 멈춘 것"으로 추정하지 않는다.
 * - **상세의 리뷰 페이지도 주소에 있다.** 목록의 페이지 넘김과 같은 것이라 앵커이고,
 *   같은 부품(`PageNavigation`)이 같은 표기(`n 페이지`)를 낸다.
 *
 * 겨눌 앱이 설 때까지 이 project는 `NEXT_BASE_URL`이 있을 때만 config에 실린다.
 */

const PATHS: Record<EntryRoute, string> = {
  home: "/",
  jobPostings: "/job_posting",
  login: "/login",
};

/** 결과 영역이 스스로 내는 표식 — 조건이 갈리면 이 영역만 다시 선다. */
const RESULTS = 'section[aria-label="검색 결과"]';
/** 리뷰 영역도 같은 규약을 쓴다 — 리뷰 페이지를 넘기면 이 영역만 다시 선다. */
const REVIEWS = '[data-slot="company-reviews"]';

/** 상세는 목록을 거쳐 들어가는 화면이라 경로에 좌표가 붙는다. */
const DETAIL_PATH = new RegExp(`^${PATHS.jobPostings}/[^/]+/[^/]+$`);

/** 그 영역이 다 그려졌는가. 두 영역이 같은 표식을 내므로 규칙도 하나다. */
function settled(region: string): string {
  return `${region}[aria-busy="false"]`;
}

/** 표기를 한 줄로 되돌린다 — 줄바꿈은 배치의 것이지 값의 것이 아니다. */
function normalize(text: string): string {
  return text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/** `총 3,582건 · 2 / 224 페이지` — 화면이 내는 규모 표기. 결과가 없으면 페이지 부분이 없다. */
function parsePageIndicator(
  summary: string,
): { current: number; total: number } | null {
  const matched = /(\d+)\s*\/\s*(\d+)\s*페이지/.exec(summary);
  if (matched === null) {
    return null;
  }
  return {
    current: Number.parseInt(matched[1] as string, 10),
    total: Number.parseInt(matched[2] as string, 10),
  };
}

/** `경력 3~10년` · `경력 5년 이상` · `경력 3년 이하` · `경력무관`을 최소 경력으로 되돌린다. */
function parseMinCareer(text: string): number | null {
  if (text === "" || text.includes("무관")) return null;
  // 상한만 있는 표기는 최소 경력을 말하지 않는다.
  if (text.includes("이하") && !text.includes("~")) return null;
  const matched = /\d+/.exec(text);
  return matched ? Number.parseInt(matched[0], 10) : null;
}

function firstNumberIn(text: string): number {
  const matched = /\d+/.exec(text);
  return matched ? Number.parseInt(matched[0], 10) : 0;
}

export function createNextDriver(page: Page): JourneyDriver {
  const cards = (): Locator => page.locator('[data-slot="job-posting"]');
  const summary = (): Locator => page.locator(`${RESULTS} [role="status"]`);
  // 걸린 조건은 축마다 자기 자리에 놓인다 — 축을 가리지 않고 한 목록으로 모은다.
  // 해제는 이동이 아니라 동작이라 앵커가 아니라 버튼이다.
  const appliedChips = (): Locator =>
    page.locator('[data-slot="applied-conditions"] button');
  const categoryButtons = (): Locator =>
    page.locator('[data-slot="job-categories"] button');

  /**
   * 다시 그려지는 영역 하나를 바꾸는 동작.
   *
   * 조건이 갈리면 결과 영역이, 리뷰 페이지를 넘기면 리뷰 영역이 **통째로 다시 선다**
   * (`<Suspense>`의 key가 그 상태다). 그래서 "옛 영역이 DOM에서 떨어져 나갔고, 새 영역이
   * 다 그려졌다"가 완료의 정의가 된다 — 시간을 재거나 같은 값이 두 번 나오기를 기다리는
   * 추정이 필요 없다. 두 영역이 같은 규약을 쓰므로 기다리는 코드도 하나다.
   */
  const settle = async (
    region: string,
    interact: () => Promise<void>,
  ): Promise<void> => {
    const stale: ElementHandle<SVGElement | HTMLElement> | null = await page
      .locator(region)
      .elementHandle();

    await interact();

    if (stale !== null) {
      await page.waitForFunction((element) => !element.isConnected, stale);
      await stale.dispose();
    }
    await page.locator(settled(region)).waitFor();
  };

  const act = (interact: () => Promise<void>): Promise<void> =>
    settle(RESULTS, interact);

  const readSummary = async (): Promise<string> => {
    await page.locator(settled(RESULTS)).waitFor();
    return normalize((await summary().textContent()) ?? "");
  };

  /** 리뷰 영역이 무엇을 말하는지 한 곳에서 읽는다 — 다 그려진 뒤에만 묻는다. */
  const reviewsRegion = (): Locator => page.locator(REVIEWS);
  const settledReviews = async (): Promise<Locator> => {
    const region = page.locator(settled(REVIEWS));
    await region.waitFor();
    return region;
  };

  /**
   * 검색해서 거는 조건 축 하나.
   *
   * **넣는 것과 거는 것이 갈라져 있다** — 검색어는 입력칸에만 남고, 조건이 되는 것은
   * 제시된 후보를 고르는 순간이다. 새 앱에서 그 "고르기"는 링크를 따라가는 일이다.
   */
  const conditionSearch = (axis: string): ConditionSearch => {
    const box = (): Locator =>
      page.locator(`[data-slot="condition-search"][data-axis="${axis}"]`);
    const candidates = (): Locator =>
      box().locator('[data-slot="condition-candidates"] button');

    return {
      async type(keyword) {
        await box().locator("input").fill(keyword);
      },

      async candidates() {
        return (await candidates().allTextContents()).map(normalize);
      },

      async choose(candidate) {
        const labels = (await candidates().allTextContents()).map(normalize);
        const index = labels.indexOf(candidate);
        if (index < 0) {
          throw new Error(
            `제시되지 않은 후보를 골랐다: '${candidate}' (제시된 것: ${labels.join(" | ")})`,
          );
        }
        await act(() => candidates().nth(index).click());
      },
    };
  };

  return {
    async visit(route) {
      await page.goto(PATHS[route]);
    },

    async currentRoute(): Promise<Route> {
      const path = new URL(page.url()).pathname.replace(/\/+$/, "");
      if (path === "") return "home";
      if (path === PATHS.login) return "login";
      if (path === PATHS.jobPostings) return "jobPostings";
      if (DETAIL_PATH.test(path)) return "jobPostingDetail";
      return "unknown";
    },

    async reopenCurrent() {
      // 조건도 리뷰 페이지도 주소에 실려 있다 — 같은 주소를 다시 여는 것으로 충분하다.
      // 기다릴 영역은 지금 서 있는 화면이 정한다(목록이면 결과, 상세면 리뷰).
      const region = DETAIL_PATH.test(new URL(page.url()).pathname)
        ? REVIEWS
        : RESULTS;
      await page.reload();
      await page.locator(settled(region)).waitFor();
    },

    jobPostingList: {
      async listedJobPostings(): Promise<ListedJobPosting[]> {
        await page.locator(settled(RESULTS)).waitFor();
        // 카드 하나에서 필요한 것을 한 번에 긁는다 — 여러 번 물으면 그 사이에 목록이 갈릴 수 있다.
        const raw = await cards().evaluateAll((elements) =>
          elements.map((element) => ({
            title:
              element.querySelector('[data-slot="job-posting-title"]')
                ?.textContent ?? "",
            companyName:
              element.querySelector('[data-slot="job-posting-company"]')
                ?.textContent ?? "",
            skills: Array.from(
              element.querySelectorAll('[data-slot="job-posting-skills"] > li'),
            ).map((item) => item.textContent ?? ""),
            categories: Array.from(
              element.querySelectorAll(
                '[data-slot="job-posting-categories"] > li',
              ),
            ).map((item) => item.textContent ?? ""),
            career:
              element.querySelector('[data-slot="job-posting-career"]')
                ?.textContent ?? "",
            // 별점은 목록·상세가 같은 부품을 쓴다 — 표기를 내는 자리도 하나다.
            review:
              element.querySelector('[data-slot="rating-count"]')?.textContent ??
              "",
          })),
        );

        return raw.map((posting) => ({
          title: normalize(posting.title),
          companyName: normalize(posting.companyName),
          skills: posting.skills.map(normalize),
          categories: posting.categories.map(normalize),
          minCareer: parseMinCareer(normalize(posting.career)),
          reviewCount: firstNumberIn(posting.review),
        }));
      },

      async totalPages() {
        return parsePageIndicator(await readSummary())?.total ?? 0;
      },

      async currentPage() {
        return parsePageIndicator(await readSummary())?.current ?? 1;
      },

      async goToPage(target) {
        await act(() =>
          page.locator(`[aria-label="${target} 페이지"]`).first().click(),
        );
      },

      skillSearch: conditionSearch("skill"),
      companySearch: conditionSearch("company"),

      async jobCategories() {
        return (await categoryButtons().allTextContents()).map(normalize);
      },

      async chooseJobCategory(category) {
        const labels = (await categoryButtons().allTextContents()).map(
          normalize,
        );
        const index = labels.indexOf(category);
        if (index < 0) {
          throw new Error(
            `제시되지 않은 직군 카테고리를 골랐다: '${category}' (제시된 것: ${labels.length}개)`,
          );
        }
        await act(() => categoryButtons().nth(index).click());
      },

      async filterByMinCareer(years) {
        // 적는 것과 거는 것도 갈라져 있다 — 제출해야 조건이 된다.
        const input = page.getByLabel("최소 경력(년)");
        await input.fill(String(years));
        await act(() => input.press("Enter"));
      },

      async appliedConditions() {
        await page.locator(settled(RESULTS)).waitFor();
        return (await appliedChips().allTextContents()).map(normalize);
      },

      async clearFilters() {
        const clear = page.locator('[data-slot="clear-conditions"]');
        // 걸린 것이 없으면 풀 것도 없다 — 그때는 버튼 자체가 화면에 없다.
        if ((await clear.count()) === 0) {
          return;
        }
        await act(() => clear.first().click());
      },

      async openListed(index) {
        await cards()
          .nth(index)
          .locator('[data-slot="job-posting-title"]')
          .click();
        await page.waitForURL(new RegExp(`${PATHS.jobPostings}/[^/]+/[^/]+`));
      },
    },

    jobPostingDetail: {
      async title(): Promise<string> {
        const heading = page.locator('[data-slot="job-posting-detail-title"]');
        await heading.waitFor();
        return normalize((await heading.textContent()) ?? "");
      },

      async companyName(): Promise<string> {
        const name = page.locator('[data-slot="job-posting-detail-company"]');
        await name.waitFor();
        return normalize((await name.textContent()) ?? "");
      },

      async reviewCountInSummary(): Promise<number> {
        // 리뷰 요약은 리뷰 영역 안의 별점이 낸다. 리뷰가 없으면 그 표기 자체가 없다 —
        // 영역은 그대로 서 있으므로 "없음"과 "아직 안 그려짐"이 섞이지 않는다.
        const count = (await settledReviews()).locator(
          '[data-slot="rating-count"]',
        );
        if ((await count.count()) === 0) return 0;
        return firstNumberIn((await count.first().textContent()) ?? "");
      },

      async listedReviewSummaries(): Promise<string[]> {
        const reviews = (await settledReviews()).locator(
          '[data-slot="company-review"]',
        );
        return (await reviews.allTextContents()).map(normalize);
      },

      async reviewPageCount(): Promise<number> {
        // 한 페이지에 몇 개를 보이는지는 앱이 정한다 — 몇 페이지인지도 앱이 화면에 낸다.
        const status = (await settledReviews()).locator('[role="status"]');
        if ((await status.count()) === 0) return 0;
        const text = normalize((await status.first().textContent()) ?? "");
        return parsePageIndicator(text)?.total ?? 0;
      },

      async goToReviewPage(target) {
        await settle(REVIEWS, () =>
          reviewsRegion()
            .locator(`[aria-label="${target} 페이지"]`)
            .first()
            .click(),
        );
      },
    },

    login: {
      async authEntryPoints(): Promise<AuthEntryPoint[]> {
        // 진입점 = 발급자를 직접 가리키는 앵커. 새 앱은 authorize URL을 서버에서 조립해
        // href에 그대로 싣는다 — 그래서 "앱 밖인가"가 화면만 보고 판정된다.
        const targets = await page
          .locator("main a[href]")
          .evaluateAll((elements) =>
            elements.map((element) => (element as HTMLAnchorElement).href),
          );
        const appOrigin = new URL(page.url()).origin;

        return targets.map((target) => ({
          target,
          external: new URL(target).origin !== appOrigin,
        }));
      },
    },
  };
}
