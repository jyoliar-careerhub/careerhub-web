"use client";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import type { JobCategoryGroup } from "@/lib/api/conditions";
import {
  isCategorySelected,
  listHref,
  withCategoryToggled,
  type ListSearch,
} from "@/lib/job-posting/list-search";

/**
 * 화면이 통째로 제시하는 축 — 직군.
 *
 * 수가 유한하고(실측 68개) 잘 안 바뀌어서 고를 것을 다 보여줄 수 있다 — 검색으로 찾게
 * 만들 이유가 없다. 다만 **직군의 어휘는 사이트마다 다르다.** 합쳐서 한 줄로 늘어놓으면
 * 고르는 사람이 그 차이를 볼 수 없으므로 사이트별로 묶고, 관심 없는 사이트는 접을 수 있게
 * 둔다(`<details>` — 접힘은 브라우저가 알아서 하고 주소와 무관하다).
 *
 * **버튼이다.** 조건을 켜고 끄는 동작이라 시맨틱도 토글 버튼이고(`aria-pressed`),
 * 덕분에 지금 걸린 조건이 예순여덟 개 링크에 **일일이 복제되지 않는다** — 서버가 실어
 * 보내는 것은 `search` 한 벌이고, 주소를 조립하는 것은 누른 순간의 브라우저다.
 * 조립에 쓰는 함수는 서버가 쓰는 것과 같다(`list-search.ts`) — 원천을 둘로 만들지 않는다.
 */
export function JobCategories({
  search,
  groups,
}: {
  search: ListSearch;
  groups: JobCategoryGroup[];
}) {
  const router = useRouter();

  return (
    <div
      data-slot="job-categories"
      className="flex max-h-56 flex-col gap-3 overflow-y-auto rounded-lg border p-3"
    >
      {groups.map((group) => (
        <details key={group.site} open>
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            from {group.site} ({group.categories.length})
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {group.categories.map((categoryName) => {
              const category = { site: group.site, categoryName };
              const selected = isCategorySelected(search, category);
              return (
                <Badge
                  key={categoryName}
                  variant={selected ? "default" : "outline"}
                  className="h-7 cursor-pointer px-3 text-sm"
                  render={
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        router.push(
                          listHref(withCategoryToggled(search, category)),
                        )
                      }
                    />
                  }
                >
                  {categoryName}
                </Badge>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
