import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JobCategoryGroup } from "@/lib/api/conditions";
import {
  hasConditions,
  isCategorySelected,
  JOB_POSTING_LIST_ROUTE,
  listHref,
  withCategoryToggled,
  type ListSearch,
} from "@/lib/job-posting/list-search";

import { AppliedChips } from "./applied-chips";
import { CareerFilter } from "./career-filter";
import { CompanySearch } from "./company-search";
import { SkillSearch } from "./skill-search";

/**
 * 좁히는 축들 — 그리고 **지금 걸려 있는 것**.
 *
 * 걸린 조건은 **그것을 건 자리 바로 아래**에서 되보인다. 한 곳에 모아 두면 조건이 여럿일 때
 * "지금 무엇으로 좁혀져 있나"는 읽히지만 "이 축에 무엇이 걸렸나"가 안 읽힌다 — 조건을 더
 * 걸거나 푸는 일은 언제나 축 단위로 일어나므로, 되보이는 자리도 축을 따라간다.
 * 모양은 축을 가리지 않고 하나다(칩 + 해제 링크) — 그 불변식까지 흩뜨리지는 않는다.
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
  return (
    <section
      aria-label="검색 조건"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">직군</h2>
          {hasConditions(search) ? (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              data-slot="clear-conditions"
              render={<Link href={JOB_POSTING_LIST_ROUTE} prefetch={false} />}
            >
              전체 해제
            </Button>
          ) : null}
        </div>

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

        <AppliedChips search={search} axis="category" />
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <SkillSearch search={search} />
          <AppliedChips search={search} axis="skill" />
        </div>

        <div className="flex flex-col gap-2">
          <CompanySearch search={search} />
          <AppliedChips search={search} axis="company" />
        </div>

        <div className="flex flex-col gap-2">
          {/* 주소가 바뀌면 입력칸도 새 값으로 다시 선다 — 같은 값을 두 곳에서 맞추지 않는다. */}
          <CareerFilter
            key={`${search.minCareer ?? ""}-${search.maxCareer ?? ""}`}
            search={search}
          />
          <AppliedChips search={search} axis="career" />
        </div>
      </div>
    </section>
  );
}
