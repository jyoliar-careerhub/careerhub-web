import { test as base } from "@playwright/test";

import type { JourneyDriver } from "./driver";
import type { WiringOptions } from "./options";
import { createLegacyDriver } from "../wiring/legacy";
import { createNextDriver } from "../wiring/next";
import { readPreconditionData, type PreconditionData } from "./preconditions";

interface JourneyFixtures {
  /** 시나리오가 앱을 만지는 유일한 통로. 어느 앱인지는 project가 정한다. */
  app: JourneyDriver;
  /** 전제 검사가 실데이터에서 발견해 둔 값들. */
  data: PreconditionData;
}

export const test = base.extend<WiringOptions & JourneyFixtures>({
  wiring: ["legacy", { option: true }],
  apiBaseURL: ["", { option: true }],

  app: async ({ page, wiring }, use) => {
    const create = wiring === "legacy" ? createLegacyDriver : createNextDriver;
    await use(create(page));
  },

  data: async ({ wiring }, use) => {
    const data = readPreconditionData(wiring);
    if (!data) {
      throw new Error(
        `데이터 전제가 확인되지 않았다 — '${wiring}:preconditions' project를 먼저 돌린다.`,
      );
    }
    await use(data);
  },
});

export { expect } from "@playwright/test";
