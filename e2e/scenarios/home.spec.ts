import { expect, test } from "../support/fixtures";

/**
 * 라우트 `/` — 홈.
 *
 * 기존 앱의 홈은 화면이 아니라 공고 목록으로 가는 통로다. 그 통로 자체가 명세 대상이고,
 * 어떻게 도달시키는지(리다이렉트인지 다른 방법인지)는 배선이 흡수한다.
 */
test("홈으로 들어가면 공고 목록에 도달한다", async ({ app }) => {
  await app.visit("home");

  await expect
    .poll(() => app.currentRoute(), {
      message: "홈 진입은 공고 목록 라우트로 이어진다",
    })
    .toBe("jobPostings");
});
