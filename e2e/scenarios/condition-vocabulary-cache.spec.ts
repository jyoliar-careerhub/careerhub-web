import { expect, test } from "../support/fixtures";
import { offerCandidates, openJobPostingList } from "../support/steps";

/**
 * 기술스택 어휘를 앱이 **몇 번 받아 오는가** (ops-workflow#76).
 *
 * 다른 명세와 결이 하나 다르다: 여기서 묻는 것은 화면에 그려진 것이 아니라 **화면 뒤의 트래픽**이다.
 * 캐시는 드러나지 않는 것이 목적이라 화면에게 물어서는 볼 수 없어서, 관찰을 드라이버의
 * `skillVocabularyTraffic` 하나로 격리해 뒀다.
 *
 * 이 성질이 규율인 이유: 기술스택 어휘는 전체 한 벌(수백 묶음·수십 KB)을 받아 두고 브라우저가
 * 거르는 구조다. 그래서 계약이 이 응답에 하루 캐시를 선언했고, 앱은 그 선언을 지나가는 자리마다
 * 보존해야 한다. 지키지 못하면 조건을 만질 때마다 같은 수십 KB가 다시 흐르는데,
 * **화면은 똑같아 보인다** — 타입도 린트도 다른 명세도 이 회귀를 못 잡는다.
 *
 * 관찰을 제공하지 않는 앱에서는 건너뛴다 — 빨간 실패가 아니라 "이 앱에서는 명세하지 않는다"다.
 * 그 판단의 근거는 배선이 내는 `null`이고, 시나리오는 자기가 어느 앱을 겨누는지 알지 못한다.
 */
test.describe("조건 어휘 트래픽", () => {
  test("기술스택 어휘는 다시 열어도 다시 받아 오지 않는다", async ({ app }) => {
    const traffic = app.skillVocabularyTraffic;
    test.skip(traffic === null, "이 앱은 어휘 트래픽 관찰을 제공하지 않는다");
    // 위에서 이미 멈췄다 — 타입을 좁히기 위한 줄이다.
    if (traffic === null) return;

    // 검색어는 명세가 아는 값이 아니다 — 목록에 나온 공고가 말하는 기술스택을 되쓴다.
    let keyword: string | undefined;

    const first = await traffic.networkFetchesDuring(async () => {
      const postings = await openJobPostingList(app);
      const found = postings.flatMap((posting) => posting.skills)[0];
      // 전제 판정은 관찰 밖에서 한다 — 여기서 멈추면 관찰이 닫히지 않는다.
      if (found === undefined) return;
      keyword = found;
      await offerCandidates(app.jobPostingList.skillSearch, keyword);
    });

    test.skip(
      keyword === undefined,
      "전제 미충족: 목록의 공고가 기술스택을 말하지 않는다",
    );
    if (keyword === undefined) return;
    // 클로저 안으로 좁힌 타입을 들고 들어가려면 다시 묶어야 한다.
    const skill: string = keyword;

    // 처음에는 받아 온다 — 안 받아 왔다면 어휘의 원천이 바뀐 것이라 이 명세의 전제가 깨진다.
    expect(first, "처음 열 때는 어휘를 받아 온다").toBeGreaterThan(0);

    const again = await traffic.networkFetchesDuring(async () => {
      // 새로고침이 아니라 **나갔다 다시 온다** — 새로고침은 하위자원을 재검증하므로
      // 캐시가 제 일을 하는지 볼 수 없다.
      await app.visit("home");
      await openJobPostingList(app);
      await offerCandidates(app.jobPostingList.skillSearch, skill);
    });

    expect(again, "다시 열면 어휘를 다시 받아 오지 않는다").toBe(0);
  });
});
