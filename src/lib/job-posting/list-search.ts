import type { JobPostingQuery } from "@/lib/api/job-postings";
import type { JobCategory, SiteCompany } from "@/lib/api/conditions";

/**
 * 목록 화면의 상태 — **주소가 전부다.**
 *
 * 걸어 둔 조건도, 보고 있는 페이지도 URL 질의문자열에만 산다. 그래서
 * "다시 열어도 조건이 유지된다"(e2e 불변식)가 규율이 아니라 구조로 성립하고,
 * 서버 컴포넌트가 주소만 읽어 그릴 수 있어 SSR-safe 규율(Epic Scope)이 따라온다.
 * 렌더링 전략을 여기서 정하지 않는 것도 같은 이유다 — 상태가 클라이언트에 고이지 않는다.
 *
 * 질의문자열은 **읽을 수 있게** 둔다(계약의 base64 `encoded_query`를 주소에 그대로 싣지
 * 않는다). 공유·북마크되는 것은 이 주소이고, 계약의 인코딩은 호출 직전에 붙인다.
 */

export const JOB_POSTING_LIST_ROUTE = "/job_posting";

/** 한 페이지에 몇 건인가. 화면이 정하는 값이라 주소에 싣지 않는다. */
export const PAGE_SIZE = 16;

const PARAM_CATEGORY = "category";
const PARAM_SKILL = "skill";
const PARAM_COMPANY = "company";
const PARAM_MIN_CAREER = "minCareer";
const PARAM_MAX_CAREER = "maxCareer";
const PARAM_PAGE = "page";

/** 한 기술스택 묶음 안의 대체 표기들을 잇는다(계약의 안쪽 배열 = OR). 실측: 표기에 `|`가 없다. */
const SKILL_NAME_SEPARATOR = "|";
/** `사이트:회사명`. 사이트 이름에는 `:`가 없으므로 첫 `:`에서 가른다. */
const SITE_SEPARATOR = ":";

/** 화면이 받는 질의문자열의 날것 — Next의 `searchParams`가 주는 모양 그대로. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ListSearch {
  /** 1부터 시작한다(계약의 `page`와 같다). */
  page: number;
  /** 고른 직군 이름들. 사이트로 펼치는 것은 호출 직전의 일이다. */
  categoryNames: string[];
  /** 묶음끼리 AND, 묶음 안은 OR — 계약의 `skillNames` 구조 그대로. */
  skillGroups: string[][];
  companies: SiteCompany[];
  minCareer: number | null;
  maxCareer: number | null;
}

export const EMPTY_SEARCH: ListSearch = {
  page: 1,
  categoryNames: [],
  skillGroups: [],
  companies: [],
  minCareer: null,
  maxCareer: null,
};

function valuesOf(params: RawSearchParams, key: string): string[] {
  const raw = params[key];
  if (raw === undefined) {
    return [];
  }
  return (Array.isArray(raw) ? raw : [raw]).filter((value) => value !== "");
}

