import type { Page } from "@playwright/test";

/**
 * 시나리오가 아는 유일한 언어.
 *
 * 여기에는 **바뀌지 않을 것만** 담는다 — 라우트, 데이터 흐름, 핵심 사용자 여정.
 * 선택자·레이아웃·디자인은 배선(`e2e/wiring/*`)의 것이고, 이 파일에 새어나오면 안 된다.
 * 대상 앱을 바꿔도 시나리오가 안 바뀌는 이유가 이 경계다 (ops-workflow#9).
 *
 * 명세가 앱 바깥(백엔드 API 등)에 묻는 일은 없다. **여정에 필요한 것은 전부 화면이 알려준다** —
 * 무엇으로 검색할지도, 어느 공고에 리뷰가 달렸는지도 목록이 말해 준다.
 *
 * 예외가 **하나** 있다: `skillVocabularyTraffic`. 캐시는 원리상 화면에 드러나지 않으므로
 * (드러나지 않는 것이 캐시의 목적이다) 화면에게 물어서는 명세할 수 없다. 그래서 화면 밖의
 * 관찰을 여기 하나로 격리해 두고, 이름으로 그렇다고 말한다 — 늘어나면 위의 규율이 무너진다.
 */

/** 티켓이 명세 대상으로 정한 공개 라우트. URL 형태는 앱마다 다르므로 이름으로만 말한다. */
export type Route =
  | "home"
  | "jobPostings"
  | "jobPostingDetail"
  | "login"
  | "unknown";

/** 직접 진입할 수 있는 라우트 — 상세는 목록을 거쳐 들어간다. */
export type EntryRoute = Extract<Route, "home" | "jobPostings" | "login">;

/**
 * 목록에 나열된 공고 하나가 말해 주는 것.
 *
 * 레이아웃이 아니라 **공고가 담고 있는 정보**다 — 어느 디자인이든 목록은 이걸 말해야 목록이다.
 * 시나리오는 여기서 검색어도, 어느 공고를 열지도 정한다. 값을 명세에 박지 않고 화면이 준 것을
 * 되쓰므로 데이터가 갈려도 명세는 흔들리지 않는다.
 */
export interface ListedJobPosting {
  title: string;
  companyName: string;
  /** 공고가 요구하는 기술스택. 말하지 않으면 빈 배열. */
  skills: string[];
  /** 공고가 속한 직군 카테고리. 말하지 않으면 빈 배열. */
  categories: string[];
  /** 요구하는 최소 경력(년). 경력을 따지지 않으면 `null`. */
  minCareer: number | null;
  /** 회사 리뷰 수. 리뷰가 없으면 0. */
  reviewCount: number;
}

/** 로그인 화면이 제시하는 인증 수단 진입점 하나. */
export interface AuthEntryPoint {
  /** 진입점이 향하는 곳. 값 자체를 어서션하지 않는다 — 앱 밖인지만 본다. */
  target: string;
  /** 앱 바깥(다른 오리진)으로 나가는가. 인증 제공자는 앱 밖에 있다. */
  external: boolean;
}

/**
 * 검색어를 넣어 **후보를 받아 보고, 골라서 거는** 조건 축.
 *
 * 요점은 사용자가 하는 일이 두 단계라는 것이다 — **넣는 것과 거는 것은 다르다.**
 * 후보를 무엇으로 그리는지(드롭다운·리스트·자동완성)는 디자인이고, 여기 담긴 것은
 * "검색어를 넣으면 고를 수 있는 것들이 제시되고, 고른 것이 조건이 된다"는 흐름뿐이다.
 * 조건 축이 여럿이어도 이 흐름은 하나라, 시나리오는 축마다 다시 쓰이지 않는다.
 */
export interface ConditionSearch {
  /** 검색어를 넣어 후보를 청한다. **이것만으로는 조건이 걸리지 않는다.** */
  type(keyword: string): Promise<void>;
  /** 지금 제시된 후보들의 표기. 빈 배열이면 찾은 것이 없다는 뜻이다. */
  candidates(): Promise<string[]>;
  /** 제시된 후보 하나를 골라 조건으로 건다. */
  choose(candidate: string): Promise<void>;
}

export interface JobPostingListScreen {
  /** 지금 화면에 나열된 공고들. 순서는 화면 순서. */
  listedJobPostings(): Promise<ListedJobPosting[]>;
  /** 지금 조건에서 결과가 몇 페이지인가. "좁아졌다"를 구체값 없이 말하는 척도다. */
  totalPages(): Promise<number>;
  /** 지금 몇 페이지를 보고 있는가. */
  currentPage(): Promise<number>;
  goToPage(page: number): Promise<void>;

  /** 기술스택으로 좁힌다 — 검색어를 넣고, 제시된 후보를 골라서. */
  skillSearch: ConditionSearch;
  /** 회사로 좁힌다 — 〃. */
  companySearch: ConditionSearch;

