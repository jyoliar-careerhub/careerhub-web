import { redirect } from "next/navigation";

import { openLogout } from "@/lib/auth";

/**
 * 로그아웃 — 우리 세션을 지우고 발급자의 end_session으로 보낸다.
 *
 * **POST다.** 쿠키 자동 첨부로 옮긴 순간 이 앱은 CSRF에 노출되고(`260722_1617` §5:
 * "오늘 이 앱은 CSRF에 구조적으로 면역이다 — 쿠키로 옮기면 그 면역이 사라진다"),
 * 상태를 바꾸는 요청은 그 표면 위에 선다. GET 링크로 두면 남의 페이지에 심긴
 * `<img src>` 하나로 로그아웃당한다.
 *
 * 방어는 두 겹이다 — 세션 쿠키의 `SameSite=Lax`가 cross-site POST에 쿠키를 싣지 않고,
 * 아래 오리진 검사가 그것을 앱 층에서 한 번 더 확인한다.
 */
export async function POST(request: Request): Promise<never> {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get("origin");

  if (origin !== null && origin !== expected) {
    console.warn(`로그아웃 거부 — 다른 오리진에서 왔다: ${origin}`);
    redirect("/");
  }

  redirect(await openLogout());
}
