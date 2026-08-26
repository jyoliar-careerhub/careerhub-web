"use client";

import { useCallback } from "react";

import { fetchCompanyCandidates } from "@/lib/api/conditions-browser";
import {
  listHref,
  withCompanies,
  type ListSearch,
} from "@/lib/job-posting/list-search";

import { ConditionSearchBox, type Candidate } from "./condition-search-box";

/**
 * 회사로 좁힌다.
 *
 * 기술스택과 달리 후보를 **서버에 묻는다** — 회사 수는 전체를 받아 둘 규모가 아니고,
 * 계약도 prefix 검색(최대 5건)으로만 열어 준다. 묻는 상대는 web 호스트이고
 * (`/api/conditions/companies` — ops-workflow#76), 그 뒤를 Next 서버가 api-composer에 묻는다.
 *
 * 후보 하나가 조건 여럿이 될 수 있다. 같은 회사가 사이트마다 다른 이름으로 올라와 있어서,
 * 고르면 그 사이트별 이름이 통째로 걸린다 — 사이트는 수집기의 사정이지 구직자의 관심사가 아니다.
 */
export function CompanySearch({ search }: { search: ListSearch }) {
  const find = useCallback(
    async (keyword: string): Promise<Candidate[]> => {
      const found = await fetchCompanyCandidates(keyword);
      return found.map((company) => ({
        id: company.siteCompanies
          .map((siteCompany) => `${siteCompany.site}:${siteCompany.companyName}`)
          .join(","),
        label: company.defaultName,
        href: listHref(withCompanies(search, company.siteCompanies)),
      }));
    },
    [search],
  );

  return (
    <ConditionSearchBox
      axis="company"
      label="회사"
      placeholder="기업명 검색 (예: 카카오)"
      find={find}
    />
  );
}
