/**
 * 저장 매체의 포트 — **토큰 원문이 사는 유일한 타입**이다.
 *
 * 이 인터페이스가 "무엇을 저장하는가"만 말하고 "어디에 저장하는가"는 말하지 않는 것이
 * 축 D(토큰 저장)를 나중에 다시 고를 수 있게 하는 이음매다 (ops-workflow#8).
 * 구현을 고르는 지점은 `./index.ts` 하나뿐이므로, 매체를 바꿔도 이 모듈 밖은 물론
 * 모듈 안의 다른 파일도 바뀌지 않는다.
 */

/** 저장되는 세션. 클레임은 여기 담지 않는다 — access token에서 파생하므로 사본이 될 뿐이다. */
export interface StoredSession {
  accessToken: string;
  /**
   * Zitadel은 갱신 시 refresh token을 회전시킬 수 있다 — 회전된 값을 저장하는 것이
   * 이 모듈의 책임이다. 레거시가 정확히 이걸 빠뜨렸다(`careerhub-front/src/httputils.js:140`은
   * 갱신 응답에서 accessToken만 저장한다).
   */
  refreshToken: string | null;
  /** access token 만료 시각(epoch ms). 발급 응답이 말해주지 않으면 `null`. */
  expiresAt: number | null;
}

/**
 * 저장 매체.
 *
 * 전부 비동기다 — 서버 측 저장(D1)이 기본 형상이고 그쪽 API(`next/headers`의 `cookies()`)가
 * 비동기이기 때문이다. 클라이언트 저장(D0)으로 후퇴해도 동기 API를 비동기로 감싸면 되므로
 * 이 형상은 D0을 배제하지 않는다.
 */
export interface SessionStore {
  read(): Promise<StoredSession | null>;
  write(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}
