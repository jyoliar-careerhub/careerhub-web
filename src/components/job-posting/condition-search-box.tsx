"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { Input } from "@/components/ui/input";

/**
 * 검색어를 넣어 **후보를 받아 보고, 골라서 거는** 조건 축.
 *
 * 요점은 **넣는 것과 거는 것이 다르다**는 것이다(티켓 Requirements). 검색어는 이 컴포넌트
 * 안에만 살고 주소를 건드리지 않는다 — 그래서 넣기만 한 것으로 결과가 움직일 수가 없다.
 * 조건이 되는 것은 후보를 고르는 순간이고, 그때 일어나는 일은 **링크를 따라가는 것**이다.
 * 상태가 주소 하나에 있다는 규율이 여기서도 깨지지 않는다.
 *
 * 기술스택과 회사는 후보를 어디서 얻는지만 다르다(전체 목록에서 거르기 · 서버에 묻기).
 * 흐름이 같으므로 배선도 한 벌이면 된다 — 축마다 다시 쓰지 않는다.
 */

export interface Candidate {
  /** 후보를 구별하는 값. 표기가 겹쳐도 이것으로 가른다. */
  id: string;
  /** 사람이 읽는 표기 — 고를 수 있으려면 무엇인지 이름으로 말해야 한다. */
  label: string;
  /** 이 후보를 조건으로 걸었을 때의 주소. 고르는 순간 그리로 간다. */
  href: string;
}

/** 한 글자마다 묻지 않는다 — 사람이 잠깐 멈춘 뒤에 청한다. */
const DEBOUNCE_MS = 200;

interface ConditionSearchBoxProps {
  /** 배선이 축을 가리키는 이름(`skill`·`company`). */
  axis: string;
  label: string;
  placeholder: string;
  /** 검색어로 후보를 찾는다. 값이 바뀌면 다시 찾으므로 호출부에서 안정적으로 준다. */
  find: (keyword: string) => Promise<Candidate[]>;
}

/** 마지막으로 도착한 검색 결과 — 어느 검색어의 것인지를 함께 들고 있는다. */
interface SearchResult {
  keyword: string;
  candidates: Candidate[];
}

export function ConditionSearchBox({
  axis,
  label,
  placeholder,
  find,
}: ConditionSearchBoxProps) {
  const router = useRouter();
  const inputId = useId();
  const [keyword, setKeyword] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);

  const trimmed = keyword.trim();

  useEffect(() => {
    const needle = keyword.trim();
    if (needle === "") {
      return;
    }

    // 늦게 도착한 옛 검색어의 결과가 새 결과를 덮지 않게 한다.
    let live = true;
    const timer = setTimeout(() => {
      find(needle)
        .then((found) => {
          if (live) setResult({ keyword: needle, candidates: found });
        })
        .catch(() => {
          // 못 찾은 것과 못 물어본 것을 화면에서 가르지 않는다 — 어느 쪽이든 고를 것이 없다.
          if (live) setResult({ keyword: needle, candidates: [] });
        });
    }, DEBOUNCE_MS);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [keyword, find]);

  // 지금 검색어의 결과가 아직 없으면 찾는 중이다 — 상태를 따로 두지 않고 값으로 읽는다.
  const candidates =
    result !== null && result.keyword === trimmed ? result.candidates : null;
  const open = trimmed !== "";

  return (
    <div
      data-slot="condition-search"
      data-axis={axis}
      className="relative flex flex-col gap-1.5"
    >
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={inputId}
        type="search"
        autoComplete="off"
        placeholder={placeholder}
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />

      {open ? (
        <div
          data-slot="condition-candidates"
          aria-live="polite"
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {candidates === null || candidates.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              {candidates === null ? "찾는 중…" : "찾은 것이 없습니다"}
            </p>
          ) : (
            <ul>
              {candidates.map((candidate) => (
                <li key={candidate.id}>
                  {/* 고르는 것은 조건을 거는 동작이다 — 이동이 아니므로 버튼으로 둔다. */}
                  <button
                    type="button"
                    onClick={() => {
                      setKeyword("");
                      router.push(candidate.href);
                    }}
                    className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    {candidate.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
