import { searchCompanies } from "@/lib/api/conditions";

import { serveConditions } from "../serve";

/** 계약이 `/companies`에 선언한 캐시 수명 — 반나절. */
const MAX_AGE_SECONDS = 43200;

/**
 * 회사 후보 — 검색어로 묻는다.
 *
 * 기술스택과 달리 전체를 받아 둘 규모가 아니라 검색어마다 묻는다. 검색어를 원천이 받아 주는
 * 모양으로 다듬는 일은 `@/lib/api/conditions`가 하므로 여기서는 그대로 넘긴다 — 다듬는 규칙이
 * 두 곳에 생기지 않게.
 */
export async function GET(request: Request): Promise<Response> {
  const keyword = new URL(request.url).searchParams.get("keyword") ?? "";
  return serveConditions(
    "회사 검색",
    () => searchCompanies(keyword),
    MAX_AGE_SECONDS,
  );
}
