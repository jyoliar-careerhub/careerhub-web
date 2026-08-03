import { expect, test } from "../support/fixtures";

/**
 * 라우트 `/login` — 로그인 진입.
 *
 * **여정은 "인증 수단이 제시된다"까지다.** 인증 제공자 화면으로 넘어간 뒤는 앱 밖이고,
 * 로그인 완료가 필요한 인증 라우트들은 이 티켓이 아니다(비-OAuth 로그인 경로 뒤에 별도로 다룬다).
 */
test("로그인 화면은 인증 수단 진입점을 제시한다", async ({ app }) => {
  await app.visit("login");

  await expect.poll(() => app.currentRoute()).toBe("login");

  await expect
    .poll(async () => (await app.login.authEntryPoints()).length, {
      message: "인증 수단 진입점이 하나 이상 제시된다",
    })
    .toBeGreaterThan(0);

  for (const entryPoint of await app.login.authEntryPoints()) {
    expect(
      entryPoint.external,
      "인증 제공자는 앱 밖에 있다 — 진입점은 앱 밖으로 나간다",
    ).toBe(true);
  }
});
