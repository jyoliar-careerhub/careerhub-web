import { expect } from "@playwright/test";

import type {
  ConditionSearch,
  JourneyDriver,
  ListedJobPosting,
} from "./driver";

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

/**
 * 검색어를 넣고 제시된 후보를 받는다.
 *
 * 후보는 곧바로 나오지 않을 수 있다(앱이 뒤에서 찾아온다) — 나올 때까지 기다린다.
 * 검색어는 언제나 **목록이 알려준 값**이므로, 후보가 끝내 없으면 그건 데이터 전제가 아니라
 * "화면이 말한 것을 그 화면의 검색이 못 찾는다"는 회귀다. 그래서 실패로 둔다.
 */
export async function offerCandidates(
  search: ConditionSearch,
  keyword: string,
): Promise<string[]> {
  await search.type(keyword);

  await expect
    .poll(async () => (await search.candidates()).length, {
      message: "검색어를 넣으면 고를 수 있는 후보가 제시된다",
    })
    .toBeGreaterThan(0);

  return search.candidates();
}

/**
 * 검색어를 넣고, 제시된 후보 중 하나를 골라 조건으로 건다. 고른 후보의 표기를 돌려준다.
 *
 * 사용자는 **자기가 넣은 것**을 고른다 — 같은 표기의 후보가 있으면 그것을 고르고,
 * 앱이 표기를 달리 그리면(비슷한 이름을 묶어 보여주는 등) 맨 앞의 것을 고른다.
 */
export async function searchAndChoose(
  search: ConditionSearch,
  keyword: string,
): Promise<string> {
  const candidates = await offerCandidates(search, keyword);
  const chosen =
    candidates.find((candidate) => candidate === keyword) ??
    (candidates[0] as string);

  await search.choose(chosen);
  return chosen;
}
