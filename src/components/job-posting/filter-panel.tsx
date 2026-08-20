import type { JobCategoryGroup } from "@/lib/api/conditions";
import type { ListSearch } from "@/lib/job-posting/list-search";

import { AppliedChips, ClearConditions } from "./applied-chips";
import { CareerFilter } from "./career-filter";
import { CompanySearch } from "./company-search";
import { JobCategories } from "./job-categories";
import { SkillSearch } from "./skill-search";

/**
 * 좁히는 축들의 배치 — 그리고 **걸린 것이 어디에 되보이는가**.
 *
 * 걸린 조건은 **그것을 건 자리 바로 아래**에 선다. 한 곳에 모아 두면 조건이 여럿일 때
 * "지금 무엇으로 좁혀져 있나"는 읽히지만 "이 축에 무엇이 걸렸나"가 안 읽힌다 — 조건을 더
 * 걸거나 푸는 일은 언제나 축 단위로 일어나므로, 되보이는 자리도 축을 따라간다.
 * 모양은 축을 가리지 않고 하나다(칩 + 해제) — 그 불변식까지 흩뜨리지는 않는다.
 *
 * 이 컴포넌트 자체는 자리만 잡는다. 축을 만지는 일은 전부 브라우저의 것이라
 * (조건을 켜고 끄는 것은 이동이 아니라 동작이다) 조각들이 각자 클라이언트 컴포넌트다.
 * 서버가 실어 보내는 것은 `search` 한 벌과 직군 목록뿐이다.
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
          <ClearConditions search={search} />
        </div>

        <JobCategories search={search} groups={categoryGroups} />
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
