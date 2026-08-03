import type { Locator, Page } from "@playwright/test";

import type {
  AuthEntryPoint,
  ConditionSearch,
  EntryRoute,
  JourneyDriver,
  Route,
} from "../../support/driver";

/**
 * 기존 앱(careerhub-front · Svelte + svelte-spa-router)용 배선.
 *
 * 여기 있는 선택자는 **전부 버려질 것**이다 — 새 앱에는 없다.
 * 기존 앱이 은퇴하면(재작성 완료 후 전체 교체) 이 디렉터리를 통째로 지운다.
 * 살아남는 것은 `e2e/scenarios/`의 시나리오이지 이 배선이 아니다 (ops-workflow#9).
 *
 * 배선이 흡수하는 기존 앱의 특성:
 * - **해시 라우팅**(`#/job_posting`) — 새 앱은 경로 라우팅이다.
 * - **공고를 새 탭에서 연다** — 여정은 "상세가 나온다"이지 "같은 탭에서 나온다"가 아니므로,
 *   탭이 열리면 그쪽을 따라가고 아니면 그대로 둔다. 어느 쪽이든 시나리오는 같다.
 * - **페이지 번호를 창(window)으로 잘라 그린다** — 마지막 페이지에서는 1번 링크가 안 보인다.
 * - **정보를 문장으로 그린다**(`경력 3~10` · `(77개 리뷰)`) — 값으로 되돌리는 것은 배선의 일이다.
 * - **검색 후보를 청해야 준다** — 입력만으로는 안 뜨고 엔터(또는 돋보기)를 눌러야 후보가 나온다.
 *   게다가 기술스택 후보의 원본 목록이 화면 뒤에서 늦게 도착한다 — 잡힐 때까지 다시 청한다.
 * - **직군 카테고리는 조건 칩이 아니라 선택 상태로 표시된다** — 걸린 조건을 한 목록으로 모으는 것도,
 *   '전체'로 되돌리는 것도 여기서 흡수한다.
 */

const HASH_PATHS: Record<EntryRoute, string> = {
  home: "/",
  jobPostings: "/#/job_posting",
  login: "/#/login",
};

const POPUP_TIMEOUT_MS = 5_000;
const SETTLE_INTERVAL_MS = 200;
const SETTLE_ATTEMPTS = 25;
const CLICK_ATTEMPTS = 5;
/** 후보를 다시 청하는 횟수 × 한 번 청하고 기다리는 횟수. */
const CANDIDATE_REQUESTS = 3;
const CANDIDATE_WAITS = 5;

/** 기존 앱은 한 자리 페이지 번호를 `01`처럼 채워 그린다. */
function pageLabel(page: number): string {
  return page < 10 ? `0${page}` : String(page);
}

/** 기존 앱은 목록 항목을 ` · `로 이어 붙여 그린다 — 구분자와 공백(NBSP 포함)을 걷어낸다. */
function stripListSeparator(text: string): string {
  return text
    .replace(/ /g, " ")
    .replace(/^[\s·]+/, "")
    .trim();
}

