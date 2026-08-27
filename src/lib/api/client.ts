import createClient, { type Middleware } from "openapi-fetch";

import type { paths as authLedgerPaths } from "./auth-ledger-schema";
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
 *
 * **`NEXT_PUBLIC_` 접두가 없는 것이 요점이다** (ops-workflow#76). api-composer는 내부 전용이라
 * 그 주소를 아는 것은 Next 서버뿐이어야 한다 — 접두가 붙는 순간 값이 클라이언트 번들에 실린다.
 * 그래서 이 모듈을 부르는 것도 서버뿐이다: 브라우저가 필요한 것은 `src/app/api/conditions/`의
 * route handler를 거친다.
 */
const baseUrl = process.env.API_BASE_URL ?? "/";

export const api = createClient<paths>({ baseUrl });

api.use(bearerAuth);

/**
 * auth-service(인가 원장)의 클라이언트 — 온보딩 게이트의 동의 수집이 부른다 (ops-workflow#54).
 *
 * composer와 같은 규율이 그대로 선다: 계약 타입은 생성물(`./auth-ledger-schema`)에서,
 * 주소는 서버 전용 env에서(`NEXT_PUBLIC_` 없음 — auth-service도 내부 전용이다),
 * 토큰 부착은 위의 같은 이음매(`bearerAuth`)를 지난다 — 공급자를 심는 곳도 하나다.
 */
const authLedgerBaseUrl = process.env.AUTH_SERVICE_BASE_URL ?? "/";

export const authLedgerApi = createClient<authLedgerPaths>({ baseUrl: authLedgerBaseUrl });

authLedgerApi.use(bearerAuth);
