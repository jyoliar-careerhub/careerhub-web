import { setAccessTokenProvider } from "@/lib/api/client";

import { getAccessToken } from "./session";

/**
 * 부착 — REST 호출에 토큰이 실리는 유일한 경로다.
 *
 * `setAccessTokenProvider`는 계약이 정하지 않는 것("토큰을 어디서 얻는가")을 채우려고
 * `src/lib/api/client.ts`가 열어 둔 이음매다. **그 이음매를 채우는 것은 이 모듈뿐이다** —
 * 린트가 다른 파일의 import를 거부한다 (ops-workflow#8).
 *
 * 공급자는 프로세스 전역에 하나지만 `getAccessToken()`이 읽는 저장은 요청 범위다
 * (D1에서는 `next/headers` — 요청별 컨텍스트). 그래서 전역 하나로 동시 요청이 섞이지 않는다.
 */

let installed = false;

/** 여러 번 불려도 한 번만 심는다 — 어느 진입점에서 불러도 안전하게. */
export function installAccessTokenProvider(): void {
  if (installed) {
    return;
  }
  installed = true;
  setAccessTokenProvider(getAccessToken);
}
