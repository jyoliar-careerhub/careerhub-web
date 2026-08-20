import Image from "next/image";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { JobPostingDetail } from "@/lib/api/job-postings";

/**
 * 공고 본문 — 원천이 준 긴 글을 그대로 읽히게 놓는다.
 *
 * 값은 손대지 않는다. 원천이 줄바꿈으로 문단과 목록을 만들어 두었으므로 그것을 살리고
 * (`whitespace-pre-wrap`), 사이트마다 다른 개행 표기(`\r\n`)만 하나로 맞춘다 —
 * 그대로 두면 문서에 보이지 않는 문자가 남는다.
 *
 * 비어 있는 절은 그리지 않는다. 원천이 채우지 않은 칸을 제목만 남겨 두면 "이 회사는
 * 우대사항이 없다"로 읽히는데, 실제로는 수집되지 않은 것이다.
 *
 * 근무 조건(경력·근무지역)은 여기 없다 — 읽는 내내 곁에 있어야 하는 값이라 옆단에 산다.
 */

/** 사이트마다 다른 개행 표기를 하나로 — 값의 의미는 그대로다. */
function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function TextSection({ title, body }: { title: string; body: string | null }) {
  const text = body === null ? "" : normalizeText(body);
  if (text === "") {
    return null;
  }
  return (
    <Section title={title}>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
    </Section>
  );
}

export function PostingSections({ posting }: { posting: JobPostingDetail }) {
  const skills = posting.skills ?? [];
  const companyImages = posting.companyImages ?? [];
  const intro = normalizeText(posting.intro);

  return (
    <>
      {skills.length === 0 ? null : (
        <Section title="기술스택">
          <ul data-slot="job-posting-detail-skills" className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <li key={skill}>
                <Badge variant="outline">{skill}</Badge>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <TextSection title="주요업무" body={posting.mainTask} />
      <TextSection title="자격요건" body={posting.qualifications} />
      <TextSection title="우대사항" body={posting.preferred} />
      <TextSection title="복지 및 혜택" body={posting.benefits} />
      <TextSection
        title="채용절차 및 기타 지원 유의사항"
        body={posting.recruitProcess}
      />

      {companyImages.length === 0 && intro === "" ? null : (
        <Section title="기업/서비스 소개">
          {companyImages.length === 0 ? null : (
            // 넘치는 만큼 옆으로 민다 — 캐러셀은 JS를 요구하고, 그만큼의 값을 하지 않는다.
            <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
              {companyImages.map((image) => (
                <li key={image} className="shrink-0 snap-start">
                  <Image
                    src={image}
                    alt=""
                    width={1080}
                    height={790}
                    className="h-40 w-64 rounded-lg object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
          {intro === "" ? null : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{intro}</p>
          )}
        </Section>
      )}
    </>
  );
}
