import type { CompanyCandidate, SkillGroup } from "./conditions";

/**
 * 조건 어휘를 **브라우저가** 받는 경로 — 상대는 언제나 web 호스트 하나다 (ops-workflow#76).
 *
 * 짝은 `./conditions`(같은 일을 서버에서, composer를 상대로)이고 둘의 경계는 누가 부르느냐다:
 * api-composer는 내부 전용이라 그 주소를 아는 것은 Next 서버뿐이다. 그래서 브라우저 코드는
 * `./conditions`를 **값으로 부르지 않는다** — 부르는 순간 composer 주소가 클라이언트 번들에 실린다.
 * 모양(타입)만 그쪽에서 오고, 여기서 다시 내보내 화면이 서버 모듈을 이름조차 부르지 않게 한다.
 *
 * 다듬는 일(옵셔널 제거·정렬·검색어 손질)은 저쪽에서 이미 끝났다. 여기 남는 것은 "어디에
 * 묻는가"와 "못 받았을 때 무엇인가"뿐이다.
 */

export type { CompanyCandidate, SiteCompany, SkillGroup } from "./conditions";

const CONDITIONS_PATH = "/api/conditions";

/**
 * 상대가 우리 자신이라 계약 타입 생성물(ADR-0014)이 걸리는 경계가 아니다 — 내는 쪽
 * (`src/app/api/conditions/`)과 받는 쪽이 같은 타입 하나를 본다.
 */
async function getConditions<T>(path: string, operation: string): Promise<T> {
  const response = await fetch(`${CONDITIONS_PATH}${path}`);
  if (!response.ok) {
    throw new Error(`${operation} 실패 (HTTP ${response.status})`);
  }
  return (await response.json()) as T;
}

export function fetchSkillGroups(): Promise<SkillGroup[]> {
  return getConditions<SkillGroup[]>("/skills", "기술스택 목록 조회");
}

export function fetchCompanyCandidates(
  keyword: string,
): Promise<CompanyCandidate[]> {
  const query = new URLSearchParams({ keyword });
  return getConditions<CompanyCandidate[]>(
    `/companies?${query.toString()}`,
    "회사 검색",
  );
}
