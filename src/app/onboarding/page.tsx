import { redirect } from "next/navigation";

import { listAgreements } from "@/lib/api/agreements";
import { getSessionClaims } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * 온보딩 — 필수 약관 동의의 수집 화면 (ops-workflow#54).
 *
 * **여기 오는 판정의 입력은 클레임뿐이다**(사람 판정, 260818): 보호 화면이
 * `careerhub:agreements_fulfilled`를 읽어 미충족이면 이리로 보낸다. 동의 상태 확인 목적의
 * 조회 왕복은 없다 — 이 화면이 원장(`listAgreements`)을 부르는 것은 판정이 아니라
 * **수집의 재료**(무엇에 동의해야 하는가)를 위해서다.
 *
 * 미충족 사용자도 토큰은 있다(ADR-0028) — 그래서 이 화면과 그 호출이 성립한다.
 * 제출은 `/onboarding/submit`(POST 라우트)이 받아 기록하고 **세션을 갱신**한다 —
 * 클레임은 발급 시점 스냅샷이라(ADR-0031) 갱신 없이는 게이트가 계속 미충족을 본다.
 *
 * 필수 항목의 강제는 브라우저의 `required`가 진다(JS 없이 동작). 그것은 UX일 뿐이고,
 * 집행은 여전히 검증자(api-composer의 403)의 것이다.
 */

/** 앱 안의 경로만 받는다 — 오픈 리다이렉트를 만들지 않는다 (`/auth/start`와 같은 규칙). */
function safeNext(value: string | string[] | undefined): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/my";
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  const claims = await getSessionClaims();
  if (claims === null) {
    redirect("/login");
  }
  // 이미 충족이면 이 화면에 볼일이 없다 — 원래 가려던 곳으로.
  if (claims.agreementsFulfilled) {
    redirect(next);
  }

  const agreements = await listAgreements();
  const failed = params.error !== undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">서비스 이용 동의</CardTitle>
          <CardDescription>
            서비스를 시작하려면 필수 약관에 동의해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {failed ? (
            <Alert variant="destructive">
              <AlertTitle>동의가 저장되지 않았습니다</AlertTitle>
              <AlertDescription>다시 시도해 주세요.</AlertDescription>
            </Alert>
          ) : null}

          <form action="/onboarding/submit" method="post" className="flex flex-col gap-4">
            <input type="hidden" name="next" value={next} />
            <ul className="flex flex-col gap-3">
              {agreements.map((agreement) => (
                <li key={agreement.agreementId}>
                  {/* 제시된 전체 목록 — 체크 안 된 선택 항목을 명시적 거절로 기록하기 위한 것 */}
                  <input type="hidden" name="offered" value={agreement.agreementId} />
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      name="agreed"
                      value={agreement.agreementId}
                      required={agreement.isRequired}
                      defaultChecked={agreement.isAgree}
                      className="mt-1 size-4 accent-primary"
                    />
                    <span className="text-sm">
                      <span
                        className={
                          agreement.isRequired
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        }
                      >
                        {agreement.isRequired ? "[필수]" : "[선택]"}
                      </span>{" "}
                      {agreement.summary}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <Button type="submit" size="lg" className="w-full">
              동의하고 시작하기
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
