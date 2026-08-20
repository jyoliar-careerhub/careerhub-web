import { Suspense } from "react";
import type { Metadata } from "next";

import { FilterPanel } from "@/components/job-posting/filter-panel";
import { Results } from "@/components/job-posting/results";
import { ResultsSkeleton } from "@/components/job-posting/results-region";
import { listJobCategoryGroups } from "@/lib/api/conditions";
import {
  listHref,
  parseListSearch,
  type RawSearchParams,
} from "@/lib/job-posting/list-search";

export const metadata: Metadata = {
  title: "채용공고 — careerhub",
  description: "기술스택·회사·직군·경력으로 채용공고를 좁혀 봅니다.",
};

/**
 * 채용공고 목록 — 검색·필터·페이지네이션이 한 여정이다 (ops-workflow#70).
 *
 * **상태의 원천은 주소 하나다.** 걸어 둔 조건도 보고 있는 페이지도 질의문자열에만 살고,
 * 이 서버 컴포넌트는 그것을 읽어 그린다. 그래서
 *  - 다시 열어도 조건이 그대로고(공유·북마크·새로고침을 견딘다),
 *  - 컴포넌트 최상위에서 `window`를 만질 일이 없으며(SSR-safe 규율 · Epic Scope),
 *  - 렌더링 전략을 여기서 정하지 않아도 된다 — 상태가 클라이언트에 고이지 않으므로
 *    라우트별 전환의 문이 열린 채로 남는다(Epic Out of Scope).
 *
 * 결과만 `<Suspense>` 안에 둔다. 조건이 바뀌면 좁히는 축들은 서 있고 결과 자리에만
 * 스켈레톤이 뜬다 — `key`가 조건을 담고 있어서 조건이 갈릴 때마다 경계가 새로 선다.
 */
export default async function JobPostingListPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const search = parseListSearch(await searchParams);
  const categoryGroups = await listJobCategoryGroups();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          채용공고
        </h1>
        <p className="text-sm text-muted-foreground">
          기술스택·회사·직군·경력으로 좁혀 보세요.
        </p>
      </header>

      <FilterPanel search={search} categoryGroups={categoryGroups} />

      <Suspense key={listHref(search)} fallback={<ResultsSkeleton />}>
        <Results search={search} />
      </Suspense>
    </main>
  );
}
