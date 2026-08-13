import { cookies } from "next/headers";

import { secureCookies } from "./config";
import { newLoginTransaction } from "./oidc";
import { seal, unseal } from "./seal";

import type { LoginTransaction } from "./oidc";

/**
 * 진행 중인 로그인 왕복의 상태 — state·nonce·PKCE verifier.
 *
 * **브라우저에 맡기되, 읽을 수는 없게 한다.** 봉인된 HttpOnly 쿠키라 값은 서버만 만들고
 * 서버만 읽는다. 레거시가 "로그인 대기 상태를 만료 없는 암호화 봉투로 브라우저에 맡긴"
 * 것과 갈리는 지점은 둘이다 — 그 봉투는 JS가 읽을 수 있었고, **만료가 없었다**
 * (ADR-0028 Context). 여기서는 짧은 수명을 붙인다.
 */

const COOKIE_NAME = "careerhub_login";

/** 사용자가 발급자 화면에 머무는 시간. 넉넉하되 무기한은 아니다. */
const TTL_MS = 10 * 60 * 1000;

/**
 * 새 왕복을 연다. Route Handler에서만 부를 수 있다 — Server Component 렌더 중에는
 * `Set-Cookie`를 붙일 수 없기 때문이고, 그것이 `/auth/start`가 존재하는 이유다.
 */
export async function openLoginTransaction(): Promise<LoginTransaction> {
  const transaction = newLoginTransaction();

  (await cookies()).set(COOKIE_NAME, await seal(transaction), {
    httpOnly: true,
    secure: secureCookies(),
    // 발급자에서 콜백으로 **되돌아올 때** 쿠키가 실려야 한다 — 그 이동은 cross-site
    // top-level GET이라 Strict면 쿠키가 빠진다. Lax가 이 흐름의 하한이다.
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });

  return transaction;
}

/** 진행 중인 왕복. 없거나 만료됐으면 `null`. */
export async function readLoginTransaction(): Promise<LoginTransaction | null> {
  const cookie = (await cookies()).get(COOKIE_NAME);
  if (cookie === undefined) {
    return null;
  }

  const transaction = await unseal<LoginTransaction>(cookie.value);
  if (transaction === null) {
    return null;
  }
  // 쿠키 maxAge와 별개로 값 자체의 나이를 본다 — 쿠키 속성은 브라우저의 선의에 달렸다.
  return Date.now() - transaction.createdAt > TTL_MS ? null : transaction;
}

/** 왕복이 끝났다(성공이든 실패든) — 한 번 쓴 state·verifier를 남겨 두지 않는다. */
export async function closeLoginTransaction(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
