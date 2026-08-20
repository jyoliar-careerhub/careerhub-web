import { api } from "./client";
import { ApiError } from "./job-postings";

import type { components } from "./schema";

/**
 * 회사 리뷰 호출 — 계약 타입은 생성물에서만 온다 (ADR-0014).
 *
 * 리뷰는 공고가 아니라 **회사**에 달린다. 그래서 좌표가 공고 식별자가 아니라 회사 이름이고,
 * 상세 응답의 `reviewInfo.defaultName`이 그 이름의 원천이다 — 화면에 보이는 회사명
 * (`원프레딕트(onepredict)`)과 다를 수 있다.
 */

export type Review = components["schemas"]["Review"];
export type ReviewInfo = components["schemas"]["ReviewInfo"];

/**
 * 한 페이지에 담기는 리뷰 수.
 *
 * 계약의 기본값(10)이 아니라 **화면이 정한 값**이다 — 리뷰 한 건이 두 줄이라 열 건은 다음
 * 절(태그·기술스택)을 화면 밖으로 밀어낸다. 계약은 `size`를 그대로 받는다(실측 확인).
 *
 * 상세 응답의 `firstPageReviews`는 여전히 10건이라, 그것만으로 처음 **두** 페이지가 덮인다.
 */
export const REVIEW_PAGE_SIZE = 5;

export async function listCompanyReviews({
  companyName,
  page,
}: {
  companyName: string;
  /** 1부터 시작한다 — 계약은 0부터라 여기서 옮긴다. */
  page: number;
}): Promise<Review[]> {
  const { data, error, response } = await api.GET("/company-review/reviews", {
    params: { query: { companyName, page: page - 1, size: REVIEW_PAGE_SIZE } },
  });
  if (error !== undefined) {
    throw new ApiError("회사 리뷰 조회", response.status, error);
  }
  return data;
}
