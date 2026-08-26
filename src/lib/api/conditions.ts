import { api } from "./client";

import type { components } from "./schema";

/**
 * 검색 조건이 쓰는 어휘 — 직군·기술스택·회사.
 *
 * 세 엔드포인트가 한 파일에 있는 이유는 셋이 같은 일을 하기 때문이다: **무엇으로 좁힐 수
 * 있는지를 화면에 알려준다.** 공고 자체(`./job-postings`)와는 수명도 캐시 정책도 다르다
 * (계약이 `/categories`·`/skills`에 하루, `/companies`에 반나절 캐시를 선언한다).
 *
 * 계약 타입은 전부 생성물(`./schema`)에서 온다 (ADR-0014). 다만 이 셋은 proto 직렬화라
 * 빈 값 필드가 통째로 생략된다(`omitempty`) — 그래서 **받는 즉시** 여기서 빠짐없는 모양으로
 * 옮긴다. 옵셔널을 화면까지 흘려보내면 화면마다 같은 방어 코드가 생긴다.
 */

type ErrorResponse = components["schemas"]["ErrorResponse"];

export class ConditionApiError extends Error {
  readonly status: number;

  constructor(operation: string, status: number, body: ErrorResponse | undefined) {
    super(`${operation} 실패 (HTTP ${status}): ${body?.message ?? "오류 본문 없음"}`);
    this.name = "ConditionApiError";
    this.status = status;
  }
}

/**
 * 한 사이트가 제시하는 직군들.
 *
 * **직군의 어휘는 사이트마다 다르다** — 같은 이름이 양쪽에 있기도 하고(실측: 68개 중 8개),
 * 한쪽에만 있는 이름도 많다. 어느 사이트의 말인지를 지우면 고르는 사람이 그 차이를 볼 수
 * 없으므로, 화면도 계약과 같은 단위로 제시한다.
 */
export interface JobCategoryGroup {
  site: string;
  categories: string[];
}

/** 직군 하나를 가리키는 좌표 — 계약의 `CategoryQuery`와 같은 모양. */
export interface SiteCategory {
  site: string;
  categoryName: string;
}

/** 서로 대체 가능한 기술스택 표기의 묶음 — 계약의 `skillNames` 안쪽 배열(OR)이 이것이다. */
export interface SkillGroup {
  /** 후보로 제시할 때의 대표 표기 */
  defaultName: string;
  names: string[];
}

/** 한 회사가 사이트마다 다른 이름으로 올라와 있을 수 있다 — 계약의 `SiteCompanyQuery`와 같은 모양. */
export interface SiteCompany {
  site: string;
  companyName: string;
}

/** 회사 검색이 제시하는 후보 하나. 고르면 그 회사의 사이트별 이름이 통째로 조건이 된다. */
export interface CompanyCandidate {
  defaultName: string;
  siteCompanies: SiteCompany[];
}

export async function listJobCategoryGroups(): Promise<JobCategoryGroup[]> {
  const { data, error, response } = await api.GET("/categories");
  if (error !== undefined) {
    throw new ConditionApiError("직군 목록 조회", response.status, error);
  }

  // **이름순으로 세운다.** 계약이 주는 순서는 안정적이지 않다(실측: 같은 응답이 호출마다
  // 다른 순서로 온다) — 그대로 그리면 새로 고칠 때마다 버튼이 자리를 바꿔, 화면에서
  // 무엇을 어디서 봤는지 기억할 수 없게 된다.
  return (data.categoriesBySite ?? [])
    .flatMap((bySite) =>
      bySite.site === undefined
        ? []
        : [
            {
              site: bySite.site,
              categories: [...(bySite.categories ?? [])].sort((left, right) =>
                left.localeCompare(right, "ko"),
              ),
            },
          ],
    )
    .sort((left, right) => left.site.localeCompare(right.site));
}

