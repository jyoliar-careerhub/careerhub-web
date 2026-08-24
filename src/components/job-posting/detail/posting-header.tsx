import { Rating } from "@/components/rating";
import { Badge } from "@/components/ui/badge";
import type { JobPostingDetail } from "@/lib/api/job-postings";

/**
 * 상세의 첫 화면 — **무슨 자리이고, 어디이며, 평판이 어떤가.**
 *
 * 목록 카드가 말하던 것을 그대로 이어받는다(제목·회사·출처·별점). 목록에서 고른 그 공고가
 * 맞는지를 사용자가 첫눈에 확인하는 자리라, 카드와 같은 어휘·같은 부품을 쓴다.
 *
 * 별점은 여기 **한 번만** 선다 — 바로 아래 리뷰 나열이 오므로, 같은 값을 두 줄 아래
 * 다시 내면 그것이 다른 것을 말하는 줄로 읽힌다.
 */
export function PostingHeader({ posting }: { posting: JobPostingDetail }) {
  const review = posting.reviewInfo;

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {posting.status === "closed" ? (
          <Badge variant="destructive">마감</Badge>
        ) : (
          <Badge variant="secondary">채용중</Badge>
        )}
        {/* 어느 사이트에서 온 공고인가 — 같은 자리를 두 사이트가 다르게 부를 수 있다. */}
        <span data-slot="job-posting-detail-site" className="text-sm text-muted-foreground">
          from {posting.site}
        </span>
      </div>

      <h1
        data-slot="job-posting-detail-title"
        // 한글 제목이 단어 중간에서 끊기지 않게 한다 — 좁은 화면에서 특히 드러난다.
        className="font-heading text-3xl font-semibold tracking-tight break-keep text-balance"
      >
        {posting.title}
      </h1>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p data-slot="job-posting-detail-company" className="text-lg font-medium">
          {posting.companyName}
        </p>
        {review === undefined ? null : (
          <Rating
            score={review.score}
            reviewCount={review.reviewCount}
            className="text-sm"
          />
        )}
      </div>
    </header>
  );
}

/**
 * 회사가 내세우는 것들.
 *
 * **회사 리뷰 바로 다음에 선다** — 회사가 스스로 말하는 것과 다닌 사람들이 말하는 것이
 * 같은 자리에서 읽혀야 그 둘을 견줄 수 있다. 기존 앱도 이 순서다.
 */
export function PostingTags({ posting }: { posting: JobPostingDetail }) {
  const tags = posting.tags ?? [];
  if (tags.length === 0) {
    return null;
  }
  return (
    <ul data-slot="job-posting-detail-tags" className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag}>
          <Badge variant="outline">{tag}</Badge>
        </li>
      ))}
    </ul>
  );
}
