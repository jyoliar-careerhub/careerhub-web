import type { Locator, Page } from "@playwright/test";

import type {
  AuthEntryPoint,
  EntryRoute,
  JourneyDriver,
  PostingRef,
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
 */

const HASH_PATHS: Record<EntryRoute, string> = {
  home: "/",
  jobPostings: "/#/job_posting",
  login: "/#/login",
};

const POPUP_TIMEOUT_MS = 5_000;

/** 기존 앱은 한 자리 페이지 번호를 `01`처럼 채워 그린다. */
function pageLabel(page: number): string {
  return page < 10 ? `0${page}` : String(page);
}

function firstNumberIn(text: string): number {
  const matched = /\d+/.exec(text);
  return matched ? Number.parseInt(matched[0], 10) : 0;
}

export function createLegacyDriver(page: Page): JourneyDriver {
  // 공고를 새 탭에서 열므로 활성 페이지가 바뀐다. 로케이터는 그때그때 활성 페이지에서 만든다.
  let active = page;

  const cards = (): Locator => active.locator('a[href^="#/job_posting/"]');
  const paginate = (): Locator => active.locator(".paginate").first();
  // 기술스택 상자와 기업명 상자가 같은 클래스를 쓴다 — 입력칸으로 구분한다.
  const techStack = (): Locator =>
    active.locator(".eYcCqs").filter({ has: active.getByPlaceholder(/^기술스택/) });
  const skillInput = (): Locator => techStack().getByPlaceholder(/^기술스택/);
  const selectedSkills = (): Locator => techStack().locator(".btn_stack");

  const clickPageLink = async (label: string): Promise<void> => {
    await paginate().getByText(label, { exact: true }).first().click();
  };

  const goToFirstPage = async (): Promise<void> => {
    const first = paginate().getByText("first", { exact: true });
    // 페이지가 하나뿐이면 first/last를 안 그린다 — 이미 1페이지다.
    if ((await first.count()) > 0) {
      await first.click();
      return;
    }
    const one = paginate().getByText(pageLabel(1), { exact: true });
    if ((await one.count()) > 0) await one.click();
  };

  return {
    async visit(route) {
      active = page;
      await active.goto(HASH_PATHS[route]);
    },

    async visitJobPosting({ site, postingId }: PostingRef) {
      active = page;
      await active.goto(`/#/job_posting/${site}/${postingId}`);
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
      async listedTitles() {
        const titles = await cards().locator("h2").allTextContents();
        return titles.map((title) => title.trim());
      },

      /** 마지막 페이지의 번호가 곧 전체 페이지 수다. 읽고 나서 1페이지로 되돌린다. */
      async totalPages() {
        const pageLinks = paginate().locator("span");
        if ((await pageLinks.count()) === 0) return 0;

        const last = paginate().getByText("last", { exact: true });
        if ((await last.count()) > 0) await last.click();

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
        await clickPageLink(pageLabel(target));
      },

      async searchBySkill(skill) {
        await skillInput().fill(skill);
        await skillInput().press("Enter");
        await techStack().getByText(skill, { exact: true }).first().click();
      },

      async clearSearch() {
        // 선택된 조건을 하나씩 걷어낸다. 조건 수는 유한하므로 상한을 둬 무한 루프를 막는다.
        for (let attempt = 0; attempt < 10; attempt += 1) {
          if ((await selectedSkills().count()) === 0) return;
          await selectedSkills().first().click();
        }
        throw new Error("기술스택 조건이 걷히지 않는다 — 배선을 확인한다.");
      },

      async openFirstListed() {
        const opened = active
          .waitForEvent("popup", { timeout: POPUP_TIMEOUT_MS })
          .catch(() => null);
        await cards().first().click();

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

      async reviewCountInSummary() {
        const summary = active.locator(".rating .num");
        if ((await summary.count()) === 0) return 0;
        return firstNumberIn((await summary.first().textContent()) ?? "");
      },

      async listedReviewCount() {
        return active.locator(".review_item_inr").count();
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
