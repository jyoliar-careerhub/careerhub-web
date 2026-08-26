"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchSkillGroups,
  type SkillGroup,
} from "@/lib/api/conditions-browser";
import {
  listHref,
  withSkillGroup,
  type ListSearch,
} from "@/lib/job-posting/list-search";

import { ConditionSearchBox, type Candidate } from "./condition-search-box";

/**
 * 기술스택으로 좁힌다.
 *
 * 후보의 원천은 **한 번 받아 둔 전체 목록**이다 — 계약이 이 응답에 하루 캐시를 선언할 만큼
 * 잘 안 바뀌고(실측 582묶음·32KB), 그래서 한 글자마다 서버에 물을 이유가 없다.
 * 서버 렌더 페이로드에 싣지 않고 브라우저가 따로 받는 것도 같은 이유다 — 조건이 바뀔 때마다
 * 같은 32KB를 다시 흘려보내는 대신, 브라우저 캐시가 한 번만 받게 둔다.
 *
 * 받아 오는 상대는 **web 호스트**다(`/api/conditions/skills` — ops-workflow#76). api-composer는
 * 내부 전용이라 브라우저에서 닿지 않는다. 그 자리가 계약의 캐시 선언을 그대로 실어 보내므로
 * 위의 "한 번만 받는다"는 성질은 경유해도 그대로다.
 */

/** 후보 목록은 고르라고 있는 것이다 — 수백 개를 늘어놓으면 고를 수 없다. */
const MAX_CANDIDATES = 30;

/** 넣은 것과 똑같은 표기를 맨 앞에 둔다 — 사용자가 찾던 것이 잘려 나가지 않도록. */
function rankOf(group: SkillGroup, needle: string): number {
  if (group.names.some((name) => name.toLowerCase() === needle)) return 0;
  if (group.names.some((name) => name.toLowerCase().startsWith(needle))) return 1;
  return 2;
}

export function SkillSearch({ search }: { search: ListSearch }) {
  const [groups, setGroups] = useState<SkillGroup[]>([]);

  useEffect(() => {
    let live = true;
    fetchSkillGroups()
      .then((loaded) => {
        if (live) setGroups(loaded);
      })
      .catch(() => {
        // 목록을 못 받으면 고를 후보가 없을 뿐이다 — 화면의 나머지는 계속 쓸 수 있다.
      });
    return () => {
      live = false;
    };
  }, []);

  const find = useCallback(
    async (keyword: string): Promise<Candidate[]> => {
      const needle = keyword.toLowerCase();
      return groups
        .filter((group) =>
          group.names.some((name) => name.toLowerCase().includes(needle)),
        )
        .sort((left, right) => rankOf(left, needle) - rankOf(right, needle))
        .slice(0, MAX_CANDIDATES)
        .map((group) => ({
          id: group.names.join("/"),
          label: group.names.join(" / "),
          href: listHref(withSkillGroup(search, group.names)),
        }));
    },
    [groups, search],
  );

  return (
    <ConditionSearchBox
      axis="skill"
      label="기술스택"
      placeholder="기술스택 검색 (예: python)"
      find={find}
    />
  );
}
