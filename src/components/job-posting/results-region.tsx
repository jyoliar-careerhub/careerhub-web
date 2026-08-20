import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_SIZE } from "@/lib/job-posting/list-search";

/**
 * 결과가 사는 자리.
 *
 * 조건이 바뀌면 이 영역만 다시 그려진다(`<Suspense>`가 여기를 감싼다) — 좁히는 축들은
 * 그대로 서 있고 결과만 갈린다. **그리는 중인지를 `aria-busy`로 말하는** 것이 그 구조의
 * 귀결이다: 보조기술도, e2e 배선도, "다 그려졌는가"를 화면에서 읽을 수 있다.
 */

/** 카드가 놓이는 격자 — 스켈레톤과 결과가 같은 모양이어야 자리가 흔들리지 않는다. */
const CARD_GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function ResultsRegion({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label="검색 결과"
      aria-busy={busy}
      className="flex flex-col gap-4"
    >
      {children}
    </section>
  );
}

export function ResultsGrid({ children }: { children: ReactNode }) {
  return <div className={CARD_GRID}>{children}</div>;
}

export function ResultsSkeleton() {
  return (
    <ResultsRegion busy>
      <Skeleton className="h-5 w-48" />
      <ResultsGrid>
        {Array.from({ length: PAGE_SIZE }, (_, index) => (
          <Skeleton key={index} className="h-64 w-full rounded-xl" />
        ))}
      </ResultsGrid>
    </ResultsRegion>
  );
}
