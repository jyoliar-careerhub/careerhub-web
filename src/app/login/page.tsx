import { redirect } from "next/navigation";

import { loginEntryUrl } from "@/lib/auth";

/**
 * 로그인 화면 — 인증 수단의 진입점을 제시하는 것이 전부다.
 *
 * **여정은 "인증 수단이 제시된다"까지다**(e2e 명세 `login.spec.ts`). 진입점은 앱 밖,
 * 곧 발급자의 authorize endpoint를 직접 가리키는 앵커다 — 같은 오리진의 라우트를 거쳐
 * 리다이렉트하면 "인증 제공자는 앱 밖에 있다"가 화면에서 드러나지 않는다.
 *
 * 진행 중인 왕복이 없으면 `/auth/start`가 열어 준다. 렌더 중에는 쿠키를 심을 수 없어서
 * 한 홉을 도는 것이고, 열린 뒤에는 그 왕복을 재사용하므로 매 렌더마다 돌지 않는다.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authorizeUrl = await loginEntryUrl();
  const params = await searchParams;
  const failed = params.error !== undefined;

  if (authorizeUrl === null) {
    // `started`는 루프 차단기다. `/auth/start`를 이미 거쳤는데도 왕복이 없다는 것은
    // 쿠키가 저장되지 않는다는 뜻이고, 그때 다시 보내면 무한 리다이렉트가 된다.
    if (params.started === undefined) {
      redirect("/auth/start?return=/login%3Fstarted%3D1");
    }

    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <h1 className="text-2xl font-semibold tracking-tight">로그인할 수 없습니다</h1>
        <p role="alert" className="text-sm">
          브라우저가 쿠키를 저장하지 않아 로그인을 시작할 수 없습니다.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>

      {failed ? (
        <p role="alert" className="text-sm text-brand-900">
          로그인이 완료되지 않았습니다. 다시 시도해 주세요.
        </p>
      ) : null}

      <a
        href={authorizeUrl}
        className="rounded-md bg-brand-500 px-6 py-3 text-lg text-background hover:bg-brand-600"
      >
        Google 계정으로 계속하기
      </a>

      <p className="text-sm">인증은 careerhub 밖의 인증 제공자가 처리합니다.</p>
    </main>
  );
}
