import { decodeClaims, effectiveAuthorities } from "./claims";
import { exchangeRefreshToken, RefreshRejectedError } from "./refresh";
import { sessionStore } from "./store";

import type { Authority, SessionClaims } from "./claims";
import type { StoredSession } from "./store";

/**
 * 세션의 읽기·쓰기·갱신 — 토큰 문자열이 이 모듈 밖으로 나가지 않게 하는 자리다.
 *
 * 밖에서 볼 수 있는 것은 두 가지뿐이다: 클레임(무엇이 참인가)과, 부착 이음매가 쓰는
 * access token(누가 부르는지는 `./attach.ts` 하나다). 화면·컴포넌트는 토큰 값을 만지지 않는다
 * (ops-workflow#8).
 */

/**
 * 만료 직전을 만료로 친다 — 요청이 발급자에게 닿는 사이에 늙어 죽는 토큰을 피한다.
 * 401을 보고 나서 갱신하는 레거시의 반응형 흐름을 복제하지 않는 이유이기도 하다.
 */
const EXPIRY_MARGIN_MS = 30_000;

/** 로그인 흐름이 code 교환으로 받아온 것. 저장 형태로 옮기는 것은 이 모듈의 일이다. */
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string | null;
  /** 발급 응답의 `expires_in`. 없으면 `null` — 그때는 토큰의 `exp`로 판단한다. */
  expiresInSeconds: number | null;
}

function expiryOf(session: StoredSession): number | null {
  return session.expiresAt ?? decodeClaims(session.accessToken)?.expiresAt ?? null;
}

function isExpiring(session: StoredSession): boolean {
  const expiresAt = expiryOf(session);
  // 만료를 알 수 없으면 살아 있다고 본다 — 모른다는 이유로 매 요청 갱신하지 않는다.
  return expiresAt !== null && expiresAt - EXPIRY_MARGIN_MS <= Date.now();
}

async function renew(session: StoredSession): Promise<StoredSession | null> {
  if (session.refreshToken === null) {
    await sessionStore.clear();
    return null;
  }

  try {
    const renewed = await exchangeRefreshToken(session.refreshToken);
    // 회전된 refresh token이 여기서 저장된다 — 갱신과 저장이 갈라지지 않는 것이 요점이다.
    await sessionStore.write(renewed);
    return renewed;
  } catch (error) {
    if (error instanceof RefreshRejectedError) {
      await sessionStore.clear();
      return null;
    }
    // 발급자 쪽 일시 장애로 세션을 지우지 않는다 — 부르는 쪽이 실패를 보게 둔다.
    throw error;
  }
}

/** 지금 유효한 세션. 필요하면 갱신까지 마치고 돌려준다. */
async function currentSession(): Promise<StoredSession | null> {
  const stored = await sessionStore.read();
  if (stored === null) {
    return null;
  }
  return isExpiring(stored) ? await renew(stored) : stored;
}

/** 로그인이 끝난 뒤 세션을 연다. */
export async function startSession(issued: IssuedTokens): Promise<void> {
  await sessionStore.write({
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    expiresAt:
      issued.expiresInSeconds === null
        ? null
        : Date.now() + issued.expiresInSeconds * 1000,
  });
}

/**
 * 세션을 닫는다 — 저장된 것을 지운다.
 *
 * 발급자 쪽 세션 종료(RP-initiated logout)는 이 함수가 아니라 로그아웃 흐름의 일이다.
 */
export async function endSession(): Promise<void> {
  await sessionStore.clear();
}

/**
 * 지금 세션의 access token. 없으면 `null`.
 *
 * **부착 이음매(`./attach.ts`)를 위한 것이다** — 화면·컴포넌트는 이 값이 아니라 클레임을 본다.
 */
export async function getAccessToken(): Promise<string | null> {
  return (await currentSession())?.accessToken ?? null;
}

/** 지금 세션이 말하는 사실. 로그인 상태·권한 판단은 전부 여기서 나온다 (ADR-0031). */
export async function getSessionClaims(): Promise<SessionClaims | null> {
  const session = await currentSession();
  return session === null ? null : decodeClaims(session.accessToken);
}

/**
 * 지금 유효한 권한. 클레임은 발급 시점 스냅샷이므로, 액세스 토큰 수명 안에서 만료되는
 * 항목은 여기서 걸러진다(발급 훅 계약이 `expiresAt`을 동봉하는 이유다).
 */
export async function getAuthorities(): Promise<readonly Authority[]> {
  const claims = await getSessionClaims();
  return claims === null ? [] : effectiveAuthorities(claims);
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getSessionClaims()) !== null;
}

/**
 * 만료를 기다리지 않고 지금 갱신한다.
 *
 * 클레임은 발급 시점 스냅샷이므로(ADR-0031), 권한 부여·동의 완료 직후처럼 인가 상태가 바뀐
 * 순간에 갱신을 걸어야 화면이 새 사실을 본다.
 *
 * @returns 갱신 후에도 세션이 살아 있으면 `true`
 */
export async function refreshSession(): Promise<boolean> {
  const stored = await sessionStore.read();
  if (stored === null) {
    return false;
  }
  return (await renew(stored)) !== null;
}