function positiveIntOf(params: RawSearchParams, key: string): number | null {
  const raw = valuesOf(params, key)[0];
  if (raw === undefined) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseSiteCompany(raw: string): SiteCompany | null {
  const boundary = raw.indexOf(SITE_SEPARATOR);
  if (boundary <= 0 || boundary === raw.length - 1) {
    return null;
  }
  return {
    site: raw.slice(0, boundary),
    companyName: raw.slice(boundary + 1),
  };
}

function formatSiteCompany(company: SiteCompany): string {
  return `${company.site}${SITE_SEPARATOR}${company.companyName}`;
}

/**
 * 주소를 화면의 상태로 읽는다.
 *
 * 알아볼 수 없는 값은 **조용히 버린다** — 주소는 사람이 손으로 고치거나 낡은 링크로 올 수
 * 있고, 그때 화면이 깨지는 것보다 그 조건 하나가 없는 것이 낫다.
 */
export function parseListSearch(params: RawSearchParams): ListSearch {
  return {
    page: positiveIntOf(params, PARAM_PAGE) ?? 1,
    categoryNames: valuesOf(params, PARAM_CATEGORY),
    skillGroups: valuesOf(params, PARAM_SKILL).map((raw) =>
      raw.split(SKILL_NAME_SEPARATOR).filter((name) => name !== ""),
    ),
    companies: valuesOf(params, PARAM_COMPANY).flatMap((raw) => {
      const company = parseSiteCompany(raw);
      return company === null ? [] : [company];
    }),
    minCareer: positiveIntOf(params, PARAM_MIN_CAREER),
    maxCareer: positiveIntOf(params, PARAM_MAX_CAREER),
  };
}

/** 화면의 상태를 주소로 되돌린다. 링크의 `href`가 되는 것이 이 값이다. */
export function listHref(search: ListSearch): string {
  const params = new URLSearchParams();
  for (const name of search.categoryNames) {
    params.append(PARAM_CATEGORY, name);
  }
  for (const group of search.skillGroups) {
    params.append(PARAM_SKILL, group.join(SKILL_NAME_SEPARATOR));
  }
  for (const company of search.companies) {
    params.append(PARAM_COMPANY, formatSiteCompany(company));
  }
  if (search.minCareer !== null) {
    params.set(PARAM_MIN_CAREER, String(search.minCareer));
  }
  if (search.maxCareer !== null) {
    params.set(PARAM_MAX_CAREER, String(search.maxCareer));
  }
  if (search.page > 1) {
    params.set(PARAM_PAGE, String(search.page));
  }

  const query = params.toString();
  return query === ""
    ? JOB_POSTING_LIST_ROUTE
    : `${JOB_POSTING_LIST_ROUTE}?${query}`;
}

/**
 * 조건이 바뀌면 보던 페이지가 아니라 새 결과의 처음을 본다.
 *
 * 3페이지를 보다가 조건을 좁히면 결과가 2페이지밖에 없을 수 있다 — 그때 3페이지에 남아
 * 있으면 사용자는 빈 화면을 본다. 조건을 바꾸는 모든 길이 이 함수를 지나게 해서
 * 그 규칙을 한 곳에 둔다 (e2e 불변식이기도 하다).
 */
function reset(search: ListSearch): ListSearch {
  return { ...search, page: 1 };
}

export function withPage(search: ListSearch, page: number): ListSearch {
  return { ...search, page };
}

export function withCategoryToggled(
  search: ListSearch,
  name: string,
): ListSearch {
  const selected = search.categoryNames.includes(name);
  return reset({
    ...search,
    categoryNames: selected
      ? search.categoryNames.filter((each) => each !== name)
      : [...search.categoryNames, name],
  });
}

function sameGroup(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((name, index) => name === right[index])
  );
}

export function withSkillGroup(
  search: ListSearch,
  group: string[],
): ListSearch {
  if (search.skillGroups.some((each) => sameGroup(each, group))) {
    return search;
  }
  return reset({ ...search, skillGroups: [...search.skillGroups, group] });
}

function sameCompany(left: SiteCompany, right: SiteCompany): boolean {
  return (
    left.site === right.site && left.companyName === right.companyName
  );
}

/** 회사 하나를 고르면 그 회사의 사이트별 이름이 통째로 걸린다 — 사이트는 수집기의 사정이므로. */
export function withCompanies(
  search: ListSearch,
  companies: SiteCompany[],
): ListSearch {
  const added = companies.filter(
    (company) => !search.companies.some((each) => sameCompany(each, company)),
  );
  if (added.length === 0) {
    return search;
  }
  return reset({ ...search, companies: [...search.companies, ...added] });
}

export function withCareer(
  search: ListSearch,
  career: { min: number | null; max: number | null },
): ListSearch {
  return reset({ ...search, minCareer: career.min, maxCareer: career.max });
}

