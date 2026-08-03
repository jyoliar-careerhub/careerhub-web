import { expect } from "@playwright/test";

import type { JourneyDriver, ListedJobPosting } from "./driver";

/**
 * 여러 여정이 같은 자리에서 시작한다 — 목록을 열고, 공고가 나열되기를 기다린다.
 *
 * 목록이 끝내 비어 있으면 **실패**다(앱 회귀이거나 데이터가 통째로 없는 것).
 * 더 세밀한 데이터 전제(기술스택을 말하는 공고가 있는가 등)는 각 시나리오가
 * `test.skip`으로 다루므로 실패와 구분된다.
 */
export async function openJobPostingList(
  app: JourneyDriver,
): Promise<ListedJobPosting[]> {
  await app.visit("jobPostings");

  await expect
    .poll(async () => (await app.jobPostingList.listedJobPostings()).length, {
      message: "목록에 공고가 하나 이상 나열된다",
    })
    .toBeGreaterThan(0);

  return app.jobPostingList.listedJobPostings();
}
