import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PostingRef } from "./driver";
import type { WiringName } from "./options";

/**
 * 데이터 전제 — 시나리오가 요구하는 것은 데이터의 *내용*이 아니라 *존재*다.
 *
 * 여기 담기는 값(기술스택 이름·공고 좌표)은 **실행 시점에 실데이터에서 발견한 것**이다.
 * 명세에 박힌 구체값이 아니므로 데이터가 갈려도 명세는 흔들리지 않는다 (ops-workflow#9).
 */
export interface PreconditionData {
  /** 결과를 좁힐 수 있다고 확인된 기술스택 이름. */
  searchableSkill: string;
  /** 검색으로 찾을 수 있다고 확인된 회사 이름. */
  searchableCompany: string;
  /** 결과를 좁힐 수 있다고 확인된 최소 경력(년). */
  filterableMinCareer: number;
  /** 회사 리뷰가 달려 있다고 확인된 공고. */
  postingWithReviews: PostingRef;
  /** 리뷰가 두 페이지 이상 나온다고 확인된 공고. */
  postingWithPagedReviews: PostingRef;
}

/** 목록이 두 페이지 이상 나오려면 최소 이만큼은 있어야 한다(기존 앱의 한 페이지 크기). */
export const MIN_POSTINGS_FOR_PAGINATION = 16;

/** 리뷰가 두 페이지 이상 나오려면 최소 이만큼은 있어야 한다(기존 앱의 리뷰 한 페이지 크기). */
export const MIN_REVIEWS_FOR_PAGINATION = 10;

/** 회사는 사이트마다 따로 존재한다 — 백엔드가 받는 좌표는 (사이트, 회사명) 짝이다. */
export interface SiteCompany {
  site: string;
  companyName: string;
}

/** 기존 앱이 백엔드에 보내는 질의의 빈 값. 필터를 안 건 상태다. */
export const EMPTY_QUERY = {
  categories: [] as unknown[],
  skillNames: [] as string[][],
  tagIds: [] as unknown[],
  minCareer: null as number | null,
  maxCareer: null as number | null,
  companies: [] as SiteCompany[],
};

export type PostingQuery = typeof EMPTY_QUERY;

/** 백엔드가 받는 질의 표현. 앱이 쓰는 것과 같은 인코딩이다. */
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
