"use client";

import { useRouter } from "next/navigation";
import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  appliedConditions,
  clearedSearch,
  hasConditions,
  listHref,
  type ConditionAxis,
  type ListSearch,
} from "@/lib/job-posting/list-search";

/**
 * 한 축에 걸린 조건들 — 그리고 그것을 푸는 길.
 *
 * **버튼이다.** 사용자에게 `×`는 지우는 동작이지 다른 화면으로 가는 일이 아니다.
 * 주소가 바뀌긴 하지만 그건 이 앱이 상태를 주소에 두기 때문이고, 화면에서 그 칩이
 * 무엇으로 읽혀야 하는지와는 다른 얘기다 — 보조기술도 "링크"가 아니라 "버튼"으로 읽는다.
 *
 * 뺀 결과의 주소는 **여기서, 브라우저가** 만든다. 다만 만드는 방법은 서버가 쓰는 것과
 * 같은 함수다(`list-search.ts`) — "조건이 바뀌면 첫 페이지부터"처럼 축을 가로지르는
 * 규칙이 `URLSearchParams`를 손으로 주무르는 코드로 복제되면 그 순간 원천이 둘이 된다.
 */
export function AppliedChips({
  search,
  axis,
}: {
  search: ListSearch;
  axis: ConditionAxis;
}) {
  const router = useRouter();
  const conditions = appliedConditions(search).filter(
    (condition) => condition.axis === axis,
  );

  if (conditions.length === 0) {
    return null;
  }

  return (
    <div
      data-slot="applied-conditions"
      className="flex flex-wrap items-center gap-1.5"
    >
      {conditions.map((condition) => (
        <Badge
          key={condition.key}
          variant="secondary"
          className="h-7 cursor-pointer gap-1 px-3 text-sm"
          render={
            <button
              type="button"
              aria-label={`${condition.label} 조건 해제`}
              onClick={() => router.push(listHref(condition.without))}
            />
          }
        >
          {condition.label}
          <XIcon />
        </Badge>
      ))}
    </div>
  );
}

/** 축을 가리지 않고 전부 푼다 — 어느 한 축의 것이 아니라 패널 머리에 선다. */
export function ClearConditions({ search }: { search: ListSearch }) {
  const router = useRouter();

  if (!hasConditions(search)) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      data-slot="clear-conditions"
      onClick={() => router.push(listHref(clearedSearch()))}
    >
      전체 해제
    </Button>
  );
}
