import { redirect } from "next/navigation";

import { getAuthorities, getSessionClaims, sessionCookieBytes } from "@/lib/auth";
import { listScrapJobs, UnauthorizedError } from "@/lib/api/scrap-jobs";

/**
 * 로그인 이후의 착지 화면.
 *
 * 화면을 짓는 것이 이 티켓의 일은 아니다(그 지붕은 ops-workflow#6). 여기 있는 것은
 * **배선이 실제로 동작함을 화면에서 확인할 수 있는 최소한**이다 — 세션이 섰는가,
 * 보호 API 호출에 토큰이 실리는가, 로그아웃이 세션을 끝내는가 (ops-workflow#59 AC).
 *
 * 서버 컴포넌트인 것이 D1의 귀결이다: 토큰을 아는 것은 Next 서버뿐이라 인증이 얽힌
 * 호출은 서버를 경유한다(`260722_1617` §11 판정).
 */
export default async function MyPage() {
  const claims = await getSessionClaims();
  if (claims === null) {
    redirect("/login");
  }

  const authorities = await getAuthorities();
  const cookieBytes = await sessionCookieBytes();

  let scrapCount: number | null = null;
  let apiFailure: string | null = null;
  try {
    scrapCount = (await listScrapJobs()).length;
  } catch (error) {
    apiFailure =
      error instanceof UnauthorizedError
        ? "401 — 토큰이 실리지 않았거나 유효하지 않다"
        : error instanceof Error
          ? error.message
          : "알 수 없는 오류";
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">로그인됨</h1>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt>subject</dt>
        <dd>{claims.subject}</dd>

        <dt>권한</dt>
        <dd>
          {authorities.length === 0
            ? "(없음)"
            : authorities.map((authority) => authority.code).join(", ")}
        </dd>

        <dt>약관 동의</dt>
        <dd>{claims.agreementsFulfilled ? "충족" : "미충족"}</dd>

        <dt>보호 API(/my/scrap-job)</dt>
        <dd>{apiFailure ?? `${scrapCount}건 — 토큰이 실렸다`}</dd>

        <dt>세션 쿠키 크기</dt>
        <dd>{cookieBytes === null ? "(없음)" : `${cookieBytes}B`}</dd>
      </dl>

      <form action="/auth/logout" method="post">
        <button
          type="submit"
          className="rounded-md bg-primary px-6 py-3 text-lg text-primary-foreground hover:bg-primary/90"
        >
          로그아웃
        </button>
      </form>
    </main>
  );
}
