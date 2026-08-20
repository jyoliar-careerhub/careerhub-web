import Link from "next/link";
import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JobCategoryGroup } from "@/lib/api/conditions";
import {
  appliedConditions,
  isCategorySelected,
  JOB_POSTING_LIST_ROUTE,
  listHref,
  withCategoryToggled,
  type ListSearch,
} from "@/lib/job-posting/list-search";

import { CareerFilter } from "./career-filter";
import { CompanySearch } from "./company-search";
import { SkillSearch } from "./skill-search";

/**
 * 좁히는 축들 — 그리고 **지금 걸려 있는 것**.
 *
 * 걸린 조건을 축마다 다른 모양으로 되보여주면(직군은 선택 상태, 나머지는 칩) 사용자는
 * "지금 무엇에 걸려 있나"를 화면 여러 곳에서 모아 읽어야 한다. 여기서는 축을 가리지 않고
 * **한 목록**으로 모은다 — 그래야 하나씩 푸는 것도, 통째로 푸는 것도 한 자리에서 된다.
 *
 * 직군만 검색이 아니라 통째로 제시된다. 수가 유한하고(실측 68개) 잘 안 바뀌어서 고를 것을
 * 다 보여줄 수 있는 축이기 때문이다 — 검색으로 찾게 만들 이유가 없다.
 *
 * 다만 **직군의 어휘는 사이트마다 다르다.** 합쳐서 한 줄로 늘어놓으면 고르는 사람이 그
 * 차이를 볼 수 없으므로 사이트별로 묶고, 관심 없는 사이트는 접을 수 있게 둔다.
 * 접기는 `<details>`라 JS가 없어도 동작한다 — 이 화면의 나머지가 링크뿐인 것과 같은 결이다.
 */
export function FilterPanel({
  search,
  categoryGroups,
}: {
  search: ListSearch;
  categoryGroups: JobCategoryGroup[];
}) {
  const conditions = appliedConditions(search);

  return (
    <section
      aria-label="검색 조건"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">직군</h2>
        {/*
          예순여덟 개를 통째로 펼치면 좁은 화면에서 결과가 스무 줄 아래로 밀린다.
          그래서 높이를 묶어 그 안에서 굴린다 — 고를 것이 전부 화면에 남아 있으면서
          (제시하는 축이라는 성질을 잃지 않고) 결과가 첫 화면에 남는다.
        */}
        <div
          data-slot="job-categories"
          className="flex max-h-56 flex-col gap-3 overflow-y-auto rounded-lg border p-3"
        >
          {categoryGroups.map((group) => (
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
                      className="h-7 px-3 text-sm"
                      render={
                        <Link
                          href={listHref(withCategoryToggled(search, category))}
                          prefetch={false}
                          aria-current={selected ? "true" : undefined}
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkillSearch search={search} />
        <CompanySearch search={search} />
        {/* 주소가 바뀌면 입력칸도 새 값으로 다시 선다 — 같은 값을 두 곳에서 맞추지 않는다. */}
        <CareerFilter
          key={`${search.minCareer ?? ""}-${search.maxCareer ?? ""}`}
          search={search}
        />
      </div>

      {conditions.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <span className="text-sm text-muted-foreground">걸린 조건</span>
          <div
            data-slot="applied-conditions"
            className="flex flex-wrap items-center gap-1.5"
          >
            {conditions.map((condition) => (
              <Badge
                key={condition.key}
                variant="secondary"
                className="h-7 gap-1 px-3 text-sm"
                render={
                  <Link
                    href={listHref(condition.without)}
                    prefetch={false}
                    aria-label={`${condition.label} 조건 해제`}
                  />
                }
              >
                {condition.label}
                <XIcon />
              </Badge>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            data-slot="clear-conditions"
            render={<Link href={JOB_POSTING_LIST_ROUTE} prefetch={false} />}
          >
            전체 해제
          </Button>
        </div>
      )}
    </section>
  );
}
