import createClient, { type Middleware } from "openapi-fetch";

import type { paths } from "./schema";

/**
 * REST 호출 계층 — 계약 타입은 전부 생성물(`./schema`)에서 온다 (ADR-0014).
 * 여기 손으로 쓰는 것은 계약이 정하지 않는 것뿐이다: 어디로 보내는가, 토큰을 어떻게 붙이는가.
 */

/**
 * 계약이 선언하는 인증은 `bearerAuth`(JWT)다. 다만 토큰을 어디서 얻는지는 계약의 관할이 아니므로
 * 부착은 이 미들웨어의 일이고 생성 대상이 아니다.
 */
type AccessTokenProvider = () => string | null | Promise<string | null>;

let provideAccessToken: AccessTokenProvider = () => null;

/** 로그인 계층이 토큰의 출처를 심는다. 심기 전까지 모든 호출은 비로그인으로 나간다. */
export function setAccessTokenProvider(provider: AccessTokenProvider): void {
  provideAccessToken = provider;
}

const bearerAuth: Middleware = {
  async onRequest({ request }) {
    const token = await provideAccessToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
};

/**
 * 계약의 `servers`는 `/` — 배포 환경변수 ROOT_PATH의 prefix 아래에 마운트될 수 있다.
 * 그 prefix를 아는 것은 배포 설정이므로 env로 받는다.
 */
const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/";

export const api = createClient<paths>({ baseUrl });

api.use(bearerAuth);