/** 여러 줄로 그려진 표기를 한 줄로 되돌린다(후보·조건 표기는 줄바꿈을 품고 온다). */
function normalize(text: string): string {
  return text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function firstNumberIn(text: string): number {
  const matched = /\d+/.exec(text);
  return matched ? Number.parseInt(matched[0], 10) : 0;
}

/** `경력 3~10` · `경력 5년 이상` · `경력 3년 이하` · `경력무관`을 최소 경력으로 되돌린다. */
function parseMinCareer(text: string): number | null {
  if (text === "" || text.includes("무관")) return null;
  // 상한만 있는 표기는 최소 경력을 말하지 않는다.
  if (text.includes("이하") && !text.includes("~")) return null;
  const matched = /\d+/.exec(text);
  return matched ? Number.parseInt(matched[0], 10) : null;
}

export function createLegacyDriver(page: Page): JourneyDriver {
  // 공고를 새 탭에서 열므로 활성 페이지가 바뀐다. 로케이터는 그때그때 활성 페이지에서 만든다.
  let active = page;

  const cards = (): Locator => active.locator('a[href^="#/job_posting/"]');
  const paginate = (): Locator => active.locator(".paginate").first();
  // 기술스택 상자와 기업명 상자가 같은 클래스를 쓴다 — 입력칸으로 구분한다.
  const techStack = (): Locator =>
    active
      .locator(".eYcCqs")
      .filter({ has: active.getByPlaceholder(/^기술스택/) });
  const companyQuery = (): Locator =>
    active.locator(".eYcCqs").filter({ has: active.getByPlaceholder(/^기업명/) });
  const careerQuery = (): Locator => active.locator(".eYcCbP");
  /** 걸어 둔 조건은 패널 종류와 무관하게 같은 모양의 칩으로 그려진다(직군은 예외 — 아래 참조). */
  const conditionChips = (): Locator => active.locator(".btn_stack > span");
  /** 직군 카테고리 버튼들. '전체'(초기화) 버튼만 다른 클래스를 달고 있어 이것으로 갈라낸다. */
  const categoryButtons = (): Locator =>
    active.locator(".caregoryQuery .list_job_btn_wrap button:not(.sc-pVTFL)");
  const clearCategoryButton = (): Locator =>
    active.locator(".caregoryQuery button.sc-pVTFL");
  const selectedCategoryButtons = (): Locator =>
    categoryButtons().and(active.locator(".selected"));

  /**
   * 목록이 갱신되는 동안 페이지네이션이 통째로 다시 그려진다(질의가 바뀌면 개수부터 다시 받는다).
   * 그 사이에 누르면 요소가 DOM에서 떨어져 나간다 — 두 번 연속 같은 모양일 때 '멈췄다'고 본다.
   */
  const settlePagination = async (): Promise<void> => {
    let previous: string | null = null;
    for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
      const current = await paginate()
        .textContent({ timeout: SETTLE_INTERVAL_MS * 5 })
        .catch(() => null);
      if (current !== null && current === previous) return;
      previous = current;
      await active.waitForTimeout(SETTLE_INTERVAL_MS);
    }
  };

  /** 멈췄다고 본 뒤에도 갱신이 한 번 더 올 수 있다 — 떨어져 나가면 기다렸다 다시 노린다. */
  const clickWhenSettled = async (target: Locator): Promise<void> => {
    for (let attempt = 0; attempt < CLICK_ATTEMPTS; attempt += 1) {
      try {
        await target.click({ timeout: SETTLE_INTERVAL_MS * 25 });
        return;
      } catch (error) {
        if (attempt === CLICK_ATTEMPTS - 1) throw error;
        await settlePagination();
      }
    }
  };

  const goToFirstPage = async (): Promise<void> => {
    await settlePagination();
    const first = paginate().getByText("first", { exact: true });
    // 페이지가 하나뿐이면 first/last를 안 그린다 — 이미 1페이지다.
    if ((await first.count()) > 0) {
      await clickWhenSettled(first);
      return;
    }
    const one = paginate().getByText(pageLabel(1), { exact: true });
    if ((await one.count()) > 0) await clickWhenSettled(one);
  };

  /**
   * 검색 상자 하나를 조건 축으로 감싼다.
   *
   * 후보는 `ul li span`으로만 그려진다 — 회사 검색이 결과 없음을 알릴 때 쓰는
   * "검색 결과가 없습니다." 항목은 `span`이 없어 자연히 후보에서 빠진다.
   */
  const conditionSearch = (
    panel: () => Locator,
    placeholder: RegExp,
  ): ConditionSearch => {
    const candidates = (): Locator => panel().locator("ul li span");

    return {
      async type(keyword) {
        const input = panel().getByPlaceholder(placeholder);
        await input.fill(keyword);
        // 엔터가 후보를 청하는 신호다. 원본 목록이 늦게 오면 첫 청은 빈손이라 다시 청한다.
        for (let request = 0; request < CANDIDATE_REQUESTS; request += 1) {
          await input.press("Enter");
          for (let wait = 0; wait < CANDIDATE_WAITS; wait += 1) {
            if ((await candidates().count()) > 0) return;
            await active.waitForTimeout(SETTLE_INTERVAL_MS);
          }
        }
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
        // 클릭 핸들러는 항목에 붙어 있고 표기는 그 안에 있다 — 표기를 눌러도 항목이 받는다.
        await candidates().nth(index).click();
        await settlePagination();
      },
    };
  };

  return {
    async visit(route) {
      active = page;
      await active.goto(HASH_PATHS[route]);
    },

    async currentRoute(): Promise<Route> {
      const hash = new URL(active.url()).hash.replace(/\?.*$/, "");
      const path = hash.replace(/^#/, "") || "/";

      if (path === "/") return "home";
      if (path === "/job_posting") return "jobPostings";
      if (/^\/job_posting\/[^/]+\/[^/]+$/.test(path)) return "jobPostingDetail";
      if (path === "/login") return "login";
      return "unknown";
    },

    async reopenCurrent() {
      // 기존 앱은 걸린 조건을 주소(해시 뒤 질의문자열)에 실어 두고, 열 때 되읽는다.
      await active.reload();
      await settlePagination();
    },

    jobPostingList: {
      async listedJobPostings() {
        // 카드 하나에서 필요한 것을 한 번에 긁는다 — 여러 번 물으면 그 사이에 목록이 갱신될 수 있다.
        const raw = await cards().evaluateAll((elements) =>
          elements.map((element) => ({
            title: element.querySelector("h2")?.textContent ?? "",
            companyName: element.querySelector(".jCplrW")?.textContent ?? "",
            // 기술스택과 직무 분류가 같은 클래스를 쓴다 — 기존 앱은 색으로만 구분한다.
            skills: Array.from(
              element.querySelectorAll('ul[style*="brown"] li'),
            ).map((item) => item.textContent ?? ""),
            categories: Array.from(
              element.querySelectorAll('ul[style*="yellowgreen"] li'),
            ).map((item) => item.textContent ?? ""),
            career:
              element.querySelector('ul li[style*="teal"]')?.textContent ?? "",
            review: element.querySelector(".rating .num")?.textContent ?? "",
          })),
        );

        return raw.map((posting) => ({
          title: posting.title.trim(),
          companyName: posting.companyName.trim(),
          skills: posting.skills.map(stripListSeparator),
          categories: posting.categories.map(stripListSeparator),
          minCareer: parseMinCareer(posting.career.trim()),
          reviewCount: firstNumberIn(posting.review),
        }));
      },

      /** 마지막 페이지의 번호가 곧 전체 페이지 수다. 읽고 나서 1페이지로 되돌린다. */
      async totalPages() {
        await settlePagination();
        const pageLinks = paginate().locator("span");
        if ((await pageLinks.count()) === 0) return 0;

        const last = paginate().getByText("last", { exact: true });
        if ((await last.count()) > 0) await clickWhenSettled(last);

        await settlePagination();
        const current = await paginate()
          .locator("span.bold")
          .first()
          .textContent();
        const total = firstNumberIn(current ?? "");

        await goToFirstPage();
        return total;
      },

      async currentPage() {
        await settlePagination();
        const current = paginate().locator("span.bold");
        // 페이지가 하나뿐이면 번호를 안 그린다 — 그때도 보고 있는 것은 1페이지다.
        if ((await current.count()) === 0) return 1;
        return firstNumberIn((await current.first().textContent()) ?? "") || 1;
      },

      async goToPage(target) {
        if (target === 1) {
          await goToFirstPage();
          return;
        }
        await clickWhenSettled(
          paginate().getByText(pageLabel(target), { exact: true }).first(),
        );
      },

      skillSearch: conditionSearch(techStack, /^기술스택/),
      companySearch: conditionSearch(companyQuery, /^기업명/),

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
        await clickWhenSettled(categoryButtons().nth(index));
        await settlePagination();
      },

      async filterByMinCareer(years) {
        // 경력 상자는 '년 이상'이 먼저다. 입력만으로 질의가 갱신된다(후보 제시가 없는 축).
        await careerQuery()
          .locator('input[type="number"]')
          .first()
          .fill(String(years));
        await settlePagination();
      },

      async appliedConditions() {
        // 직군은 칩이 아니라 버튼의 선택 상태로 표시된다 — 축이 달라도 한 목록으로 모은다.
        const categories = await selectedCategoryButtons().allTextContents();
        const chips = await conditionChips().allTextContents();
        return [...categories, ...chips].map(normalize);
      },

      async clearFilters() {
        // '전체'가 직군 선택을 통째로 되돌린다. 나머지 축은 칩을 하나씩 걷어낸다.
        if ((await selectedCategoryButtons().count()) > 0) {
          await clickWhenSettled(clearCategoryButton().first());
          await settlePagination();
        }
        const chips = active.locator(".btn_stack");
        // 조건 수는 유한하므로 상한을 둬 무한 루프를 막는다.
        for (let attempt = 0; attempt < 10; attempt += 1) {
          if ((await chips.count()) === 0) {
            await settlePagination();
            return;
          }
          await chips.first().click();
        }
        throw new Error("걸어 둔 조건이 걷히지 않는다 — 배선을 확인한다.");
      },

      async openListed(index) {
        const opened = active
          .waitForEvent("popup", { timeout: POPUP_TIMEOUT_MS })
          .catch(() => null);
        await cards().nth(index).click();

        const popup = await opened;
        if (popup) {
          await popup.waitForLoadState();
          active = popup;
        }
      },
    },

    jobPostingDetail: {
      async title() {
        const heading = await active.locator("h1").first().textContent();
        return (heading ?? "").trim();
      },

      async companyName() {
        // 우측 메뉴가 회사를 이름으로 소개한다.
        const heading = await active
          .getByRole("complementary")
          .getByRole("heading", { level: 2 })
          .first()
          .textContent();
        return (heading ?? "").trim();
      },

      async reviewCountInSummary() {
        const summary = active.locator(".rating .num");
        if ((await summary.count()) === 0) return 0;
        return firstNumberIn((await summary.first().textContent()) ?? "");
      },

      async listedReviewSummaries() {
        const reviews = await active
          .locator(".review_item_inr")
          .allTextContents();
        return reviews.map((review) => review.replace(/\s+/g, " ").trim());
      },

      async reviewPageCount() {
        // 리뷰 페이지네이션은 리뷰 영역 안에 따로 있다(목록 페이지네이션과 다른 것).
        const pages = await active.locator(".rating .paginate span").count();
        if (pages > 0) return pages;
        return (await active.locator(".review_item_inr").count()) > 0 ? 1 : 0;
      },

      async goToReviewPage(target) {
        await active
          .locator(".rating .paginate")
          .getByText(pageLabel(target), { exact: true })
          .first()
          .click();
      },
    },

    login: {
      async authEntryPoints(): Promise<AuthEntryPoint[]> {
        // 진입점 = 버튼을 감싼 링크. 기존 앱은 인증 제공자마다 하나씩 그린다.
        const entryPoints = active
          .locator("a[href]")
          .filter({ has: active.locator("button") });
        const targets = await entryPoints.evaluateAll((elements) =>
          elements.map((element) => (element as HTMLAnchorElement).href),
        );
        const appOrigin = new URL(active.url()).origin;

        return targets.map((target) => ({
          target,
          external: new URL(target).origin !== appOrigin,
        }));
      },
    },
  };
}
