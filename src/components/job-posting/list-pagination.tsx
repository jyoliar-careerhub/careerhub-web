import Link from "next/link";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { listHref, withPage, type ListSearch } from "@/lib/job-posting/list-search";

/**
 * 페이지 이동.
 *
 * 224페이지를 다 그릴 수는 없으므로 **지금 자리 주변과 양 끝**만 낸다 — 처음·끝으로 한 번에
 * 가는 길이 없으면 목록의 규모를 알 수도, 끝을 볼 수도 없다.
 *
 * 링크의 `href`가 곧 그 페이지의 주소다 — 눌러서 가는 것과 주소를 붙여넣어 여는 것이 같다.
 */

/** 현재 페이지 좌우로 이만큼씩 낸다. */
const NEIGHBOURS = 2;

type PageSlot = number | "gap";

function pageSlots(current: number, totalPages: number): PageSlot[] {
  const numbers = new Set<number>([1, totalPages]);
  for (let page = current - NEIGHBOURS; page <= current + NEIGHBOURS; page += 1) {
    if (page >= 1 && page <= totalPages) {
      numbers.add(page);
    }
  }

  const sorted = [...numbers].sort((left, right) => left - right);
  const slots: PageSlot[] = [];
  let previous: number | null = null;
  for (const page of sorted) {
    if (previous !== null && page - previous > 1) {
      slots.push("gap");
    }
    slots.push(page);
    previous = page;
  }
  return slots;
}

export function ListPagination({
  search,
  totalPages,
}: {
  search: ListSearch;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const current = Math.min(Math.max(search.page, 1), totalPages);
  const atFirst = current === 1;
  const atLast = current === totalPages;

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text="이전"
            aria-disabled={atFirst}
            className={atFirst ? "pointer-events-none opacity-50" : undefined}
            render={
              <Link
                href={listHref(withPage(search, Math.max(current - 1, 1)))}
                prefetch={false}
                aria-label="이전 페이지"
              />
            }
          />
        </PaginationItem>

        {pageSlots(current, totalPages).map((slot, index) =>
          slot === "gap" ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={slot}>
              <PaginationLink
                isActive={slot === current}
                render={
                  <Link
                    href={listHref(withPage(search, slot))}
                    prefetch={false}
                    aria-label={`${slot} 페이지`}
                  />
                }
              >
                {slot}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            text="다음"
            aria-disabled={atLast}
            className={atLast ? "pointer-events-none opacity-50" : undefined}
            render={
              <Link
                href={listHref(withPage(search, Math.min(current + 1, totalPages)))}
                prefetch={false}
                aria-label="다음 페이지"
              />
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
