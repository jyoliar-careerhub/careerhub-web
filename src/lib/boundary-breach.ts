import { setAccessTokenProvider } from "@/lib/api/client";

import { decodeClaims } from "./auth/claims";
import { sessionStore } from "./auth/store";

/**
 * 경계 재현 — **되돌릴 파일이다** (jyoliar-lab/ops-workflow#8).
 *
 * "이 규율이 코드에서 확인 가능하다"를 증명하는 유일한 방법은 어기는 코드를 실제로 놓고
 * 게이트가 빨간불을 켜는 것을 보이는 것이다. 저장소가 G1·드리프트 게이트에 대해 한 것과
 * 같은 절차다(`2ae480c`·`466d4eb`·`869ee6e`).
 *
 * 어기는 방식 넷을 한 파일에 모았다:
 *   ① 인증 모듈 내부(`./auth/store`)를 직접 부른다
 *   ② 인증 모듈 내부(`./auth/claims`)에서 토큰을 직접 디코드한다
 *   ③ 부착 이음매를 모듈 밖에서 채운다
 *   ④ 토큰을 브라우저 저장소에 직접 심는다
 */
export async function breach(): Promise<string | null> {
  setAccessTokenProvider(() => "직접 채운 토큰");

  const session = await sessionStore.read();
  if (session === null) {
    return null;
  }

  document.cookie = `access_token=${session.accessToken}`;
  localStorage.setItem("refresh_token", session.refreshToken ?? "");
  window.sessionStorage.setItem("access_token", session.accessToken);

  return decodeClaims(session.accessToken)?.subject ?? null;
}
