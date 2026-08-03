import type { Locator, Page } from "@playwright/test";

import type {
  AuthEntryPoint,
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

/** 기존 앱은 한 자리 페이지 번호를 `01`처럼 채워 그린다. */
function pageLabel(page: number): string {
  return page < 10 ? `0${page}` : String(page);
}

/** 기존 앱은 목록 항목을 ` · `로 이어 붙여 그린다 — 구분자와 공백(NBSP 포함)을 걷어낸다. */
function stripListSeparator(text: string): string {
  return text
    .replace(/ /g, " ")
    .replace(/^[\s·]+/, "")
    .trim();
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
  /** 걸어 둔 조건은 패널 종류와 무관하게 같은 모양의 칩으로 그려진다. */
  const selectedFilters = (): Locator => active.locator(".btn_stack");

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

  /** 검색 상자에 넣고 제안 목록에서 고른다 — 기존 앱의 검색은 자동완성 선택이다. */
  const searchAndPick = async (
    panel: Locator,
    placeholder: RegExp,
    keyword: string,
  ): Promise<void> => {
    const input = panel.getByPlaceholder(placeholder);
    await input.fill(keyword);
    await input.press("Enter");
    await panel.getByText(keyword, { exact: true }).first().click();
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
            career:
              element.querySelector('ul li[style*="teal"]')?.textContent ?? "",
            review: element.querySelector(".rating .num")?.textContent ?? "",
          })),
        );

        return raw.map((posting) => ({
          title: posting.title.trim(),
          companyName: posting.companyName.trim(),
          skills: posting.skills.map(stripListSeparator),
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

      async goToPage(target) {
        if (target === 1) {
          await goToFirstPage();
          return;
        }
        await clickWhenSettled(
          paginate().getByText(pageLabel(target), { exact: true }).first(),
        );
      },

      async searchBySkill(skill) {
        await searchAndPick(techStack(), /^기술스택/, skill);
      },

      async searchByCompany(company) {
        await searchAndPick(companyQuery(), /^기업명/, company);
      },

      async filterByMinCareer(years) {
        // 경력 상자는 '년 이상'이 먼저다. 입력만으로 질의가 갱신된다(자동완성 없음).
        await careerQuery()
          .locator('input[type="number"]')
          .first()
          .fill(String(years));
      },

      async clearFilters() {
        // 선택된 조건을 하나씩 걷어낸다. 조건 수는 유한하므로 상한을 둬 무한 루프를 막는다.
        for (let attempt = 0; attempt < 10; attempt += 1) {
          if ((await selectedFilters().count()) === 0) return;
          await selectedFilters().first().click();
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
