import { listSkillGroups } from "@/lib/api/conditions";

import { serveConditions } from "../serve";

/** 계약이 `/skills`에 선언한 캐시 수명 — 하루. */
const MAX_AGE_SECONDS = 86400;

/**
 * 기술스택 어휘 전체.
 *
 * 후보를 거르는 일은 브라우저가 한다(`skill-search.tsx`) — 여기는 한 벌을 통째로 내줄 뿐이다.
 * 그 전체 한 벌이 32KB이므로 캐시 수명을 그대로 실어 보내는 것이 중요하다.
 */
export async function GET(): Promise<Response> {
  return serveConditions("기술스택 목록 조회", listSkillGroups, MAX_AGE_SECONDS);
}