  /**
   * 화면이 제시하는 직군 카테고리들.
   *
   * 검색해서 찾는 축이 아니라 **처음부터 제시되는** 축이다 — 수가 유한하고 잘 안 바뀌므로
   * 앱이 통째로 보여줄 수 있다. 무엇이 제시되는지는 화면에게 묻고, 목록의 내용은 어서션하지 않는다.
   */
  jobCategories(): Promise<string[]>;
  /** 제시된 직군 카테고리 하나를 골라 조건으로 건다. */
  chooseJobCategory(category: string): Promise<void>;

  /** 최소 경력으로 결과를 좁힌다. */
  filterByMinCareer(years: number): Promise<void>;

  /**
   * 지금 걸려 있는 조건들의 표기 — 축(직군·기술스택·회사·경력)을 가리지 않고 한 목록으로 본다.
   *
   * 조건을 **어떻게 되보여주는지**는 디자인이지만, *걸린 것이 화면에 드러난다*는 것 자체는
   * 검색 화면의 불변식이다. 표기의 내용은 어서션하지 않고 개수와 포함 여부만 쓴다.
   */
  appliedConditions(): Promise<string[]>;
  /** 걸어 둔 조건을 모두 푼다. */
  clearFilters(): Promise<void>;

  /** 나열된 공고 중 n번째(0부터)의 상세로 들어간다. */
  openListed(index: number): Promise<void>;
}

export interface JobPostingDetailScreen {
  title(): Promise<string>;
  /** 이 공고를 낸 회사의 이름. */
  companyName(): Promise<string>;
  /** 요약이 말하는 회사 리뷰 수. 리뷰가 없으면 0. */
  reviewCountInSummary(): Promise<number>;
  /**
   * 화면에 나열된 리뷰들. 각 문자열은 **한 리뷰를 구별하기 위한 표현**일 뿐이므로
   * 내용 자체를 어서션하지 않는다 — 개수를 세거나 페이지끼리 비교하는 데만 쓴다.
   */
  listedReviewSummaries(): Promise<string[]>;
  /** 리뷰가 몇 페이지인가. 리뷰가 없으면 0. 한 페이지 크기는 앱이 정하므로 앱에게 묻는다. */
  reviewPageCount(): Promise<number>;
  goToReviewPage(page: number): Promise<void>;
}

export interface LoginScreen {
  authEntryPoints(): Promise<AuthEntryPoint[]>;
}

/**
 * 앱이 조건 어휘를 **네트워크에서** 다시 받아 오는가 — 화면이 말해 주지 못하는 유일한 성질.
 *
 * 어휘를 어느 주소에서 받는지도, 무엇을 캐시 히트로 볼지도 앱마다 다르므로 배선의 것이다.
 * 시나리오가 아는 것은 "받아 왔는가 아닌가"뿐이다.
 */
export interface VocabularyTraffic {
  /**
   * `during` 동안 앱이 어휘를 네트워크에서 받아 온 횟수. 캐시가 낸 것은 세지 않는다.
   *
   * 횟수를 세는 것은 "몇 번 받았나"가 궁금해서가 아니라 **0인가 아닌가**를 묻기 위해서다 —
   * 캐시 히트가 관찰 가능한 요청을 아예 남기지 않는 경우가 있어(브라우저 메모리 캐시),
   * "요청이 없었다"와 "캐시가 냈다"를 한 척도로 묶어야 견고하다.
   */
  networkFetchesDuring(during: () => Promise<void>): Promise<number>;
}

export interface JourneyDriver {
  visit(route: EntryRoute): Promise<void>;
  /** 지금 어느 라우트에 있는가. URL 형태(해시/경로)는 배선이 흡수한다. */
  currentRoute(): Promise<Route>;
  /**
   * 지금 보고 있는 화면을 **그대로 다시 연다**.
   *
   * 화면의 상태가 주소에 실려 있는지 보는 통로다 — 걸어 둔 조건이 다시 열어도 살아 있으면
   * 그 화면은 공유·북마크·새로고침을 견딘다. 주소의 형태는 시나리오에 드러나지 않는다.
   */
  reopenCurrent(): Promise<void>;

  jobPostingList: JobPostingListScreen;
  jobPostingDetail: JobPostingDetailScreen;
  login: LoginScreen;

  /**
   * 기술스택 어휘의 트래픽 관찰. **관찰을 제공하지 않는 앱에서는 `null`** — 그 앱에서는 이
   * 성질을 명세하지 않는다(시나리오가 건너뛴다).
   *
   * 화면 하나에 속하지 않고 여정 전체(나갔다 다시 오는 것까지)에 걸치므로 여기 둔다.
   */
  skillVocabularyTraffic: VocabularyTraffic | null;
}

export type DriverFactory = (page: Page) => JourneyDriver;
