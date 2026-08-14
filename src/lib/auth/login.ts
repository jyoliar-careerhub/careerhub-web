import {
  closeLoginTransaction,
  openLoginTransaction,
  readLoginTransaction,
} from "./login-transaction";
import { AuthorizationError, authorizeUrl, exchangeCode, logoutUrl } from "./oidc";
import { endSession, startSession } from "./session";

/**
 * 로그인·로그아웃의 흐름 — 라우트가 부르는 얇은 표면이다.
 *
 * 라우트는 HTTP만 알고(어디로 리다이렉트하는가), 무엇이 참인지는 전부 여기서 판정한다.
 * 토큰은 이 파일에도 머무르지 않는다 — 교환 결과는 곧장 세션 저장으로 넘어간다
 * (ops-workflow#8: 토큰 값은 모듈 밖으로 나가지 않는다).
 */

/**
 * 왕복을 열고 발급자로 보낼 URL을 만든다 — `/auth/start`가 부른다.
 *
 * 쿠키를 심어야 하므로 Route Handler에서만 성립한다.
 */
export async function openLogin(): Promise<string> {
  return await authorizeUrl(await openLoginTransaction());
}

/**
 * 로그인 화면이 앵커에 실을 URL. 진행 중인 왕복이 없으면 `null` — 화면은 그때
 * `/auth/start`로 보내 왕복을 열게 한다.
 */
export async function loginEntryUrl(): Promise<string | null> {
  const transaction = await readLoginTransaction();
  return transaction === null ? null : await authorizeUrl(transaction);
}

/**
 * 콜백을 세션으로 바꾼다 — `/auth/callback`이 부른다.
 *
 * 성공하든 실패하든 왕복은 닫는다. 한 번 쓴 state·verifier가 남아 재사용되면
 * 방어가 방어가 아니게 된다.
 *
 * @throws {AuthorizationError}
 */
export async function completeLogin(params: URLSearchParams): Promise<void> {
  const transaction = await readLoginTransaction();
  await closeLoginTransaction();

  const error = params.get("error");
  if (error !== null) {
    throw new AuthorizationError(params.get("error_description") ?? error);
  }

  if (transaction === null) {
    throw new AuthorizationError("진행 중인 로그인 왕복이 없다(만료됐거나 시작되지 않았다)");
  }

  // state 검사 — 이 콜백이 **우리가 시작한** 왕복의 것인지 본다.
  // 레거시에 없던 방어이고(ADR-0028 Context), 없으면 남이 시작한 로그인을 떠안게 된다.
  if (params.get("state") !== transaction.state) {
    throw new AuthorizationError("state 불일치 — 우리가 시작한 왕복이 아니다");
  }

  const code = params.get("code");
  if (code === null || code === "") {
    throw new AuthorizationError("콜백에 code가 없다");
  }

  await startSession(await exchangeCode(code, transaction));
}

/**
 * 로그아웃 — 우리 세션을 지우고, 발급자 쪽 세션을 끊을 URL을 돌려준다.
 *
 * 둘 다 필요하다. 우리 쿠키만 지우면 발급자 세션이 살아 있어 다음 로그인이 화면 없이
 * 즉시 통과한다 — 사용자가 기대하는 로그아웃이 아니다.
 */
export async function openLogout(): Promise<string> {
  await endSession();
  await closeLoginTransaction();
  return logoutUrl();
}
