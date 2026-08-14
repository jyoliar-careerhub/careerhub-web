import { redirect } from "next/navigation";

import { AuthorizationError, completeLogin } from "@/lib/auth";

/**
 * 발급자가 돌려보내는 착지점 — Zitadel에 등록된 redirect URI가 이 경로다.
 *
 * 브라우저가 실어 오는 것은 `code`와 `state`뿐이다. 토큰 교환은 여기(서버)에서 일어나고,
 * 토큰은 브라우저에 닿지 않는다 — 레거시가 `postMessage`로 토큰 자체를 창 사이로 던지던
 * 것과 갈리는 지점이다(ADR-0028 Consequences).
 */
export async function GET(request: Request): Promise<never> {
  const params = new URL(request.url).searchParams;

  try {
    await completeLogin(params);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      // 실패의 상세를 주소에 싣지 않는다 — 화면은 "안 됐다"만 말하고, 원인은 서버 로그에 남는다.
      console.warn(`로그인 콜백 실패: ${error.message}`);
      redirect("/login?error=1");
    }
    throw error;
  }

  redirect("/my");
}