export function clearedSearch(): ListSearch {
  return EMPTY_SEARCH;
}

export function hasConditions(search: ListSearch): boolean {
  return (
    search.categoryNames.length > 0 ||
    search.skillGroups.length > 0 ||
    search.companies.length > 0 ||
    search.minCareer !== null ||
    search.maxCareer !== null
  );
}

/**
 * 걸어 둔 조건 하나 — 축을 가리지 않고 한 목록으로 본다.
 *
 * *걸린 것이 화면에 드러나고, 하나씩 풀 수 있다*는 것이 검색 화면의 불변식이다.
 * 축마다 다른 모양으로 그리면 그 불변식이 축의 수만큼 흩어진다.
 */
export interface AppliedCondition {
  key: string;
  label: string;
  /** 이 조건만 뺀 검색. 칩의 링크가 여기로 간다. */
  without: ListSearch;
}

function careerLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    return `경력 ${min}~${max}년`;
  }
  if (min !== null) {
    return `경력 ${min}년 이상`;
  }
  return `경력 ${max}년 이하`;
}

export function appliedConditions(search: ListSearch): AppliedCondition[] {
  const conditions: AppliedCondition[] = [];

  for (const name of search.categoryNames) {
    conditions.push({
      key: `${PARAM_CATEGORY}:${name}`,
      label: name,
      without: reset({
        ...search,
        categoryNames: search.categoryNames.filter((each) => each !== name),
      }),
    });
  }

  for (const group of search.skillGroups) {
    conditions.push({
      key: `${PARAM_SKILL}:${group.join(SKILL_NAME_SEPARATOR)}`,
      label: group.join(" / "),
      without: reset({
        ...search,
        skillGroups: search.skillGroups.filter(
          (each) => !sameGroup(each, group),
        ),
      }),
    });
  }

  for (const company of search.companies) {
    conditions.push({
      key: `${PARAM_COMPANY}:${formatSiteCompany(company)}`,
      label: `${company.companyName} (${company.site})`,
      without: reset({
        ...search,
        companies: search.companies.filter(
          (each) => !sameCompany(each, company),
        ),
      }),
    });
  }

  if (search.minCareer !== null || search.maxCareer !== null) {
    conditions.push({
      key: "career",
      label: careerLabel(search.minCareer, search.maxCareer),
      without: reset({ ...search, minCareer: null, maxCareer: null }),
    });
  }

  return conditions;
}

/**
 * 화면의 상태를 계약이 아는 모양으로 옮긴다.
 *
 * 직군은 여기서 사이트별 항목으로 **펼쳐진다** — 계약은 `{site, categoryName}`을 요구하고
 * 그 배열은 OR다(실측). 화면이 이름 하나로 다루는 직군이 두 사이트에 있으면 두 항목이 된다.
 * 비어 있는 축은 아예 싣지 않는다 — 빈 배열과 미지정이 같은 뜻이라 짧은 쪽을 고른다.
 */
export function toApiQuery(
  search: ListSearch,
  categories: JobCategory[],
): JobPostingQuery {
  const sitesByName = new Map(
    categories.map((category) => [category.name, category.sites]),
  );
  const categoryEntries = search.categoryNames.flatMap((name) =>
    (sitesByName.get(name) ?? []).map((site) => ({
      site,
      categoryName: name,
    })),
  );

  const query: JobPostingQuery = {};
  if (categoryEntries.length > 0) {
    query.categories = categoryEntries;
  }
  if (search.skillGroups.length > 0) {
    query.skillNames = search.skillGroups;
  }
  if (search.companies.length > 0) {
    query.companies = search.companies;
  }
  if (search.minCareer !== null) {
    query.minCareer = search.minCareer;
  }
  if (search.maxCareer !== null) {
    query.maxCareer = search.maxCareer;
  }
  return query;
}
