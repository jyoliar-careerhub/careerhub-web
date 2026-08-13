import { serverCookieStore } from "./server-cookie";

import type { SessionStore } from "./types";

/**
 * **저장 매체를 고르는 유일한 지점.**
 *
 * 축 D를 다시 고를 때 바뀌는 코드는 이 파일의 한 줄과 새 구현 파일뿐이다 —
 * 모듈 밖은 물론, 모듈 안의 세션·갱신·클레임 코드도 손대지 않는다 (ops-workflow#8).
 *
 * 지금은 D1(서버 측 저장). D0(브라우저 JS 저장)으로의 후퇴는 `SessionStore` 구현을
 * 하나 더 두고 여기서 그것을 가리키면 끝난다.
 */
export const sessionStore: SessionStore = serverCookieStore;

export type { SessionStore, StoredSession } from "./types";
