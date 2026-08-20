import { cache, Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeftIcon } from "lucide-react";

import { CompanyAside } from "@/components/job-posting/detail/company-aside";
import { CompanyReviews } from "@/components/job-posting/detail/company-reviews";
import { ReviewsSkeleton } from "@/components/job-posting/detail/reviews-region";
import { PostingHeader } from "@/components/job-posting/detail/posting-header";
import { PostingSections } from "@/components/job-posting/detail/posting-sections";
import {
  ApiError,
  getJobPostingDetail,
  type JobPostingDetail,
} from "@/lib/api/job-postings";
import { detailHref, parseDetailView } from "@/lib/job-posting/detail-view";
import {
  JOB_POSTING_LIST_ROUTE,
  type RawSearchParams,
} from "@/lib/job-posting/list-search";

/**
 * 채용공고 상세 — 포지션 정보와 회사 리뷰가 한 화면이다 (ops-workflow#71).
 *
 * 목록과 같은 규율이다: **상태의 원천은 주소 하나**다. 어느 공고인지는 경로가, 리뷰의
 * 몇 페이지를 보고 있는지는 질의문자열이 말한다. 그래서 리뷰 3페이지에서 주소를 건네면
 * 받는 쪽도 3페이지를 보고, 컴포넌트 최상위가 `window`를 만질 일이 없다(SSR-safe 규율).
 *
 * 리뷰만 `<Suspense>` 안에 둔다 — 페이지를 넘겨도 공고 본문은 서 있고 리뷰 자리에만
 * 스켈레톤이 뜬다. `key`가 지금 보는 리뷰 페이지라 넘길 때마다 경계가 새로 선다.
 */

interface PostingParams {
  site: string;
  postingId: string;
}

/**
 * 같은 요청 안에서 상세는 한 번만 청한다 — 제목(`generateMetadata`)과 본문이 같은 것을 본다.
 */
const loadPosting = cache(
  async (site: string, postingId: string): Promise<JobPostingDetail> => {
    try {
      return await getJobPostingDetail(site, postingId);
    } catch (error) {
      // 없는 공고는 오류가 아니라 없는 주소다 — 500이 아니라 404를 낸다.
      if (error instanceof ApiError && error.status === 404) {
        notFound();
      }
      throw error;
    }
  },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<PostingParams>;
}): Promise<Metadata> {
  const { site, postingId } = await params;
  const posting = await loadPosting(site, postingId);
  return {
    title: `${posting.title} — ${posting.companyName} | careerhub`,
    description: posting.mainTask.slice(0, 150),
  };
}

export default async function JobPostingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<PostingParams>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { site, postingId } = await params;
  const view = parseDetailView({ site, postingId }, await searchParams);
  const posting = await loadPosting(site, postingId);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
      <Link
        href={JOB_POSTING_LIST_ROUTE}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ChevronLeftIcon className="size-4" />
        채용공고 목록
      </Link>

      <PostingHeader posting={posting} />

      <div className="grid items-start gap-8 lg:grid-cols-posting-detail">
        <div className="flex min-w-0 flex-col gap-8">
          <PostingSections posting={posting} />

          <Suspense key={detailHref(view)} fallback={<ReviewsSkeleton />}>
            <CompanyReviews posting={posting} view={view} />
          </Suspense>
        </div>

        <CompanyAside posting={posting} />
      </div>
    </main>
  );
}