/**
 * 서버가 이 어휘를 붙들어 두는 시간 (ops-workflow#76).
 *
 * 원천은 하루 한 번만 돈다(`posting-skillscanner` — 매일 19:39). 그러니 길게 잡을수록
 * composer 호출은 줄지만, **스캔 직후의 오염 창**이 그만큼 넓어진다: 그 창 안에 처음 온
 * 사람은 어제 어휘를 받고 자기 브라우저 캐시에 하루를 붙든다. 줄어드는 쪽은 DB 질의 몇 백 번,
 * 넓어지는 쪽은 하루짜리 틀린 어휘라 대칭이 아니다.
 *
 * 그래서 서버 캐시의 몫을 **동시 미스 흡수**로만 한정한다 — 그 목적은 5분이면 이미 다 이룬다.
 * 이 값의 수명을 책임지는 것은 계약이 선언한 브라우저의 하루다.
 */
const SKILL_CACHE_SECONDS = 300;

export async function listSkillGroups(): Promise<SkillGroup[]> {
  const { data, error, response } = await api.GET("/skills", {
    // 호출별 오버라이드다 — 클라이언트 전역에 걸면 목록·상세·스크랩까지 함께 캐시된다.
    // 이 호출은 토큰이 실리지 않아(비로그인) 사용자별로 갈리지 않는다 — 공유해도 되는 이유다.
    fetch: (request) => fetch(request, { next: { revalidate: SKILL_CACHE_SECONDS } }),
  });
  if (error !== undefined) {
    throw new ConditionApiError("기술스택 목록 조회", response.status, error);
  }

  return (data.skills ?? []).flatMap((skill) => {
    const names = skill.skillNames ?? [];
    const defaultName = skill.defaultName ?? names[0];
    // 표기가 하나도 없는 묶음은 고를 수도, 조건으로 걸 수도 없다.
    return defaultName === undefined || names.length === 0
      ? []
      : [{ defaultName, names }];
  });
}

/**
 * 원천의 검색이 실제로 받아 주는 검색어로 다듬는다.
 *
 * 회사 이름에는 괄호로 묶인 병기가 붙는다(`원프레딕트(onepredict)`). 그런데 원천은 이름을
 * **괄호에서 끊어 색인한다** — 실측: `원프레딕트`도 `onepredict`도 찾히지만 화면에 보이는
 * 전체 이름으로는 하나도 안 나오고, 짝이 맞지 않는 괄호(`인핸스(`)는 500을 낸다.
 *
 * 사용자가 넣는 검색어는 **화면에서 본 이름**이다. 그것으로 못 찾는 검색은 검색이 아니므로,
 * 묻기 전에 첫 토막만 남긴다. 계약이 정하지 않는 원천의 사정이라 여기서 흡수한다.
 */
function searchableKeyword(keyword: string): string {
  const [head] = keyword.split(/[(){}[\]]/);
  return (head ?? "").trim();
}

/** 계약: 회사명 prefix 검색. 빈 검색어는 400이므로 부르기 전에 걸러낸다. */
export async function searchCompanies(
  rawKeyword: string,
): Promise<CompanyCandidate[]> {
  const keyword = searchableKeyword(rawKeyword);
  if (keyword === "") {
    return [];
  }

  const { data, error, response } = await api.GET("/companies", {
    params: { query: { keyword } },
  });
  if (error !== undefined) {
    throw new ConditionApiError("회사 검색", response.status, error);
  }

  return (data.companies ?? []).flatMap((company) => {
    const siteCompanies = (company.siteCompanies ?? []).flatMap((siteCompany) =>
      siteCompany.site === undefined || siteCompany.companyName === undefined
        ? []
        : [{ site: siteCompany.site, companyName: siteCompany.companyName }],
    );
    const defaultName = company.defaultName ?? siteCompanies[0]?.companyName;
    return defaultName === undefined || siteCompanies.length === 0
      ? []
      : [{ defaultName, siteCompanies }];
  });
}
