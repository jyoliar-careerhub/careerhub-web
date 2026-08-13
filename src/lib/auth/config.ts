/**
 * 발급자(Zitadel)의 좌표 — 갱신이 누구에게 말하는지를 정하는 값들이다.
 *
 * 전부 `NEXT_PUBLIC_` 없는 서버 전용 env다. D1에서 토큰을 아는 것은 프론트 서버뿐이므로
 * 클라이언트 번들에 실릴 이유가 없다 (ops-workflow#8).
 *
 * 값을 어디서 주입하는지(배포 매니페스트·로컬 `.env`)는 로그인 흐름을 세우는 티켓의 것이다
 * (ops-workflow#59). 여기서는 없을 때 조용히 넘어가지 않는 것만 지킨다.
 */

export interface IssuerConfig {
  /** 토큰 endpoint. 기본값은 Zitadel의 고정 경로다 (`{issuer}/oauth/v2/token`). */
  tokenEndpoint: string;
  clientId: string;
  /**
   * Next 서버가 code 교환을 수행하므로 confidential client 구성이 가능하다 —
   * 공개 클라이언트(PKCE만)로 두면 `null`.
   */
  clientSecret: string | null;
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `인증 설정 누락: ${name} — 발급자 좌표 없이는 토큰을 갱신할 수 없다.`,
    );
  }
  return value;
}

export function issuerConfig(): IssuerConfig {
  const issuer = required("ZITADEL_ISSUER").replace(/\/+$/, "");
  const secret = process.env.ZITADEL_CLIENT_SECRET;

  return {
    tokenEndpoint:
      process.env.ZITADEL_TOKEN_ENDPOINT ?? `${issuer}/oauth/v2/token`,
    clientId: required("ZITADEL_CLIENT_ID"),
    clientSecret: secret === undefined || secret === "" ? null : secret,
  };
}
