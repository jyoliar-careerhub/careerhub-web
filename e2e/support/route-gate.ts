import type { JourneyDriver, Route } from "./driver";

/**
 * 라우트 게이트 — **지금 서 있는 화면의 메서드만 부를 수 있게** 한다.
 *
 * 드라이버는 세 화면을 항상 다 들고 있고, TypeScript는 "지금 어느 라우트인가"라는 런타임 상태를
 * 모른다. 그래서 목록에 선 채로 상세의 메서드를 부르는 실수를 타입으로는 못 막는다.
 * 게다가 기존 앱에서는 그 실수가 **조용히 그럴듯한 값**을 낸다 — 목록 페이지에도 `h1`(기술스택 패널)이
 * 있고 카드에도 리뷰 수 표기가 있어, 상세의 제목·리뷰 수를 물으면 엉뚱한 값이 그대로 돌아온다.
 *
 * 규율로 지키는 대신 여기서 막는다. 라우트가 어긋나면 즉시, 어느 호출이 어디서 틀렸는지 말하며 죽는다.
 * 배선 바깥의 한 곳이므로 legacy·next 양쪽에 똑같이 걸린다.
 */
export function withRouteGate(driver: JourneyDriver): JourneyDriver {
  const ensure = async (expected: Route, call: string): Promise<void> => {
    const actual = await driver.currentRoute();
    if (actual === expected) return;

    throw new Error(
      `${call}을 불렀지만 지금 라우트는 '${actual}'다(기대: '${expected}') — 그 화면으로 먼저 이동한다.`,
    );
  };

  return {
    visit: (route) => driver.visit(route),
    visitJobPosting: (ref) => driver.visitJobPosting(ref),
    currentRoute: () => driver.currentRoute(),

    jobPostingList: {
      async listedJobPostings() {
        await ensure("jobPostings", "jobPostingList.listedJobPostings()");
        return driver.jobPostingList.listedJobPostings();
      },
      async totalPages() {
        await ensure("jobPostings", "jobPostingList.totalPages()");
        return driver.jobPostingList.totalPages();
      },
      async goToPage(page) {
        await ensure("jobPostings", "jobPostingList.goToPage()");
        return driver.jobPostingList.goToPage(page);
      },
      async searchBySkill(skill) {
        await ensure("jobPostings", "jobPostingList.searchBySkill()");
        return driver.jobPostingList.searchBySkill(skill);
      },
      async searchByCompany(company) {
        await ensure("jobPostings", "jobPostingList.searchByCompany()");
        return driver.jobPostingList.searchByCompany(company);
      },
      async filterByMinCareer(years) {
        await ensure("jobPostings", "jobPostingList.filterByMinCareer()");
        return driver.jobPostingList.filterByMinCareer(years);
      },
      async clearFilters() {
        await ensure("jobPostings", "jobPostingList.clearFilters()");
        return driver.jobPostingList.clearFilters();
      },
      async openFirstListed() {
        await ensure("jobPostings", "jobPostingList.openFirstListed()");
        return driver.jobPostingList.openFirstListed();
      },
    },

    jobPostingDetail: {
      async title() {
        await ensure("jobPostingDetail", "jobPostingDetail.title()");
        return driver.jobPostingDetail.title();
      },
      async companyName() {
        await ensure("jobPostingDetail", "jobPostingDetail.companyName()");
        return driver.jobPostingDetail.companyName();
      },
      async reviewCountInSummary() {
        await ensure(
          "jobPostingDetail",
          "jobPostingDetail.reviewCountInSummary()",
        );
        return driver.jobPostingDetail.reviewCountInSummary();
      },
      async listedReviewSummaries() {
        await ensure(
          "jobPostingDetail",
          "jobPostingDetail.listedReviewSummaries()",
        );
        return driver.jobPostingDetail.listedReviewSummaries();
      },
      async goToReviewPage(page) {
        await ensure("jobPostingDetail", "jobPostingDetail.goToReviewPage()");
        return driver.jobPostingDetail.goToReviewPage(page);
      },
    },

    login: {
      async authEntryPoints() {
        await ensure("login", "login.authEntryPoints()");
        return driver.login.authEntryPoints();
      },
    },
  };
}
