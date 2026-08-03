import { defineConfig, devices } from "@playwright/test";

import type { WiringName, WiringOptions } from "./e2e/support/options";

/**
 * e2e 명세 — 시나리오 한 벌이 두 배선(기존 앱 · 새 앱)을 겨눈다 (ops-workflow#9).
 *
 * 명세는 환경을 모른다: 대상 URL과 데이터 원천은 전부 env로 들어온다.
 * 전제 검사(`*:preconditions`)는 여정의 dependency다 — 전제가 깨지면 여정은 실행되지 않고
 * "의존 실패"로 드러나므로, 앱 회귀와 같은 신호로 보이지 않는다.
 *
 * 결정적 데이터가 없는 동안 이 명세는 **차단 게이트가 될 수 없다** — 빨간불이 앱 회귀인지
 * 데이터 변동인지 구분되지 않기 때문이다. 그래서 G1(PR 게이트)에 얹지 않는다.
 */

const LEGACY_BASE_URL =
  process.env.LEGACY_BASE_URL ?? "https://careerhub.jyo-liar.com";
/** 새 앱은 아직 겨눌 실체가 없다 — 주어질 때만 project가 실린다. */
const NEXT_BASE_URL = process.env.NEXT_BASE_URL;
/** 데이터 전제를 묻는 곳. 두 앱이 같은 백엔드를 본다. */
const API_BASE_URL = process.env.API_BASE_URL ?? `${LEGACY_BASE_URL}/api`;

function targetProjects(wiring: WiringName, baseURL: string) {
  const shared = {
    ...devices["Desktop Chrome"],
    baseURL,
    apiBaseURL: API_BASE_URL,
    wiring,
  };

  return [
    {
      name: `${wiring}:preconditions`,
      testDir: "./e2e/preconditions",
      use: shared,
    },
    {
      name: wiring,
      testDir: "./e2e/scenarios",
      dependencies: [`${wiring}:preconditions`],
      use: shared,
    },
  ];
}

export default defineConfig<WiringOptions>({
  testDir: "./e2e",
  fullyParallel: true,
  // 겨누는 것이 실환경이다 — 앱 스스로 "지나치게 많은 api 호출 시 일시적으로 차단될 수 있다"고
  // 경고한다. 병렬을 낮게 잡아 대상 서비스를 두드리지 않는다.
  workers: 2,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure",
  },
  projects: [
    ...targetProjects("legacy", LEGACY_BASE_URL),
    ...(NEXT_BASE_URL ? targetProjects("next", NEXT_BASE_URL) : []),
  ],
});
