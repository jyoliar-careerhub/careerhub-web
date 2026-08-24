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

/**
 * 페이지 이동 — 공고 목록도, 회사 리뷰 나열도 같은 것을 쓴다 (ops-workflow#70·#71).
 *
 * 224페이지를 다 그릴 수는 없으므로 **지금 자리 주변과 양 끝**만 낸다 — 처음·끝으로 한 번에
 * 가는 길이 없으면 규모를 알 수도, 끝을 볼 수도 없다.
 *
 * 이 컴포넌트가 아는 것은 "몇 페이지 중 몇 페이지인가"와 **각 페이지의 주소를 무엇으로
 * 만드는가**뿐이다. 주소의 형태는 부르는 쪽이 안다 — 목록은 질의문자열 한 벌을 다시 내고,
 * 리뷰는 상세 경로에 리뷰 페이지만 얹는다.
 *
 * 페이지 넘김은 조건 토글과 달리 **진짜 이동**이라 앵커다 — `href`가 곧 그 페이지의 주소이고,
 * 눌러서 가는 것과 주소를 붙여넣어 여는 것이 같다.
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

export function PageNavigation({
  current,
  totalPages,
  hrefOf,
}: {
  current: number;
  totalPages: number;
  /** 그 페이지를 여는 주소. 한 화면에 페이지네이션은 하나뿐이라 표기는 공통으로 둔다. */
  hrefOf: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const page = Math.min(Math.max(current, 1), totalPages);
  const atFirst = page === 1;
  const atLast = page === totalPages;

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
                href={hrefOf(Math.max(page - 1, 1))}
                prefetch={false}
                aria-label="이전 페이지"
              />
            }
          />
        </PaginationItem>

        {pageSlots(page, totalPages).map((slot, index) =>
          slot === "gap" ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={slot}>
              <PaginationLink
                isActive={slot === page}
                render={
                  <Link
                    href={hrefOf(slot)}
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
                href={hrefOf(Math.min(page + 1, totalPages))}
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
