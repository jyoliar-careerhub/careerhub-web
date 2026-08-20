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
 * 계약의 기본값이자 **상세 응답의 `firstPageReviews`가 담고 있는 크기**다(실측 확인).
 * 그래서 1페이지는 추가 호출 없이 상세 응답 안에 이미 있다 — 이 값이 어긋나면 1페이지와
 * 2페이지의 크기가 달라지므로 한 곳에 세워 둔다.
 */
export const REVIEW_PAGE_SIZE = 10;

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
