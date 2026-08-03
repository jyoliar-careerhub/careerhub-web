import { expect, test } from "../support/fixtures";
import {
  EMPTY_QUERY,
  MIN_POSTINGS_FOR_PAGINATION,
  MIN_REVIEWS_FOR_PAGINATION,
  encodeQuery,
  writePreconditionData,
  type PostingQuery,
  type SiteCompany,
} from "../support/preconditions";

/**
 * 데이터 전제 검사 — 시나리오보다 **먼저** 돈다(project dependency).
 *
 * 여기가 빨간불이면 시나리오는 아예 실행되지 않고 "의존 실패"로 보고된다.
 * 그래서 **전제 미충족과 앱 회귀가 같은 신호로 보이지 않는다** (ops-workflow#9 AC).
 *
 * 통제하는 것은 데이터의 *내용*이 아니라 *존재*다. 여기서 발견한 값(기술스택·회사·경력·공고 좌표)은
 * 파일로 넘겨 시나리오가 쓰게 하고, 명세에는 박지 않는다.
 */

interface CountResponse {
  count: number;
}

interface SkillsResponse {
  skills: { defaultName: string; skillNames: string[] }[];
}

interface CompaniesResponse {
  companies: { defaultName: string; siteCompanies: SiteCompany[] }[];
}

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

test("데이터 전제 — 시나리오가 요구하는 데이터가 실제로 존재한다", async ({
  request,
  apiBaseURL,
  wiring,
}) => {
  const countOf = async (query: PostingQuery): Promise<number> => {
    const response = await request.get(
      `${apiBaseURL}/job_postings/count?encoded_query=${encodeQuery(query)}`,
    );
    expect(response.ok(), "백엔드가 공고 수 질의에 응답한다").toBeTruthy();
    return ((await response.json()) as CountResponse).count;
  };

  /** 좁힌 결과가 "비어 있지도, 전체보다 넓지도" 않아야 여정이 성립한다. */
  const expectNarrowing = (narrowed: number, total: number, what: string) => {
    expect(narrowed, `전제: ${what}의 결과가 비어 있지 않다`).toBeGreaterThan(0);
    expect(narrowed, `전제: ${what}가 전체보다 넓지 않다`).toBeLessThanOrEqual(
      total,
    );
  };

  const total = await test.step("공고가 존재한다", async () => {
    const count = await countOf(EMPTY_QUERY);
    expect(count, "전제: 공고가 1건 이상 있다").toBeGreaterThan(0);
    return count;
  });

  await test.step("목록이 두 페이지 이상 나온다", async () => {
    expect(
      total,
      `전제: 페이지네이션 여정이 성립하려면 공고가 ${MIN_POSTINGS_FOR_PAGINATION}건보다 많아야 한다`,
    ).toBeGreaterThan(MIN_POSTINGS_FOR_PAGINATION);
  });

  const sample = await test.step("공고 표본을 읽는다", async () => {
    const response = await request.get(
      `${apiBaseURL}/job_postings?page=1&size=${SAMPLE_SIZE}&encoded_query=${encodeQuery(EMPTY_QUERY)}`,
    );
    expect(response.ok(), "백엔드가 공고 목록 질의에 응답한다").toBeTruthy();
    return (await response.json()) as Posting[];
  });

  const searchableSkill = await test.step(
    "검색으로 결과를 좁힐 수 있는 기술스택이 있다",
    async () => {
      const response = await request.get(`${apiBaseURL}/skills`);
      expect(response.ok(), "백엔드가 기술스택 목록에 응답한다").toBeTruthy();
      const catalog = new Set(
        ((await response.json()) as SkillsResponse).skills.flatMap(
          (skill) => skill.skillNames,
        ),
      );

      // 검색 상자는 카탈로그에 있는 이름만 제안한다 — 실제 공고가 달고 있으면서 제안되는 것을 고른다.
      const candidate = sample
        .flatMap((posting) => posting.skills ?? [])
        .find((skill) => catalog.has(skill));
      expect(
        candidate,
        "전제: 어떤 기술스택 검색어에 걸리는 공고가 1건 이상 있다",
      ).toBeDefined();

      const narrowed = await countOf({
        ...EMPTY_QUERY,
        skillNames: [[candidate as string]],
      });
      expectNarrowing(narrowed, total, "그 기술스택 검색");

      return candidate as string;
    },
  );

  const searchableCompany = await test.step(
    "검색으로 찾을 수 있는 회사가 있다",
    async () => {
      // 표본에 있는 회사부터 시도한다 — 공고가 있는 회사여야 결과가 비지 않는다.
      for (const posting of sample) {
        const response = await request.get(
          `${apiBaseURL}/companies?keyword=${encodeURIComponent(posting.companyName)}`,
        );
        if (!response.ok()) continue;

        const found = ((await response.json()) as CompaniesResponse).companies
          // 검색 상자는 defaultName을 제안한다 — 제안될 이름이어야 여정이 성립한다.
          .find((company) => company.defaultName === posting.companyName);
        if (!found || found.siteCompanies.length === 0) continue;

        const narrowed = await countOf({
          ...EMPTY_QUERY,
          companies: found.siteCompanies,
        });
        if (narrowed === 0) continue;

        expectNarrowing(narrowed, total, "그 회사 검색");
        return found.defaultName;
      }

      throw new Error(
        `전제 미충족: 표본 ${SAMPLE_SIZE}건 안에 검색으로 찾을 수 있는 회사가 없다`,
      );
    },
  );

  const filterableMinCareer = await test.step(
    "결과를 좁힐 수 있는 경력 조건이 있다",
    async () => {
      const candidate = sample
        .map((posting) => posting.minCareer ?? 0)
        .find((years) => years > 0);
      expect(
        candidate,
        "전제: 경력을 요구하는 공고가 1건 이상 있다",
      ).toBeDefined();

      const years = candidate as number;
      const narrowed = await countOf({ ...EMPTY_QUERY, minCareer: years });
      expectNarrowing(narrowed, total, `최소 경력 ${years}년 조건`);

      return years;
    },
  );

  const postingWithReviews = await test.step(
    "리뷰가 달린 회사의 공고가 있다",
    async () => {
      const found = sample.find(
        (posting) => (posting.reviewInfo?.reviewCount ?? 0) > 0,
      );
      expect(
        found,
        `전제: 표본 ${SAMPLE_SIZE}건 안에 리뷰가 달린 회사의 공고가 1건 이상 있다`,
      ).toBeDefined();

      const posting = found as Posting;
      return { site: posting.site, postingId: posting.postingId };
    },
  );

  const postingWithPagedReviews = await test.step(
    "리뷰가 두 페이지 이상인 공고가 있다",
    async () => {
      // 기존 앱은 수집이 끝난 회사에만 리뷰 페이지네이션을 그린다.
      const found = sample.find(
        (posting) =>
          posting.reviewInfo?.isCompleteCrawl === true &&
          posting.reviewInfo.reviewCount > MIN_REVIEWS_FOR_PAGINATION,
      );
      expect(
        found,
        `전제: 표본 ${SAMPLE_SIZE}건 안에 리뷰가 ${MIN_REVIEWS_FOR_PAGINATION}개보다 많고 수집이 끝난 회사의 공고가 있다`,
      ).toBeDefined();

      const posting = found as Posting;
      return { site: posting.site, postingId: posting.postingId };
    },
  );

  writePreconditionData(wiring, {
    searchableSkill,
    searchableCompany,
    filterableMinCareer,
    postingWithReviews,
    postingWithPagedReviews,
  });
});
