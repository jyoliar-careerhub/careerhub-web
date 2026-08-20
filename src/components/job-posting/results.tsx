import { redirect } from "next/navigation";

import {
  countJobPostings,
  listJobPostings,
} from "@/lib/api/job-postings";
import {
  listHref,
  PAGE_SIZE,
  toApiQuery,
  withPage,
  type ListSearch,
} from "@/lib/job-posting/list-search";

import { JobPostingCard } from "./job-posting-card";
import { ListPagination } from "./list-pagination";
import { ResultsGrid, ResultsRegion } from "./results-region";

/** 첫 줄(가장 넓은 배치 기준)은 화면에 바로 보인다 — 그 이미지까지는 미루지 않는다. */
const EAGER_IMAGES = 4;

/**
 * 지금 조건의 결과.
 *
 * 건수와 목록을 **함께** 청한다 — 계약이 둘을 나눠 두었고(`/job_postings`·`/count`),
 * 어느 쪽도 다른 쪽을 기다릴 이유가 없다.
 *
 * 몇 건인지·몇 페이지 중 몇 페이지인지를 화면에 낸다. 규모를 모르면 사용자는 자기가 건
 * 조건이 통했는지 알 수 없고, 그 값이 화면에 있어야 "좁아졌다"가 눈으로도 보인다.
 */
export async function Results({ search }: { search: ListSearch }) {
  const query = toApiQuery(search);
  const [count, postings] = await Promise.all([
    countJobPostings(query),
    listJobPostings({ page: search.page, size: PAGE_SIZE, query }),
  ]);
  const totalPages = Math.ceil(count / PAGE_SIZE);

  // 결과는 있는데 그보다 뒤 페이지를 보고 있다면(손으로 고친 주소·낡은 링크) 빈 화면 대신
  // 마지막 페이지를 보여준다 — "2 / 1 페이지" 같은 자리는 화면에 존재하지 않는다.
  if (count > 0 && search.page > totalPages) {
    redirect(listHref(withPage(search, totalPages)));
  }

  return (
    <ResultsRegion busy={false}>
      <p role="status" className="text-sm text-muted-foreground">
        총 {count.toLocaleString("ko-KR")}건
        {totalPages === 0 ? null : ` · ${search.page} / ${totalPages} 페이지`}
      </p>

      {postings.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          조건에 맞는 공고가 없습니다. 걸어 둔 조건을 풀어 보세요.
        </p>
      ) : (
        <ResultsGrid>
          {postings.map((posting, index) => (
            <JobPostingCard
              key={`${posting.site}/${posting.postingId}`}
              posting={posting}
              eager={index < EAGER_IMAGES}
            />
          ))}
        </ResultsGrid>
      )}

      <ListPagination search={search} totalPages={totalPages} />
    </ResultsRegion>
  );
}
