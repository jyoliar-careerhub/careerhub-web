import type { Page } from "@playwright/test";

/**
 * 시나리오가 아는 유일한 언어.
 *
 * 여기에는 **바뀌지 않을 것만** 담는다 — 라우트, 데이터 흐름, 핵심 사용자 여정.
 * 선택자·레이아웃·디자인은 배선(`e2e/wiring/*`)의 것이고, 이 파일에 새어나오면 안 된다.
 * 대상 앱을 바꿔도 시나리오가 안 바뀌는 이유가 이 경계다 (ops-workflow#9).
 */

/** 티켓이 명세 대상으로 정한 공개 라우트. URL 형태는 앱마다 다르므로 이름으로만 말한다. */
export type Route =
  | "home"
  | "jobPostings"
  | "jobPostingDetail"
  | "login"
  | "unknown";

/** 직접 진입할 수 있는 라우트 — 상세는 식별자가 필요하므로 제외된다. */
export type EntryRoute = Extract<Route, "home" | "jobPostings" | "login">;

/** 공고 하나를 가리키는 좌표. 값은 실행 시점에 발견하며 명세에 박지 않는다. */
export interface PostingRef {
  site: string;
  postingId: string;
}

/** 로그인 화면이 제시하는 인증 수단 진입점 하나. */
export interface AuthEntryPoint {
  /** 진입점이 향하는 곳. 값 자체를 어서션하지 않는다 — 앱 밖인지만 본다. */
  target: string;
  /** 앱 바깥(다른 오리진)으로 나가는가. 인증 제공자는 앱 밖에 있다. */
  external: boolean;
}

export interface JobPostingListScreen {
  /** 지금 화면에 나열된 공고들의 제목. 순서는 화면 순서. */
  listedTitles(): Promise<string[]>;
  /** 지금 조건에서 결과가 몇 페이지인가. "좁아졌다"를 구체값 없이 말하는 척도다. */
  totalPages(): Promise<number>;
  goToPage(page: number): Promise<void>;
  /** 기술스택으로 결과를 좁힌다. 키워드는 전제 검사가 실데이터에서 발견해 준다. */
  searchBySkill(skill: string): Promise<void>;
  /** 걸어 둔 기술스택 조건을 모두 푼다. */
  clearSearch(): Promise<void>;
  /** 나열된 첫 공고의 상세로 들어간다. */
  openFirstListed(): Promise<void>;
}

export interface JobPostingDetailScreen {
  title(): Promise<string>;
  /** 요약이 말하는 회사 리뷰 수. 리뷰가 없으면 0. */
  reviewCountInSummary(): Promise<number>;
  /** 화면에 실제로 나열된 리뷰 수. */
  listedReviewCount(): Promise<number>;
}

export interface LoginScreen {
  authEntryPoints(): Promise<AuthEntryPoint[]>;
}

export interface JourneyDriver {
  visit(route: EntryRoute): Promise<void>;
  visitJobPosting(ref: PostingRef): Promise<void>;
  /** 지금 어느 라우트에 있는가. URL 형태(해시/경로)는 배선이 흡수한다. */
  currentRoute(): Promise<Route>;

  jobPostingList: JobPostingListScreen;
  jobPostingDetail: JobPostingDetailScreen;
  login: LoginScreen;
}

export type DriverFactory = (page: Page) => JourneyDriver;
