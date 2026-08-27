import { redirect } from "next/navigation";

import {
  AgreementUnauthorizedError,
  applyAgreements,
  type AgreementApply,
} from "@/lib/api/agreements";
import { getSessionClaims, refreshSession } from "@/lib/auth";

/**
 * 동의 제출 — 기록하고, **세션을 갱신하고**, 원래 가려던 곳으로 보낸다 (ops-workflow#54).
 *
 * 갱신이 이 흐름의 요점이다: 클레임은 발급 시점 스냅샷이라(ADR-0031 Consequences)
 * 동의를 기록해도 들고 있던 토큰은 미충족을 싣고 있다. 여기서 `refreshSession()`을
 * 걸어야 다음 화면의 게이트가 재발급 토큰의 충족을 본다 — "동의 완료 직후 토큰 갱신
 * 트리거를 앱 흐름에 넣는다"(#54 Requirements)가 이 한 줄이다.
 *
 * **POST + 오리진 검사**는 로그아웃 라우트와 같은 CSRF 방어 짝이다 — 쿠키 자동 첨부
 * 위에서 상태를 바꾸는 요청이므로, `SameSite=Lax`에 앱 층의 확인을 겹친다.
 */
export async function POST(request: Request): Promise<never> {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== expected) {
    console.warn(`동의 제출 거부 — 다른 오리진에서 왔다: ${origin}`);
    redirect("/");
  }

  const form = await request.formData();
  const nextValue = form.get("next");
  const next =
    typeof nextValue === "string" && nextValue.startsWith("/") && !nextValue.startsWith("//")
      ? nextValue
      : "/my";
  const retry = `/onboarding?error=apply&next=${encodeURIComponent(next)}`;

  if ((await getSessionClaims()) === null) {
    redirect("/login");
  }

  // 화면이 제시한 전체 목록(offered)을 기준으로 기록한다 — 체크된 것은 동의,
  // 안 된 선택 항목은 명시적 거절이다. 체크박스는 체크된 것만 제출되기 때문에
  // offered 없이는 "거절"과 "제시 안 됨"이 갈리지 않는다.
  const offered = form.getAll("offered").map(String);
  const agreed = new Set(form.getAll("agreed").map(String));
  const applies: AgreementApply[] = offered.map((id) => ({
    agreementId: Number(id),
    isAgree: agreed.has(id),
  }));
  if (applies.length === 0 || applies.some((apply) => !Number.isInteger(apply.agreementId))) {
    // 손대진 폼 — 계약도 어차피 거부한다(minItems·타입). 화면으로 되돌린다.
    redirect(retry);
  }

  // redirect()는 예외로 흐르므로 try 안에서 부르지 않는다 — 실패 갈래만 표시해 두고 밖에서 보낸다.
  let unauthorized = false;
  let failed = false;
  try {
    await applyAgreements(applies);
  } catch (error) {
    if (error instanceof AgreementUnauthorizedError) {
      unauthorized = true;
    } else {
      console.error(error);
      failed = true;
    }
  }
  if (unauthorized) {
    redirect("/login");
  }
  if (failed) {
    redirect(retry);
  }

  // 동의 완료 직후의 토큰 갱신 트리거 — 이 갱신이 성공해야 재발급 토큰이 충족을 싣는다.
  let alive = false;
  try {
    alive = await refreshSession();
  } catch (error) {
    // 발급자 쪽 일시 장애 — 기록은 이미 원장에 남았다. 화면으로 되돌리면 재제출이
    // 같은 기록 위에 멱등으로 얹히고 갱신도 다시 시도된다.
    console.error(error);
    redirect(retry);
  }
  if (!alive) {
    redirect("/login");
  }

  redirect(next);
}
