import { expect, test } from "../support/fixtures";
import {
  EMPTY_QUERY,
  MIN_POSTINGS_FOR_PAGINATION,
  MIN_REVIEWS_FOR_PAGINATION,
  encodeQuery,
  writePreconditionData,
} from "../support/preconditions";

/**
 * 데이터 전제 검사 — 시나리오보다 **먼저** 돈다(project dependency).
 *
 * 여기가 빨간불이면 시나리오는 아예 실행되지 않고 "의존 실패"로 보고된다.
 * 그래서 **전제 미충족과 앱 회귀가 같은 신호로 보이지 않는다** (ops-workflow#9 AC).
 *
 * 검사하는 것은 **존재**뿐이다. "그 조건으로 좁히면 결과가 나오는가"는 묻지 않는다 —
 * 공고가 실제로 달고 있는 값으로 좁혔는데 결과가 비면 그건 데이터 부족이 아니라 앱·백엔드 결함이고,
 * 시나리오가 실패하는 것이 옳다.
 *
 * 묻는 곳은 **공고 목록 하나**다. 검색 카탈로그(`/skills`·`/companies`)는 기존 앱이 자동완성을
 * 그리는 방식이지 데이터의 사정이 아니므로 여기서 알 바가 아니다 — 그 사정은 배선이 감당한다.
 */

interface Posting {
  site: string;
  postingId: string;
  title: string;
  companyName: string;
  minCareer?: number | null;
  skills?: string[] | null;
  reviewInfo?: { reviewCount: number; isCompleteCrawl: boolean } | null;
}

const SAMPLE_SIZE = 50;

function reviewCountOf(posting: Posting): number {
  return posting.reviewInfo?.reviewCount ?? 0;
}

test("데이터 전제 — 시나리오가 요구하는 데이터가 실제로 존재한다", async ({
  request,
  apiBaseURL,
  wiring,
}) => {
  const sample = await test.step("공고 표본을 읽는다", async () => {
    const response = await request.get(
      `${apiBaseURL}/job_postings?page=1&size=${SAMPLE_SIZE}&encoded_query=${encodeQuery(EMPTY_QUERY)}`,
    );
    expect(response.ok(), "백엔드가 공고 목록 질의에 응답한다").toBeTruthy();
    return (await response.json()) as Posting[];
  });

  await test.step("공고가 존재한다", () => {
    expect(sample.length, "전제: 공고가 1건 이상 있다").toBeGreaterThan(0);
  });

  await test.step("목록이 두 페이지 이상 나온다", () => {
    expect(
      sample.length,
      `전제: 페이지네이션 여정이 성립하려면 공고가 ${MIN_POSTINGS_FOR_PAGINATION}건보다 많아야 한다`,
    ).toBeGreaterThan(MIN_POSTINGS_FOR_PAGINATION);
  });

  await test.step("검색에 쓸 정보를 공고가 담고 있다", () => {
    // 값 자체는 시나리오가 목록 화면에서 읽는다 — 여기서는 그런 공고가 있는지만 본다.
    expect(
      sample.some((posting) => (posting.skills ?? []).length > 0),
      "전제: 기술스택을 가진 공고가 1건 이상 있다",
    ).toBe(true);
    expect(
      sample.some((posting) => posting.companyName.length > 0),
      "전제: 회사명을 가진 공고가 1건 이상 있다",
    ).toBe(true);
  });

  const filterableMinCareer = await test.step(
    "경력을 요구하는 공고가 있다",
    () => {
      const years = sample
        .map((posting) => posting.minCareer ?? 0)
        .find((value) => value > 0);
      if (years === undefined) {
        throw new Error("전제 미충족: 경력을 요구하는 공고가 없다");
      }
      return years;
    },
  );

  const postingWithReviews = await test.step(
    "리뷰가 달린 회사의 공고가 있다",
    () => {
      const found = sample.find((posting) => reviewCountOf(posting) > 0);
      if (!found) {
        throw new Error(
          `전제 미충족: 표본 ${SAMPLE_SIZE}건 안에 리뷰가 달린 회사의 공고가 없다`,
        );
      }
      return { site: found.site, postingId: found.postingId };
    },
  );

  const postingWithPagedReviews = await test.step(
    "리뷰가 두 페이지 이상인 공고가 있다",
    () => {
      // 여유를 최대로 두려고 가장 많은 것을 고른다. 수집이 끝나야 리뷰 목록이 완결된다.
      const [found] = sample
        .filter((posting) => posting.reviewInfo?.isCompleteCrawl === true)
        .sort((left, right) => reviewCountOf(right) - reviewCountOf(left));

      if (!found || reviewCountOf(found) <= MIN_REVIEWS_FOR_PAGINATION) {
        throw new Error(
          `전제 미충족: 표본 ${SAMPLE_SIZE}건 안에 리뷰가 ${MIN_REVIEWS_FOR_PAGINATION}개보다 많고 수집이 끝난 회사의 공고가 없다`,
        );
      }
      return { site: found.site, postingId: found.postingId };
    },
  );

  writePreconditionData(wiring, {
    filterableMinCareer,
    postingWithReviews,
    postingWithPagedReviews,
  });
});
