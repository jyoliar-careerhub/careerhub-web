import Image from "next/image";
import { ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { JobPostingDetail } from "@/lib/api/job-postings";

/**
 * 회사 옆단 — 본문을 읽는 내내 따라오는 **한눈 요약**이다.
 *
 * 여기 있는 것은 긴 글을 읽는 도중에도 답이 필요한 것들이다: 어느 회사인가, 경력을 얼마나
 * 요구하는가, 어디로 출근하는가, 어디로 지원하는가. 그래서 넓은 화면에서는 스크롤을 따라
 * 붙어 오고, 좁은 화면에서는 **본문보다 먼저** 한 번 놓인다 — 긴 본문 끝에 두면
 * 지원 경로가 가장 멀어진다.
 *
 * 스크랩은 로그인 상태에 딸린 요소라 이 화면의 범위 밖이다 (ops-workflow#71 Technical Notes).
 */

/** 원천은 스킴 없는 주소를 주기도 한다 — 그대로 두면 앱 안의 경로로 읽힌다. */
function absoluteUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

function careerText(min: number | null, max: number | null): string {
  if (min && max) return `${min}~${max}년`;
  if (min) return `${min}년 이상`;
  if (max) return `${max}년 이하`;
  return "경력무관";
}

export function CompanyAside({ posting }: { posting: JobPostingDetail }) {
  const logo = posting.companyLogo.trim();
  const homepage = posting.companyUrl?.trim() ?? "";
  const applyUrl = posting.postUrl.trim();
  const addresses = posting.addresses ?? [];

  return (
    <aside
      aria-label="회사 정보"
      className="order-first flex flex-col gap-4 rounded-xl border p-4 lg:order-none lg:sticky lg:top-8"
    >
      <div className="flex items-center gap-3">
        {logo === "" ? null : (
          <Image
            src={logo}
            alt=""
            width={70}
            height={70}
            className="size-12 rounded-lg object-contain"
          />
        )}
        <p className="font-heading text-base font-semibold">{posting.companyName}</p>
      </div>

      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">경력</dt>
          <dd data-slot="job-posting-detail-career">
            {careerText(posting.careerMin, posting.careerMax)}
          </dd>
        </div>

        {addresses.length === 0 ? null : (
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">근무지역</dt>
            <dd>
              <ul className="flex flex-col gap-1">
                {addresses.map((address) => (
                  <li key={address}>{address}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}

        {homepage === "" ? null : (
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">홈페이지</dt>
            <dd>
              <a
                href={absoluteUrl(homepage)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 break-all hover:underline"
              >
                {homepage}
                <ExternalLinkIcon className="size-3.5 shrink-0" />
              </a>
            </dd>
          </div>
        )}
      </dl>

      {applyUrl === "" ? null : (
        <Button
          className="w-full"
          render={<a href={absoluteUrl(applyUrl)} target="_blank" rel="noreferrer" />}
        >
          지원하러 가기
          <ExternalLinkIcon data-icon="inline-end" />
        </Button>
      )}
    </aside>
  );
}
