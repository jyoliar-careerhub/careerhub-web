import { decodeBase64Url, encodeBase64Url } from "./base64url";
import { issuerConfig, SCOPES } from "./config";

import type { IssuedTokens } from "./session";

/**
 * OIDC 왕복 — Authorization Code + PKCE의 **표준 리다이렉트** 흐름.
 *
 * 레거시가 하던 것(`rel="opener"` 새 탭 · `postMessage(…, "*")` · origin 미검증 수신)을
 * 쓰지 않는다 — ADR-0028 Consequences가 지목한 재작성 대상이다. 브라우저는 그냥 발급자에게
 * 갔다가 콜백으로 돌아오고, code 교환은 **Next 서버가** 한다.
 *
 * 왕복의 방어 셋을 여기서 세운다: PKCE(code_verifier) · state · nonce.
 * ADR-0028 Context가 레거시에 "PKCE·nonce·유효한 state 방어가 없다"고 적은 그 셋이다.
 */

/** 브라우저를 거쳐 돌아오는 값들의 원본. 이 셋은 봉인 쿠키에만 산다. */
export interface LoginTransaction {
  state: string;
  nonce: string;
  /** PKCE. 이 값이 새면 code 가로채기 방어가 무너지므로 브라우저에 평문으로 두지 않는다. */
  verifier: string;
  createdAt: number;
}

export function randomToken(bytes = 32): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function newLoginTransaction(): LoginTransaction {
  return {
    state: randomToken(),
    nonce: randomToken(),
    verifier: randomToken(),
    createdAt: Date.now(),
  };
}

/** PKCE S256 — challenge는 verifier의 SHA-256이다. */
async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return encodeBase64Url(new Uint8Array(digest));
}

/**
 * 로그인 진입점이 가리키는 곳 — 발급자의 authorize endpoint다.
 *
 * **앱 밖으로 나가는 절대 URL이어야 한다.** 로그인 화면은 이 URL을 그대로 앵커에 싣고,
 * e2e 명세가 "인증 제공자는 앱 밖에 있다"를 그 앵커의 origin으로 확인한다 (ops-workflow#9).
 */
export async function authorizeUrl(
  transaction: LoginTransaction,
): Promise<string> {
  const config = issuerConfig();
  const url = new URL(config.authorizeEndpoint);

  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state: transaction.state,
    nonce: transaction.nonce,
    code_challenge: await codeChallenge(transaction.verifier),
    code_challenge_method: "S256",
  }).toString();

  return url.toString();
}

/** 발급자가 code를 거절했다 — 콜백을 로그인 실패로 끝내야 한다. */
export class AuthorizationError extends Error {
  constructor(reason: string) {
    super(`인증 실패: ${reason}`);
    this.name = "AuthorizationError";
  }
}

interface TokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  id_token?: unknown;
  expires_in?: unknown;
  error?: unknown;
  error_description?: unknown;
}

/**
 * id_token이 실어 온 nonce.
 *
 * id_token은 TLS로 token endpoint에서 직접 받았다 — 서명 검증은 프론트의 일이 아니고
 * (ADR-0029), 여기서 보는 것은 이 응답이 우리가 시작한 왕복의 것인지뿐이다.
 *
 * 읽히지 않으면 `null`이 아니라 던진다. `null`을 돌려주면 "nonce가 없는 id_token"과
 * "nonce가 다른 id_token"이 같은 실패로 뭉개져, 방어가 왜 걸렸는지 로그가 말하지 못한다.
 */
function nonceOf(idToken: string): string {
  const payload = idToken.split(".")[1];
  const decoded = payload === undefined ? null : decodeBase64Url(payload);
  if (decoded === null) {
    throw new AuthorizationError("id_token이 JWT가 아니다");
  }

  let claims: unknown;
  try {
    claims = JSON.parse(new TextDecoder().decode(decoded));
  } catch {
    throw new AuthorizationError("id_token payload가 JSON이 아니다");
  }

  const nonce =
    typeof claims === "object" && claims !== null
      ? (claims as Record<string, unknown>)["nonce"]
      : undefined;
  if (typeof nonce !== "string") {
    throw new AuthorizationError("id_token에 nonce가 없다 — 왕복을 확인할 수 없다");
  }
  return nonce;
}

/**
 * code를 토큰으로 바꾼다. **Next 서버가 한다** — 브라우저는 code만 실어 나른다.
 *
 * @throws {AuthorizationError} 발급자가 거절했거나 nonce가 어긋났을 때
 */
export async function exchangeCode(
  code: string,
  transaction: LoginTransaction,
): Promise<IssuedTokens> {
  const config = issuerConfig();

  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    // authorize 때와 문자 그대로 같아야 한다 — 규격이 요구하는 재확인이다.
    redirect_uri: config.redirectUri,
    code_verifier: transaction.verifier,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (config.clientSecret === null) {
    form.set("client_id", config.clientId);
  } else {
    headers.Authorization = `Basic ${btoa(
      `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`,
    )}`;
  }

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers,
    body: form,
    cache: "no-store",
  });

  let body: TokenResponse = {};
  try {
    body = (await response.json()) as TokenResponse;
  } catch {
    // 아래 상태 코드 분기가 말해준다.
  }

  if (!response.ok) {
    const reason =
      typeof body.error_description === "string"
        ? body.error_description
        : typeof body.error === "string"
          ? body.error
          : `HTTP ${response.status}`;
    throw new AuthorizationError(reason);
  }

  const accessToken = body.access_token;
  if (typeof accessToken !== "string" || accessToken === "") {
    throw new AuthorizationError("토큰 응답에 access_token이 없다");
  }

  // `openid` scope를 요청했으므로 id_token은 반드시 온다. 없는데 그냥 넘어가면
  // nonce 방어가 조용히 꺼진 채로 로그인이 성공한다 — 방어가 사라진 줄도 모르게 된다.
  if (typeof body.id_token !== "string" || body.id_token === "") {
    throw new AuthorizationError("토큰 응답에 id_token이 없다 (openid scope를 요청했다)");
  }
  if (nonceOf(body.id_token) !== transaction.nonce) {
    throw new AuthorizationError("nonce 불일치 — 우리가 시작한 왕복이 아니다");
  }

  const refreshToken = body.refresh_token;
  const expiresIn = body.expires_in;

  return {
    accessToken,
    refreshToken: typeof refreshToken === "string" && refreshToken !== "" ? refreshToken : null,
    expiresInSeconds: typeof expiresIn === "number" ? expiresIn : null,
  };
}

/**
 * RP-initiated logout — 발급자 쪽 세션까지 끊는다. 레거시에는 로그아웃 endpoint 자체가 없었다.
 *
 * `id_token_hint` 대신 `client_id`를 쓴다 — Zitadel이 둘 중 하나로 `post_logout_redirect_uri`를
 * 검증하므로, id_token을 저장하지 않아도 되고 그만큼 세션 쿠키가 작아진다.
 */
export function logoutUrl(): string {
  const config = issuerConfig();
  const url = new URL(config.endSessionEndpoint);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
  }).toString();
  return url.toString();
}
