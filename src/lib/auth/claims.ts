/**
 * 토큰 클레임의 해석 — **토큰을 디코드하는 유일한 자리**다.
 *
 * 권한은 sign-in 응답이 아니라 토큰 클레임에서 온다(ADR-0031 — 발급 시점 클레임 주입).
 * 그래서 클레임 조회는 "토큰의 읽기"에 딸리고, 화면·컴포넌트는 여기서 나온 값만 본다
 * (ops-workflow#8).
 *
 * **프론트는 토큰을 검증하지 않는다**(ADR-0029 — 검증은 데이터 경로의 소비자, 곧
 * api-composer의 몫이다). 여기서 하는 것은 디코드뿐이고, 그 결과는 화면 표시를 위한
 * 힌트지 인가 판정의 근거가 아니다. 서명을 확인하지 않으므로 신뢰 경계를 넘지 않는다.
 */

/**
 * 권한이 실리는 클레임 이름.
 *
 * 무엇이 실릴지는 Zitadel 발급 훅(Actions v2)의 설정이 정한다 — ADR-0031이 "클레임의
 * 이름·모양은 코드의 관할"이라 남긴 자리다. 훅을 세우는 티켓이 확정하면 이 한 줄을 고친다.
 */
const AUTHORITIES_CLAIM = "authorities";

/** 화면이 볼 수 있는 세션의 사실. 토큰 문자열은 여기 담기지 않는다. */
export interface SessionClaims {
  /** 전역 사용자 식별자 — Zitadel이 발급한 `sub`를 그대로 쓴다 (ADR-0028). */
  subject: string | null;
  /** 발급 시점 스냅샷이다 — 회수·부여의 발효는 토큰 갱신에 묶인다 (ADR-0031). */
  authorities: readonly string[];
  /** `exp`를 epoch ms로. 클레임에 없으면 `null`. */
  expiresAt: number | null;
}

function decodeBase64Url(segment: string): string | null {
  const padded = segment
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(segment.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  // 레거시가 쿠키에 콤마로 이어 담았듯, 훅이 문자열 하나로 실을 수도 있다.
  if (typeof value === "string" && value.length > 0) {
    return value.split(",").map((item) => item.trim());
  }
  return [];
}

/**
 * access token의 payload를 읽는다. 형식이 JWT가 아니거나 깨졌으면 `null`.
 *
 * 이 모듈 안에서만 부른다 — 밖에서는 `getSessionClaims()`를 쓴다.
 */
export function decodeClaims(accessToken: string): SessionClaims | null {
  const payloadSegment = accessToken.split(".")[1];
  if (payloadSegment === undefined) {
    return null;
  }

  const json = decodeBase64Url(payloadSegment);
  if (json === null) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const subject = record["sub"];
  const expiresAt = record["exp"];

  return {
    subject: typeof subject === "string" ? subject : null,
    authorities: asStringArray(record[AUTHORITIES_CLAIM]),
    // `exp`는 epoch 초다 — 저장·비교는 ms로 통일한다.
    expiresAt: typeof expiresAt === "number" ? expiresAt * 1000 : null,
  };
}
