import { JOB_POSTING_LIST_ROUTE, type RawSearchParams } from "./list-search";

/**
 * 상세 화면의 주소 ↔ 화면 상태 (ops-workflow#71).
 *
 * 목록과 같은 규율이다 — **상태의 원천은 주소 하나**다. 어느 공고인지는 경로가, 리뷰의
 * 몇 페이지를 보고 있는지는 질의문자열이 말한다. 그래서 리뷰 3페이지를 보다 주소를 복사해
 * 건네면 받는 쪽도 3페이지를 본다.
 *
 * 주소를 만드는 함수는 이 파일 하나다 — 목록의 카드도, 리뷰 페이지네이션도 여기를 지난다.
 * 두 곳에서 손으로 조립하면 인코딩 규칙이 갈라진다.
 */

const PARAM_REVIEW_PAGE = "reviewPage";

export interface DetailView {
  site: string;
  postingId: string;
  /** 보고 있는 리뷰 페이지. 1부터. */
  reviewPage: number;
}

/** 공고 하나를 가리키는 좌표 — 목록 항목도 상세도 이 둘로 특정된다. */
export interface JobPostingRef {
  site: string;
  postingId: string;
}

function positiveIntOf(params: RawSearchParams, key: string): number | null {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseDetailView(
  posting: JobPostingRef,
  params: RawSearchParams,
): DetailView {
  return {
    site: posting.site,
    postingId: posting.postingId,
    reviewPage: positiveIntOf(params, PARAM_REVIEW_PAGE) ?? 1,
  };
}

export function detailHref(view: DetailView): string {
  const path = `${JOB_POSTING_LIST_ROUTE}/${encodeURIComponent(view.site)}/${encodeURIComponent(view.postingId)}`;
  // 1페이지는 기본값이라 주소에 적지 않는다 — 목록에서 들어온 주소가 곧 그 공고의 주소다.
  return view.reviewPage <= 1
    ? path
    : `${path}?${PARAM_REVIEW_PAGE}=${view.reviewPage}`;
}

/** 목록에서 공고를 여는 주소 — 리뷰는 처음부터 본다. */
export function jobPostingHref(posting: JobPostingRef): string {
  return detailHref({ ...posting, reviewPage: 1 });
}

export function withReviewPage(view: DetailView, page: number): DetailView {
  return { ...view, reviewPage: page };
}
