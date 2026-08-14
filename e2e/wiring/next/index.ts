import type { Page } from "@playwright/test";

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
 * 지금 서 있는 것은 **로그인 진입점**뿐이다(ops-workflow#59). 공고 목록·상세는 아직 없다.
 *
 * 새 앱이 흡수하는 특성:
 * - **경로 라우팅**이다 — 기존 앱의 해시(`#/login`)가 아니다.
 * - **로그인 진입점은 발급자를 직접 가리키는 앵커**다. 같은 오리진의 라우트를 거쳐
 *   리다이렉트하지 않으므로, 앵커의 `href`만 보고 "앱 밖인가"를 판정할 수 있다.
 *
 * 겨눌 앱이 설 때까지 이 project는 `NEXT_BASE_URL`이 있을 때만 config에 실린다.
 */

const PATHS: Record<EntryRoute, string> = {
  home: "/",
  jobPostings: "/job_postings",
  login: "/login",
};

function notImplemented(what: string): never {
  throw new Error(
    `새 앱 배선 미구현: ${what} — 이 화면을 짓는 Task가 채운다 (ops-workflow#9).`,
  );
}

function conditionSearch(axis: string): ConditionSearch {
  return {
    async type() {
      notImplemented(`jobPostingList.${axis}.type`);
    },
    async candidates(): Promise<string[]> {
      return notImplemented(`jobPostingList.${axis}.candidates`);
    },
    async choose() {
      notImplemented(`jobPostingList.${axis}.choose`);
    },
  };
}

export function createNextDriver(page: Page): JourneyDriver {
  return {
    async visit(route) {
      await page.goto(PATHS[route]);
    },

    async currentRoute(): Promise<Route> {
      const path = new URL(page.url()).pathname.replace(/\/+$/, "");
      if (path === "") return "home";
      if (path === PATHS.login) return "login";
      if (path === PATHS.jobPostings) return "jobPostings";
      // 상세는 목록을 거쳐 들어가는 화면이라 경로에 좌표가 붙는다.
      if (path.startsWith(`${PATHS.jobPostings}/`)) return "jobPostingDetail";
      return "unknown";
    },

    async reopenCurrent() {
      notImplemented("reopenCurrent");
    },

    jobPostingList: {
      async listedJobPostings(): Promise<ListedJobPosting[]> {
        return notImplemented("jobPostingList.listedJobPostings");
      },
      async totalPages(): Promise<number> {
        return notImplemented("jobPostingList.totalPages");
      },
      async currentPage(): Promise<number> {
        return notImplemented("jobPostingList.currentPage");
      },
      async goToPage() {
        notImplemented("jobPostingList.goToPage");
      },

      skillSearch: conditionSearch("skillSearch"),
      companySearch: conditionSearch("companySearch"),

      async jobCategories(): Promise<string[]> {
        return notImplemented("jobPostingList.jobCategories");
      },
      async chooseJobCategory() {
        notImplemented("jobPostingList.chooseJobCategory");
      },
      async filterByMinCareer() {
        notImplemented("jobPostingList.filterByMinCareer");
      },
      async appliedConditions(): Promise<string[]> {
        return notImplemented("jobPostingList.appliedConditions");
      },
      async clearFilters() {
        notImplemented("jobPostingList.clearFilters");
      },
      async openListed() {
        notImplemented("jobPostingList.openListed");
      },
    },

    jobPostingDetail: {
      async title(): Promise<string> {
        return notImplemented("jobPostingDetail.title");
      },
      async companyName(): Promise<string> {
        return notImplemented("jobPostingDetail.companyName");
      },
      async reviewCountInSummary(): Promise<number> {
        return notImplemented("jobPostingDetail.reviewCountInSummary");
      },
      async listedReviewSummaries(): Promise<string[]> {
        return notImplemented("jobPostingDetail.listedReviewSummaries");
      },
      async reviewPageCount(): Promise<number> {
        return notImplemented("jobPostingDetail.reviewPageCount");
      },
      async goToReviewPage() {
        notImplemented("jobPostingDetail.goToReviewPage");
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
