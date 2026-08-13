import type { SessionStore, StoredSession } from "./types";

/**
 * D1 — 프론트 서버(Next)가 굽는 암호화 HttpOnly 쿠키.
 *
 * 축 D의 수렴이 첫 구현 대상으로 고른 매체다(`careerhub-front/discussion/260722_1617` §11):
 * Next 라우트 핸들러가 토큰을 HttpOnly 쿠키로 심고, 서버에서 꺼내 `Authorization` 헤더로
 * 바꿔 api-composer를 부른다. 브라우저 JS는 토큰 문자열에 도달할 수 없다.
 *
 * **아직 채우지 않는다 — 쿠키의 이름·속성·봉인(암호화) 방식과 그 배선은 로그인 흐름을
 * 짓는 티켓의 것이다 (ops-workflow#59).** 이 티켓(ops-workflow#8)이 지는 것은 모듈의 형상,
 * 곧 "저장이 이 포트 뒤에 있다"는 사실까지다.
 */

function notImplemented(what: string): never {
  throw new Error(
    `세션 저장 미구현: ${what} — 암호화 HttpOnly 쿠키 배선은 로그인 흐름 티켓이 채운다 (jyoliar-lab/ops-workflow#59).`,
  );
}

export const serverCookieStore: SessionStore = {
  async read(): Promise<StoredSession | null> {
    return notImplemented("read");
  },

  async write(): Promise<void> {
    notImplemented("write");
  },

  async clear(): Promise<void> {
    notImplemented("clear");
  },
};
