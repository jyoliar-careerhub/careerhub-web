import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JobPosting } from "@/lib/api/job-postings";

/**
 * 목록에 나열되는 공고 하나.
 *
 * 카드가 말해야 하는 것은 **다음 행동을 고를 수 있을 만큼**이다 — 무슨 자리인지(제목),
 * 어디인지(회사), 무엇을 쓰는지(기술스택), 어느 직군·경력인지. 이 넷이 곧 좁히는 축이라
 * 사용자는 카드에서 본 값으로 다음 조건을 건다.
 *
 * **기술스택도 직군도 자르지 않는다.** 조건을 걸고 나면 "이 결과가 정말 그 조건의 공고인가"를
 * 카드에서 확인하게 되는데, 접어 둔 항목이 있으면 그 확인이 성립하지 않는다.
 *
 * 로그인 상태에 따른 요소(스크랩)는 이 화면의 범위 밖이다 — 인증 화면 재작성에서 다룬다.
 */

/**
 * 카드에 내는 기술스택의 상한.
 *
 * 스무 개를 늘어놓으면 카드가 목록의 리듬을 깨고, 그 카드만 읽는 데 다른 카드 세 개만큼의
 * 자리를 쓴다. 몇 개가 더 있는지는 남겨 둔다 — 상세에서 전부 본다.
 * (직군은 자르지 않는다 — 그 축은 "이 결과가 정말 그 직군인가"를 카드에서 확인하는 데 쓰인다.)
 */
const VISIBLE_SKILLS = 8;

function careerText(minCareer: number | null, maxCareer: number | null): string {
  if (minCareer && maxCareer) {
    return `경력 ${minCareer}~${maxCareer}년`;
  }
  if (minCareer) {
    return `경력 ${minCareer}년 이상`;
  }
  if (maxCareer) {
    return `경력 ${maxCareer}년 이하`;
  }
  return "경력무관";
}

function firstRegionOf(addresses: string[] | null): string | null {
  const address = addresses?.[0];
  if (address === undefined) {
    return null;
  }
  // 주소 전체는 카드에 담기에 길다 — 시/도와 구/군까지가 자리를 고르는 데 쓰인다.
  const parts = address.split(" ").filter((part) => part !== "");
  return parts.slice(0, 2).join(" ") || null;
}

export function jobPostingHref(posting: JobPosting): string {
  return `/job_posting/${encodeURIComponent(posting.site)}/${encodeURIComponent(posting.postingId)}`;
}

export function JobPostingCard({
  posting,
  eager = false,
}: {
  posting: JobPosting;
  /** 첫 화면에 보이는 카드인가 — 그 이미지는 미루지 않는다(LCP). */
  eager?: boolean;
}) {
  const skills = posting.skills ?? [];
  const shownSkills = skills.slice(0, VISIBLE_SKILLS);
  const hiddenSkillCount = skills.length - shownSkills.length;
  const categories = posting.categories ?? [];
  const region = firstRegionOf(posting.addresses);
  const reviewCount = posting.reviewInfo?.reviewCount ?? 0;

  return (
    <Card
      data-slot="job-posting"
      className="relative h-full transition-shadow hover:ring-foreground/25"
    >
      {posting.imageUrl === null ? null : (
        // Card가 첫 자식 `img`의 위 여백을 걷고 모서리를 둥글린다 — 그 규약에 맞춘다.
        <Image
          src={posting.imageUrl}
          alt=""
          width={1080}
          height={790}
          priority={eager}
          className="h-32 w-full object-cover"
        />
      )}

      <CardHeader>
        <CardTitle>
          <Link
            href={jobPostingHref(posting)}
            data-slot="job-posting-title"
            // 한 화면에 카드가 열여섯이다 — 전부 미리 받아 둘 이유가 없다.
            prefetch={false}
            // 카드 전체가 상세로 가는 과녁이 된다 — 제목만 눌러야 하는 카드는 쓰기 어렵다.
            className="line-clamp-2 before:absolute before:inset-0 hover:underline"
          >
            {posting.title}
          </Link>
        </CardTitle>
        <CardDescription data-slot="job-posting-company">
          {posting.companyName}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {categories.length === 0 ? null : (
          <ul data-slot="job-posting-categories" className="flex flex-wrap gap-1">
            {categories.map((category) => (
              <li key={category}>
                <Badge variant="secondary">{category}</Badge>
              </li>
            ))}
          </ul>
        )}

        {shownSkills.length === 0 ? null : (
          <div className="flex flex-wrap items-center gap-1">
            {/* 더 있다는 표시는 목록 **밖**에 둔다 — 안에 두면 그것도 기술스택으로 읽힌다. */}
            <ul data-slot="job-posting-skills" className="contents">
              {shownSkills.map((skill) => (
                <li key={skill}>
                  <Badge variant="outline">{skill}</Badge>
                </li>
              ))}
            </ul>
            {hiddenSkillCount === 0 ? null : (
              <span className="text-xs text-muted-foreground">
                +{hiddenSkillCount}
              </span>
            )}
          </div>
        )}

        <p className="mt-auto flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span data-slot="job-posting-career">
            {careerText(posting.minCareer, posting.maxCareer)}
          </span>
          {region === null ? null : <span>{region}</span>}
          {reviewCount === 0 ? null : (
            <span data-slot="job-posting-reviews">리뷰 {reviewCount}개</span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
