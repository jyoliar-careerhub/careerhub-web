import { redirect } from "next/navigation";

import { openLogin } from "@/lib/auth";

/**
 * 로그인 왕복을 여는 자리 — **쿠키를 심을 수 있는 유일한 종류의 자리**다.
 *
 * Server Component 렌더 중에는 `Set-Cookie`를 붙일 수 없다(응답 헤더가 이미 흐른다).
 * 그래서 로그인 화면은 진행 중인 왕복이 없으면 여기로 보내고, 여기서 state·nonce·PKCE를
 * 심은 뒤 화면으로 되돌린다.
 *
 * 여기서 발급자로 바로 보내지 않는 이유: 진입점이 **앱 밖을 가리키는 앵커**여야 한다.
 * 이 라우트로 보내는 앵커는 같은 오리진이라 "인증 제공자는 앱 밖에 있다"는 e2e 명세의
 * 확인을 통과하지 못한다 (ops-workflow#9).
 */
export async function GET(request: Request): Promise<never> {
  // 왕복을 열어 두면 화면이 그것으로 authorize URL을 만든다. 여기서 만든 URL 자체는
  // 쓰지 않지만, 여는 행위(쿠키 심기)가 이 라우트의 존재 이유다.
  await openLogin();

  const returnTo = new URL(request.url).searchParams.get("return");
  // 오픈 리다이렉트를 만들지 않는다 — 앱 안의 경로만 받는다.
  const safe = returnTo !== null && returnTo.startsWith("/") && !returnTo.startsWith("//");
  redirect(safe ? returnTo : "/login");
}
