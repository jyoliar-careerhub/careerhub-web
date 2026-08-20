"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listHref,
  withCareer,
  type ListSearch,
} from "@/lib/job-posting/list-search";

/**
 * 경력으로 좁힌다.
 *
 * 이 축에는 고를 후보가 없다 — 숫자를 직접 적는다. 그래도 **적는 것과 거는 것은 갈라 둔다**:
 * 한 자릿수를 지우는 순간(`10` → `1`) 엉뚱한 조건이 걸리는 화면이 되지 않도록, 조건이 되는
 * 것은 제출할 때뿐이다.
 *
 * 주소가 상태의 원천이므로 입력칸의 초기값도 주소에서 온다. 주소가 바뀌면 부모가 `key`로
 * 이 컴포넌트를 다시 세워 값이 따라오게 한다 — 같은 값을 두 곳에서 맞춰 두지 않는다.
 */

function toYears(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function CareerFilter({ search }: { search: ListSearch }) {
  const router = useRouter();
  const minId = useId();
  const maxId = useId();
  const [min, setMin] = useState(
    search.minCareer === null ? "" : String(search.minCareer),
  );
  const [max, setMax] = useState(
    search.maxCareer === null ? "" : String(search.maxCareer),
  );

  function apply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    router.push(
      listHref(withCareer(search, { min: toYears(min), max: toYears(max) })),
    );
  }

  return (
    <form onSubmit={apply} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">경력</span>
      <div className="flex items-center gap-1.5">
        <Input
          id={minId}
          type="number"
          min={0}
          inputMode="numeric"
          aria-label="최소 경력(년)"
          placeholder="최소"
          value={min}
          onChange={(event) => setMin(event.target.value)}
        />
        <span aria-hidden className="text-muted-foreground">
          ~
        </span>
        <Input
          id={maxId}
          type="number"
          min={0}
          inputMode="numeric"
          aria-label="최대 경력(년)"
          placeholder="최대"
          value={max}
          onChange={(event) => setMax(event.target.value)}
        />
        <Button type="submit" variant="outline" size="sm">
          적용
        </Button>
      </div>
    </form>
  );
}
