import { StarIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 회사 평판 한 눈금 — 목록 카드도, 상세의 리뷰 요약도, 리뷰 한 건도 같은 것을 쓴다.
 *
 * 두 화면에 걸쳐 있으므로 도메인 폴더가 아니라 여기 선다. shadcn 세트에는 대응이 없어
 * 직접 만드는 첫 컴포넌트다 (ops-workflow#71).
 */

/** 계약의 점수는 10을 곱한 정수다(`45` = 4.5) — 기존 앱도 같은 규칙으로 되돌린다. */
export function scoreText(score: number): string {
  return `${Math.floor(score / 10)}.${score % 10}`;
}

export function Rating({
  score,
  reviewCount,
  className,
}: {
  score: number;
  /** 이 점수가 몇 건에서 나왔는가. 리뷰 한 건처럼 셀 것이 없으면 생략한다. */
  reviewCount?: number;
  className?: string;
}) {
  return (
    <span
      data-slot="rating"
      className={cn("inline-flex items-center gap-1", className)}
    >
      <StarIcon className="size-3.5 shrink-0 fill-current text-rating" />
      <span data-slot="rating-score" className="font-medium">
        {scoreText(score)}
      </span>
      {reviewCount === undefined ? null : (
        <span data-slot="rating-count" className="text-muted-foreground">
          ({reviewCount}개 리뷰)
        </span>
      )}
    </span>
  );
}
