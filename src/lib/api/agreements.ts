import { authLedgerApi } from "./client";

import type { components } from "./auth-ledger-schema";

/**
 * 약관 동의 — 온보딩 게이트의 원장 접점이다 (ops-workflow#54).
 *
 * **여기서 게이트를 판정하지 않는다.** 온보딩으로 보낼지는 클레임
 * (`careerhub:agreements_fulfilled`)이 정하고(사람 판정, 260818 — 조회 왕복 폐기),
 * 이 모듈은 온보딩 화면에 들어온 뒤의 수집만 진다: 무엇에 동의해야 하는지(조회)와
 * 동의의 기록(제출).
 *
 * 계약 타입은 생성물에서만 온다(ADR-0014). 토큰은 `authLedgerApi`에 심긴 공급자가
 * 붙인다(ops-workflow#8) — 이 파일은 토큰의 존재를 모르고, D1에서 토큰을 아는 것은
 * Next 서버뿐이므로 이 호출은 서버에서 일어난다.
 */

export type AgreementStatus = components["schemas"]["AgreementStatus"];
export type AgreementApply = components["schemas"]["AgreementApply"];
type ErrorResponse = components["schemas"]["ErrorResponse"];

export class AgreementUnauthorizedError extends Error {
  constructor() {
    super("인증이 필요한 요청인데 토큰이 없거나 유효하지 않다");
    this.name = "AgreementUnauthorizedError";
  }
}

export class AgreementApiError extends Error {
  readonly status: number;

  constructor(action: string, status: number, body: ErrorResponse | undefined) {
    super(`약관 동의 ${action} 실패 (HTTP ${status}): ${body?.message ?? "오류 본문 없음"}`);
    this.name = "AgreementApiError";
    this.status = status;
  }
}

/** 약관 카탈로그와 내 동의 현황 — `priority` 오름차순으로 온다(계약 선언). */
export async function listAgreements(): Promise<AgreementStatus[]> {
  const { data, error, response } = await authLedgerApi.GET("/auth/agreement");
  if (error !== undefined) {
    if (response.status === 401) {
      throw new AgreementUnauthorizedError();
    }
    throw new AgreementApiError("조회", response.status, error);
  }
  return data.agreements;
}

/**
 * 동의·거절의 기록. 반영은 **다음 토큰 발급부터다**(발급 시점 스냅샷 · ADR-0031) —
 * 그래서 부르는 쪽이 성공 직후 세션 갱신(`refreshSession`)까지 이어야 한다.
 */
export async function applyAgreements(agreements: AgreementApply[]): Promise<void> {
  const { error, response } = await authLedgerApi.POST("/auth/agreement", {
    body: { agreements },
  });
  if (error !== undefined) {
    if (response.status === 401) {
      throw new AgreementUnauthorizedError();
    }
    throw new AgreementApiError("제출", response.status, error);
  }
}
