import { redirect } from "next/navigation";

import { PageNavigation } from "@/components/page-navigation";
import { Rating } from "@/components/rating";
import type { JobPostingDetail } from "@/lib/api/job-postings";
import {
  listCompanyReviews,
  REVIEW_PAGE_SIZE,
  type Review,
  type ReviewInfo,
} from "@/lib/api/reviews";
import {
  detailHref,
  withReviewPage,
  type DetailView,
} from "@/lib/job-posting/detail-view";

import { ReviewsRegion } from "./reviews-region";

/**
 * 이 회사에 달린 리뷰.
 *
 * **리뷰는 공고가 아니라 회사에 달린다** — 그래서 좌표가 공고 식별자가 아니라 회사 이름이고,
 * 그 이름의 원천은 화면에 보이는 회사명이 아니라 `reviewInfo.defaultName`이다
 * (`원프레딕트(onepredict)`와 `원프레딕트`처럼 갈린다).
 *
 * 리뷰가 하나도 없어도 **경계는 그대로 선다** — 비어 있음을 말하는 자리가 사라지면
 * "리뷰가 없다"와 "아직 안 그려졌다"가 화면에서 구분되지 않는다.
 *
 * **처음 두 페이지는 상세 응답 안에 이미 있다** — `firstPageReviews`가 리뷰 열 건이고
 * 화면의 한 페이지는 다섯 건이다(실측 확인). 손에 든 것을 한 번 더 청할 이유가 없다.
 *
 * 몇 페이지인지는 수집이 끝났을 때만 셀 수 있다 — `isCompleteCrawl`이 아니면 요약이 말하는
 * 리뷰 수보다 실제로 가진 것이 적을 수 있어서, 넘길 수 있다고 말해 놓고 빈 페이지를 주게 된다.
 */

/**
 * 이 페이지가 상세 응답 안에 이미 있는가.
 *
 * `firstPageReviews`는 리뷰 열 건이고 화면의 한 페이지는 다섯 건이라, 그것만으로 처음
 * **두** 페이지가 덮인다. 손에 든 것이 그 창을 **온전히** 덮을 때만 쓴다 — 걸치면 모자란
 * 페이지를 온전한 것처럼 내게 된다. 리뷰가 애초에 열 건 이하면 전부 손에 있으므로
 * 어느 페이지든 덮인다.
 */
function alreadyLoaded(
  loaded: Review[],
  info: ReviewInfo,
  page: number,
): Review[] | null {
  const start = (page - 1) * REVIEW_PAGE_SIZE;
  const end = start + REVIEW_PAGE_SIZE;
  const covers = end <= loaded.length || loaded.length >= info.reviewCount;
  return covers && start < loaded.length ? loaded.slice(start, end) : null;
}

function dateText(iso: string): string {
  return iso.split("T")[0] ?? iso;
}

function ReviewItem({ review }: { review: Review }) {
  return (
    <li
      data-slot="company-review"
      className="flex flex-col gap-1 rounded-lg border px-4 py-3"
    >
      {/* 점수와 한 줄 평가는 같은 말이다 — 줄을 갈라 놓으면 그 사이가 빈칸으로만 남는다. */}
      <div className="flex flex-wrap items-center gap-2">
        <Rating score={review.score} className="text-sm" />
        <h3 className="font-medium">{review.summary}</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {review.employmentStatus ? "현직원" : "전직원"} · {review.jobType} ·{" "}
        {review.reviewUserId} · {dateText(review.date)}
      </p>
    </li>
  );
}

export async function CompanyReviews({
  posting,
  view,
}: {
  posting: JobPostingDetail;
  view: DetailView;
}) {
  const info = posting.reviewInfo;
  // 리뷰가 없어도 자리는 있다 — 비어 있음을 말하지 않으면 "아직 안 그려졌나"와 구분되지 않는다.
  // (경계 자체가 사라지면 화면도, e2e 배선도 그 둘을 가릴 수 없다.)
  if (info === undefined) {
    return (
      <ReviewsRegion busy={false}>
        <h2 className="font-heading text-lg font-semibold">회사 리뷰</h2>
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          아직 수집된 회사 리뷰가 없습니다.
        </p>
      </ReviewsRegion>
    );
  }

  const totalPages = info.isCompleteCrawl
    ? Math.max(Math.ceil(info.reviewCount / REVIEW_PAGE_SIZE), 1)
    : 1;

  // 손으로 고친 주소·낡은 링크로 끝 너머를 보고 있으면 마지막 페이지로 되돌린다.
  if (view.reviewPage > totalPages) {
    redirect(detailHref(withReviewPage(view, totalPages)));
  }

  const reviews =
    alreadyLoaded(posting.firstPageReviews ?? [], info, view.reviewPage) ??
    (await listCompanyReviews({
      companyName: info.defaultName,
      page: view.reviewPage,
    }));

  return (
    <ReviewsRegion busy={false}>
      <h2 className="font-heading text-lg font-semibold">회사 리뷰</h2>

      {info.isCompleteCrawl ? null : (
        <p className="text-xs text-muted-foreground">
          리뷰 수집이 진행 중입니다 — 지금은 첫 페이지만 볼 수 있습니다.
        </p>
      )}

      <p role="status" className="text-sm text-muted-foreground">
        {view.reviewPage} / {totalPages} 페이지
      </p>

      <ul className="flex flex-col gap-2">
        {reviews.map((review) => (
          <ReviewItem
            key={`${review.reviewUserId}/${review.date}/${review.summary}`}
            review={review}
          />
        ))}
      </ul>

      <PageNavigation
        current={view.reviewPage}
        totalPages={totalPages}
        hrefOf={(page) => detailHref(withReviewPage(view, page))}
      />
    </ReviewsRegion>
  );
}
