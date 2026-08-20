import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { REVIEW_PAGE_SIZE } from "@/lib/api/reviews";

/**
 * 리뷰가 사는 자리.
 *
 * 리뷰 페이지를 넘기면 이 영역만 다시 그려진다(`<Suspense>`가 여기를 감싼다) — 공고 본문은
 * 그대로 서 있고 리뷰만 갈린다. 목록 화면과 같은 규율이라 **그리는 중인지를 `aria-busy`로
 * 말한다**: 보조기술도, e2e 배선도 "다 그려졌는가"를 화면에서 읽는다.
 */
export function ReviewsRegion({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <section
      data-slot="company-reviews"
      aria-label="회사 리뷰"
      aria-busy={busy}
      className="flex flex-col gap-4"
    >
      {children}
    </section>
  );
}

export function ReviewsSkeleton() {
  return (
    <ReviewsRegion busy>
      <Skeleton className="h-6 w-40" />
      <ul className="flex flex-col gap-3">
        {Array.from({ length: REVIEW_PAGE_SIZE }, (_, index) => (
          <li key={index}>
            <Skeleton className="h-24 w-full rounded-lg" />
          </li>
        ))}
      </ul>
    </ReviewsRegion>
  );
}
