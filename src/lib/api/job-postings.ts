import { api } from "./client";

import type { components } from "./schema";

/**
 * 채용공고 호출 — 계약 타입은 생성물에서만 온다 (ADR-0014).
 * 계약이 바뀌어 여기서 쓰는 필드가 사라지면 런타임이 아니라 `tsc`에서 드러난다.
 */

export type JobPosting = components["schemas"]["JobPosting"];
export type JobPostingDetail = components["schemas"]["JobPostingDetail"];
export type JobPostingQuery = components["schemas"]["Query"];
type ErrorResponse = components["schemas"]["ErrorResponse"];

/** 목록 화면이 한 항목에서 쓰는 부분 — 계약에서 파생한다(손으로 다시 선언하지 않는다). */
export type JobPostingSummary = Pick<
  JobPosting,
  "site" | "postingId" | "title" | "companyName" | "imageUrl"
>;

export function summarize(posting: JobPosting): JobPostingSummary {
  return {
    site: posting.site,
    postingId: posting.postingId,
    title: posting.title,
    companyName: posting.companyName,
    imageUrl: posting.imageUrl,
  };
}

export class ApiError extends Error {
  readonly status: number;

  constructor(operation: string, status: number, body: ErrorResponse | undefined) {
    super(`${operation} 실패 (HTTP ${status}): ${body?.message ?? "오류 본문 없음"}`);
    this.name = "ApiError";
    this.status = status;
  }
}

/** 계약: 검색 조건 `Query` 객체의 JSON을 base64(표준, 패딩 포함)로 인코딩해 보낸다. */
function encodeQuery(query: JobPostingQuery): string {
  const utf8 = new TextEncoder().encode(JSON.stringify(query));
  let binary = "";
  for (const byte of utf8) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export type JobPostingPageRequest = {
  /** 1부터 시작한다 */
  page: number;
  /** 1–100 */
  size: number;
  query: JobPostingQuery;
};

export async function listJobPostings({
  page,
  size,
  query,
}: JobPostingPageRequest): Promise<JobPosting[]> {
  const { data, error, response } = await api.GET("/job_postings", {
    params: { query: { page, size, encoded_query: encodeQuery(query) } },
  });
  if (error !== undefined) {
    throw new ApiError("채용공고 목록 조회", response.status, error);
  }
  return data;
}

export async function countJobPostings(query: JobPostingQuery): Promise<number> {
  const { data, error, response } = await api.GET("/job_postings/count", {
    params: { query: { encoded_query: encodeQuery(query) } },
  });
  if (error !== undefined) {
    throw new ApiError("채용공고 수 조회", response.status, error);
  }
  return data.count;
}

export async function getJobPostingDetail(
  site: string,
  postingId: string,
): Promise<JobPostingDetail> {
  const { data, error, response } = await api.GET(
    "/job_postings/{site}/{postingId}",
    { params: { path: { site, postingId } } },
  );
  if (error !== undefined) {
    throw new ApiError("채용공고 상세 조회", response.status, error);
  }
  return data;
}
