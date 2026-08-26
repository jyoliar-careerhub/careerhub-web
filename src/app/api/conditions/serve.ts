import { ConditionApiError } from "@/lib/api/conditions";

/**
 * 조건 어휘를 브라우저에 내주는 자리 — **브라우저의 상대를 web 호스트 하나로 만든다**
 * (ops-workflow#76).
 *
 * api-composer는 내부 전용(BFF 판정)이라 공개 호스트가 없다. 그래서 브라우저가 조건 어휘를
 * 얻는 길은 여기뿐이고, composer를 부르는 것은 Next 서버다. 축은 둘(기술스택·회사)이지만
 * 하는 일이 같아 배선도 한 벌이다 — 축마다 다시 쓰지 않는다.
 *
 * 내는 모양은 composer 응답 원문이 아니라 `@/lib/api/conditions`가 **이미 다듬어 놓은 것**이다
 * (옵셔널 제거·정렬·검색어 손질). 통째로 흘려보내는 프록시가 아니라는 뜻이라, 경로도 계약의
 * 경로와 일부러 다르다.
 */
export async function serveConditions<T>(
  operation: string,
  load: () => Promise<T>,
  /** 계약이 이 응답에 선언한 캐시 수명. 브라우저가 그대로 받아 쓴다. */
  maxAgeSeconds: number,
): Promise<Response> {
  try {
    const loaded = await load();
    return Response.json(loaded, {
      // 계약의 선언을 그대로 옮긴다 — 앞단이 바뀌었다고 캐시 성질까지 바뀌지는 않는다.
      headers: { "Cache-Control": `max-age=${maxAgeSeconds}, public` },
    });
  } catch (error) {
    // composer가 낸 상태를 그대로 되돌린다 — 그 밖의 실패(주소 오설정·네트워크)는 이 계층의 것이다.
    const status = error instanceof ConditionApiError ? error.status : 502;
    return Response.json({ message: `${operation} 실패` }, { status });
  }
}
