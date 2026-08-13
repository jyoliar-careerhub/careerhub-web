import { decodeBase64Url as decodeBase64 } from "./base64url";

/**
 * 발급자(Zitadel)의 좌표와 이 앱의 로그인 배선 설정.
 *
 * 전부 `NEXT_PUBLIC_` 없는 서버 전용 env다. D1에서 토큰을 아는 것은 프론트 서버뿐이고,
 * authorize URL을 조립하는 것도 서버이므로 클라이언트 번들에 실릴 이유가 없다.
 *
 * endpoint 경로는 Zitadel의 고정 관례다 — discovery를 요청 경로에 두지 않는다(ADR-0029의
 * "데이터 경로에 원격 확인을 두지 않는다"와 같은 방향). 제품이 경로를 바꾸면 env로 덮는다.
 */

export interface IssuerConfig {
  authorizeEndpoint: string;
  tokenEndpoint: string;
  endSessionEndpoint: string;
  clientId: string;
  /**
   * Zitadel의 careerhub-web 앱은 public client로 선언돼 있다
   * (`OIDC_APP_TYPE_USER_AGENT` · `OIDC_AUTH_METHOD_TYPE_NONE`) — 그때 `null`이다.
   * confidential로 바꾸면 값이 생기고 갱신·교환이 Basic 인증을 쓴다.
   */
  clientSecret: string | null;
  redirectUri: string;
  postLogoutRedirectUri: string;
}

/**
 * 요청하는 scope.
 *
 * `offline_access`가 refresh token을 부른다 — 갱신은 #8 모듈의 책임이고 회전된 값까지
 * 그쪽이 저장한다. 권한 클레임은 scope가 아니라 발급 훅이 싣는다(ADR-0031).
 */
export const SCOPES = ["openid", "profile", "email", "offline_access"] as const;

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`인증 설정 누락: ${name}`);
  }
  return value;
}

export function issuerConfig(): IssuerConfig {
  const issuer = required("ZITADEL_ISSUER").replace(/\/+$/, "");
  // 앱이 자기 공개 주소를 아는 것은 배포 설정이다 — redirect URI가 여기서 파생한다.
  const appOrigin = required("AUTH_APP_ORIGIN").replace(/\/+$/, "");
  const secret = process.env.ZITADEL_CLIENT_SECRET;

  return {
    authorizeEndpoint:
      process.env.ZITADEL_AUTHORIZE_ENDPOINT ?? `${issuer}/oauth/v2/authorize`,
    tokenEndpoint:
      process.env.ZITADEL_TOKEN_ENDPOINT ?? `${issuer}/oauth/v2/token`,
    endSessionEndpoint:
      process.env.ZITADEL_END_SESSION_ENDPOINT ?? `${issuer}/oidc/v1/end_session`,
    clientId: required("ZITADEL_CLIENT_ID"),
    clientSecret: secret === undefined || secret === "" ? null : secret,
    // Zitadel에 등록된 값과 **문자 그대로 같아야** 한다 — 교환 때도 같은 값을 다시 보낸다.
    redirectUri: `${appOrigin}/auth/callback`,
    postLogoutRedirectUri: `${appOrigin}/`,
  };
}

/**
 * 쿠키 봉인 키 — 32바이트를 base64로. D1의 "암호화 HttpOnly 쿠키"가 이 키 위에 선다.
 *
 * 생성: `openssl rand -base64 32`
 */
export function cookieSecret(): Uint8Array<ArrayBuffer> {
  const bytes = decodeBase64(required("AUTH_COOKIE_SECRET"));
  if (bytes === null || bytes.byteLength !== 32) {
    throw new Error(
      `AUTH_COOKIE_SECRET은 base64로 인코딩된 32바이트여야 한다 (지금 ${bytes?.byteLength ?? "해독 불가"}).`,
    );
  }
  return bytes;
}

/** 개발기(http://localhost)에서는 Secure 쿠키를 쓸 수 없다. */
export function secureCookies(): boolean {
  return required("AUTH_APP_ORIGIN").startsWith("https://");
}
