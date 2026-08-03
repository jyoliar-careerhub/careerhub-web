import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PostingRef } from "./driver";
import type { WiringName } from "./options";

/**
 * 데이터 전제 — 시나리오가 요구하는 것은 데이터의 *내용*이 아니라 *존재*다.
 *
 * 여기 담기는 값은 **실행 시점에 실데이터에서 발견한 것**이지 명세에 박힌 구체값이 아니다.
 * 화면이 보여주는 값(검색할 기술스택·회사)은 아예 담지 않는다 — 시나리오가 목록에서 직접 읽는다.
 * 여기 남는 것은 **화면만 봐서는 알 수 없는 것**뿐이다: 어떤 공고에 리뷰가 달렸는지 같은 것.
 */
export interface PreconditionData {
  /** 결과를 좁힐 수 있다고 확인된 최소 경력(년). */
  filterableMinCareer: number;
  /** 회사 리뷰가 달려 있다고 확인된 공고. */
  postingWithReviews: PostingRef;
  /** 리뷰가 가장 많아 두 페이지 이상 나올 공고. */
  postingWithPagedReviews: PostingRef;
}

/**
 * 목록이 두 페이지 이상 나온다고 볼 하한.
 *
 * 한 페이지에 몇 개를 보이는지는 **앱이 정한다** — 이 값은 "알려진 가장 큰 페이지 크기"로 둔 하한이고,
 * 새 앱이 더 크게 잡으면 여기도 올려야 한다(기존 앱은 16).
 */
export const MIN_POSTINGS_FOR_PAGINATION = 16;

/** 리뷰가 두 페이지 이상 나온다고 볼 하한. 위와 같은 성격이다(기존 앱은 10). */
export const MIN_REVIEWS_FOR_PAGINATION = 10;

/** 백엔드가 요구하는 질의 표현의 빈 값 — 필터를 안 건 상태다. 이 파라미터는 계약상 필수다. */
export const EMPTY_QUERY = {
  categories: [] as unknown[],
  skillNames: [] as string[][],
  tagIds: [] as unknown[],
  minCareer: null as number | null,
  maxCareer: null as number | null,
  companies: [] as unknown[],
};

export type PostingQuery = typeof EMPTY_QUERY;

export function encodeQuery(query: PostingQuery): string {
  return encodeURIComponent(
    Buffer.from(JSON.stringify(query), "utf-8").toString("base64"),
  );
}

const DATA_DIR = path.join(process.cwd(), "e2e", ".data");

function dataFile(wiring: WiringName): string {
  return path.join(DATA_DIR, `preconditions.${wiring}.json`);
}

export function writePreconditionData(
  wiring: WiringName,
  data: PreconditionData,
): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(dataFile(wiring), JSON.stringify(data, null, 2), "utf-8");
}

export function readPreconditionData(
  wiring: WiringName,
): PreconditionData | null {
  const file = dataFile(wiring);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf-8")) as PreconditionData;
}
