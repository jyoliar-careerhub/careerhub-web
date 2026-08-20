import { redirect } from "next/navigation";

import { loginEntryUrl } from "@/lib/auth";
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
 * 로그인 화면 — 인증 수단의 진입점을 제시하는 것이 전부다.
 *
 * **여정은 "인증 수단이 제시된다"까지다**(e2e 명세 `login.spec.ts`). 진입점은 앱 밖,
 * 곧 발급자의 authorize endpoint를 직접 가리키는 앵커다 — 같은 오리진의 라우트를 거쳐
 * 리다이렉트하면 "인증 제공자는 앱 밖에 있다"가 화면에서 드러나지 않는다.
 *
 * 그래서 진입 버튼은 `Button`의 `render`로 **앵커를 유지한 채** 스타일만 입힌다
 * (Base UI에는 Radix의 `asChild`가 없고 `render`가 그 자리다 — ops-workflow#72).
 * `<main>` 안의 앵커는 이것 하나여야 한다 — e2e가 main 안 모든 `a[href]`의 오리진을
 * 보고 "인증 제공자는 앱 밖에 있다"를 판정한다.
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
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">로그인할 수 없습니다</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTitle>브라우저가 쿠키를 저장하지 않습니다</AlertTitle>
              <AlertDescription>
                쿠키를 허용한 뒤 다시 시도해 주세요.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">로그인</CardTitle>
          <CardDescription>
            인증은 careerhub 밖의 인증 제공자가 처리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {failed ? (
            <Alert variant="destructive">
              <AlertTitle>로그인이 완료되지 않았습니다</AlertTitle>
              <AlertDescription>다시 시도해 주세요.</AlertDescription>
            </Alert>
          ) : null}

          <Button
            size="lg"
            className="w-full"
            nativeButton={false}
            render={<a href={authorizeUrl} />}
          >
            Google 계정으로 계속하기
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
