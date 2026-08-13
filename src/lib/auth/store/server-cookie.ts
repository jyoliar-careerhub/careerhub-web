import { cookies } from "next/headers";

import { secureCookies } from "../config";
import { seal, unseal } from "../seal";

import type { SessionStore, StoredSession } from "./types";

/**
 * D1 — 프론트 서버(Next)가 굽는 암호화 HttpOnly 쿠키.
 *
 * 축 D의 수렴이 고른 매체다(`careerhub-front/discussion/260722_1617` §11):
 * Next가 토큰을 봉인해 HttpOnly 쿠키로 심고, 서버에서 꺼내 `Authorization` 헤더로 바꿔
 * api-composer를 부른다. **브라우저 JS는 토큰 문자열에 도달할 수 없다.**
 *
 * 쓰기(`set`·`delete`)는 Route Handler·Server Function에서만 가능하다 — Server Component
 * 렌더 중에는 응답 헤더가 이미 흐르기 시작해 `Set-Cookie`를 붙일 수 없다. 그래서 세션을
 * 여닫는 일은 전부 `/auth/*` Route Handler에 산다.
 */

/**
 * 쿠키 이름. `__Host-` 접두는 쓰지 않는다 — 그 접두는 `Secure`를 강제하는데,
 * 검증용 개발기(http://localhost)에서 쿠키가 통째로 사라진다.
 */
const COOKIE_NAME = "careerhub_session";

/**
 * 쿠키 하나의 실질 한계는 4KB다. 넘으면 브라우저가 조용히 버려 "로그인이 안 되는" 모양이
 * 되므로, 조용히 넘어가지 않고 경고를 남긴다 — 저장 판정 재개봉의 신호이기도 하다
 * (ops-workflow#59 Requirements: 토큰 크기 실측).
 */
const COOKIE_LIMIT_BYTES = 4096;

function warnIfOversized(sealed: string): void {
  // 이름·속성까지 합쳐 한계를 먹으므로 여유를 두고 본다.
  const size = new TextEncoder().encode(sealed).byteLength;
  if (size + COOKIE_NAME.length + 128 > COOKIE_LIMIT_BYTES) {
    console.warn(
      `세션 쿠키가 4KB 한계에 닿는다 (봉인 후 ${size}B) — 토큰 저장 판정의 재개봉 사유다 (ops-workflow#59).`,
    );
  }
}

export const serverCookieStore: SessionStore = {
  async read(): Promise<StoredSession | null> {
    const cookie = (await cookies()).get(COOKIE_NAME);
    if (cookie === undefined) {
      return null;
    }
    return await unseal<StoredSession>(cookie.value);
  },

  async write(session: StoredSession): Promise<void> {
    const sealed = await seal(session);
    warnIfOversized(sealed);

    (await cookies()).set(COOKIE_NAME, sealed, {
      httpOnly: true,
      secure: secureCookies(),
      // 쿠키 자동 첨부로 옮긴 대가가 CSRF 표면이다 — Lax가 그 첫 층이고,
      // 상태 변경 요청의 오리진 검증이 짝이다(ops-workflow#59 Technical Notes).
      sameSite: "lax",
      path: "/",
    });
  },

  async clear(): Promise<void> {
    (await cookies()).delete(COOKIE_NAME);
  },
};

/** 실측 보고용 — 지금 세션 쿠키가 몇 바이트인가. 없으면 `null`. */
export async function sessionCookieBytes(): Promise<number | null> {
  const cookie = (await cookies()).get(COOKIE_NAME);
  return cookie === undefined
    ? null
    : new TextEncoder().encode(cookie.value).byteLength;
}
