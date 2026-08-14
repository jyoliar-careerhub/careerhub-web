import { installAccessTokenProvider } from "./attach";

/**
 * 인증 토큰 접근의 **유일한 공개면** (ops-workflow#8).
 *
 * 토큰의 읽기·쓰기·갱신·첨부, 그리고 토큰을 얻어오는 OIDC 왕복(ops-workflow#59)이 전부
 * 이 디렉터리 안에서 일어난다. 밖에서는 이 파일만 import한다 — `@/lib/auth/...` 로 내부를
 * 직접 부르는 것은 린트가 거부한다(`eslint.config.mjs`).
 * 그 규율이 지켜지는 한 저장 매체(축 D)를 바꾸는 일은 `./store/index.ts` 안의 일이고,
 * 이 모듈 밖의 코드는 한 줄도 바뀌지 않는다.
 *
 * 화면·컴포넌트가 쓰는 것은 클레임 쪽이다 — 토큰 문자열은 `./attach.ts`만 만진다.
 * 권한이 클레임에서 오는 근거는 ADR-0031, 프론트가 토큰을 검증하지 않는 근거는 ADR-0029.
 *
 * import 시점에 부착이 심긴다 — 토큰이 필요한 코드는 어차피 이 모듈을 거치므로,
 * 심는 것을 잊을 자리를 남기지 않는다.
 */
installAccessTokenProvider();

export { installAccessTokenProvider } from "./attach";

export {
  endSession,
  getAuthorities,
  getSessionClaims,
  isAuthenticated,
  refreshSession,
  startSession,
} from "./session";

export { completeLogin, loginEntryUrl, openLogin, openLogout } from "./login";

export { AuthorizationError } from "./oidc";
export { RefreshRejectedError } from "./refresh";

export { sessionCookieBytes } from "./store/server-cookie";

export type { IssuedTokens } from "./session";
export type { Authority, SessionClaims } from "./claims";
