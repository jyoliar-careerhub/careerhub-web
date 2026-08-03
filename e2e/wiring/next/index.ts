import type { Page } from "@playwright/test";

import type {
  AuthEntryPoint,
  ConditionSearch,
  JourneyDriver,
  ListedJobPosting,
  Route,
} from "../../support/driver";

/**
 * 새 앱(careerhub-web)용 배선 — **아직 구현하지 않는다.**
 *
 * 화면이 지어지는 순간 그 화면 Task가 여기의 해당 부분을 채운다.
 * 시나리오는 이미 존재하므로, 화면 Task의 완료 조건은 "이 배선으로 그 시나리오가 통과한다"가 된다.
 * 기존 앱 배선(`../legacy`)을 베끼지 않는다 — 기존 앱의 선택자는 새 앱에 없다 (ops-workflow#9).
 *
 * 겨눌 앱이 설 때까지 이 project는 `NEXT_BASE_URL`이 있을 때만 config에 실린다.
 */

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
  // page는 구현이 채워질 때 쓰인다. 지금은 인터페이스 형태만 고정한다.
  void page;

  return {
    async visit(route) {
      notImplemented(`visit(${route})`);
    },

    async currentRoute(): Promise<Route> {
      return notImplemented("currentRoute");
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
        return notImplemented("login.authEntryPoints");
      },
    },
  };
}
