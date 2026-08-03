import { test as base } from "@playwright/test";

import type { JourneyDriver } from "./driver";
import type { WiringOptions } from "./options";
import { createLegacyDriver } from "../wiring/legacy";
import { createNextDriver } from "../wiring/next";
import { withRouteGate } from "./route-gate";

interface JourneyFixtures {
  /** 시나리오가 앱을 만지는 유일한 통로. 어느 앱인지는 project가 정한다. */
  app: JourneyDriver;
}

export const test = base.extend<WiringOptions & JourneyFixtures>({
  wiring: ["legacy", { option: true }],

  app: async ({ page, wiring }, use) => {
    const create = wiring === "legacy" ? createLegacyDriver : createNextDriver;
    // 라우트가 어긋난 호출은 배선에 닿기 전에 여기서 막힌다.
    await use(withRouteGate(create(page)));
  },
});

export { expect } from "@playwright/test";
