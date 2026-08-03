/** 어느 앱을 겨누는가. 시나리오는 이 값을 모르고, 배선 선택에만 쓰인다. */
export type WiringName = "legacy" | "next";

/**
 * project별로 주는 옵션.
 *
 * 명세는 환경을 모른다 — 대상 URL(`baseURL`)과 데이터 원천(`apiBaseURL`)은
 * 전부 여기서 파라미터로 들어온다 (ops-workflow#9 Requirements).
 */
export interface WiringOptions {
  wiring: WiringName;
  /** 데이터 전제를 확인할 때 묻는 곳. 앱이 아니라 백엔드 좌표다. */
  apiBaseURL: string;
}
