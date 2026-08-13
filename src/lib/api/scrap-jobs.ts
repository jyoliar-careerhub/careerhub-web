import { api } from "./client";

import type { components } from "./schema";

/**
 * 스크랩 목록 — **인증이 필요한 호출**이다. 계약 타입은 생성물에서만 온다 (ADR-0014).
 *
 * 토큰을 여기서 다루지 않는다는 점이 요점이다. `api` 클라이언트에 심긴 공급자가
 * `Authorization` 헤더를 채우고(ops-workflow#8), 그 공급자는 인증 모듈만 심는다.
 * 이 파일은 토큰의 존재조차 모른다.
 *
 * D1에서 토큰을 아는 것은 Next 서버뿐이므로, 이 호출은 **서버에서** 일어나야 한다.
 */

export type ScrapJob = components["schemas"]["ScrapJob"];
type ErrorResponse = components["schemas"]["ErrorResponse"];

export class UnauthorizedError extends Error {
  constructor() {
    super("인증이 필요한 요청인데 토큰이 없거나 유효하지 않다");
    this.name = "UnauthorizedError";
  }
}

export class ScrapApiError extends Error {
  readonly status: number;

  constructor(status: number, body: ErrorResponse | undefined) {
    super(`스크랩 목록 조회 실패 (HTTP ${status}): ${body?.message ?? "오류 본문 없음"}`);
    this.name = "ScrapApiError";
    this.status = status;
  }
}

export async function listScrapJobs(): Promise<ScrapJob[]> {
  const { data, error, response } = await api.GET("/my/scrap-job");
  if (error !== undefined) {
    if (response.status === 401) {
      throw new UnauthorizedError();
    }
    throw new ScrapApiError(response.status, error);
  }
  return data;
}
