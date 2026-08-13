import { issuerConfig } from "./config";

import type { StoredSession } from "./store";

/**
 * 갱신 — 발급자(Zitadel)의 token endpoint 상대다.
 *
 * **회전된 refresh token까지 다시 담아 돌려주는 것이 이 파일의 요점이다.** Zitadel은 갱신 시
 * refresh token을 회전시킬 수 있고, 새 값을 저장하지 않으면 다음 갱신이 죽는다.
 * 레거시가 정확히 그 결함을 갖고 있다 (`careerhub-front/src/httputils.js:140`).
 *
 * 401 반응형 갱신·수제 single-flight는 복제하지 않는다 — 서버 측에서 도는 코드라
 * 요청 하나가 자기 갱신을 끝내면 되고, 전역 대기열이 필요했던 브라우저 사정이 없다.
 */

/** 갱신이 거절됐다 — 세션이 끝났다는 뜻이다. 전송 실패(재시도 가능)와 구분한다. */
export class RefreshRejectedError extends Error {
  constructor(reason: string) {
    super(`토큰 갱신 거절: ${reason}`);
    this.name = "RefreshRejectedError";
  }
}

interface TokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  error?: unknown;
}

function toStoredSession(body: TokenResponse, previous: string): StoredSession {
  const accessToken = body.access_token;
  if (typeof accessToken !== "string" || accessToken === "") {
    throw new Error("토큰 갱신 응답에 access_token이 없다.");
  }

  // 회전이 없으면 응답이 refresh_token을 **빼고** 온다 — 그때는 쓰던 값이 계속 유효하다.
  // 반면 실려 왔는데 문자열이 아니면 계약 위반이다. 그것을 "회전 없음"으로 뭉개면
  // 다음 갱신에 죽은 토큰을 보내고, 사용자에게는 원인 모를 로그아웃으로 보인다.
  const rotated = body.refresh_token;
  if (rotated !== undefined && (typeof rotated !== "string" || rotated === "")) {
    throw new Error("토큰 갱신 응답의 refresh_token이 비어 있거나 문자열이 아니다");
  }

  const expiresIn = body.expires_in;

  return {
    accessToken,
    refreshToken: rotated ?? previous,
    // `expires_in`이 없어도 만료를 잃지 않는다 — 토큰의 `exp`가 있다(claims.ts).
    expiresAt: typeof expiresIn === "number" ? Date.now() + expiresIn * 1000 : null,
  };
}

/**
 * refresh token 하나를 새 세션으로 바꾼다. 저장은 하지 않는다 — 부르는 쪽(`session.ts`)이
 * 저장까지 한 묶음으로 처리한다.
 *
 * @throws {RefreshRejectedError} 발급자가 refresh token을 거절했을 때(세션 종료)
 */
export async function exchangeRefreshToken(
  refreshToken: string,
): Promise<StoredSession> {
  const { tokenEndpoint, clientId, clientSecret } = issuerConfig();

  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret === null) {
    form.set("client_id", clientId);
  } else {
    headers.Authorization = `Basic ${btoa(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`)}`;
  }

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers,
    body: form,
    // 갱신은 캐시될 수 있는 종류의 요청이 아니다.
    cache: "no-store",
  });

  let body: TokenResponse = {};
  try {
    body = (await response.json()) as TokenResponse;
  } catch {
    // 본문이 JSON이 아니면 아래 상태 코드 분기가 말해준다.
  }

  if (!response.ok) {
    const reason = typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
    // OAuth 2.0에서 죽은 grant는 400 + invalid_grant다. 그 밖의 실패는 발급자 쪽 사정이므로
    // 세션을 지우지 않고 올려 보낸다 — 일시적 장애로 로그아웃시키지 않기 위해서다.
    if (response.status >= 400 && response.status < 500) {
      throw new RefreshRejectedError(reason);
    }
    throw new Error(`토큰 갱신 실패: ${reason}`);
  }

  return toStoredSession(body, refreshToken);
}
