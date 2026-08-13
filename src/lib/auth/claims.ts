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

import { decodeBase64Url } from "./base64url";

/**
 * 발급 훅이 싣는 클레임의 이름. 원천은 auth-service이고 계약은 그쪽에 있다 —
 * `spec/issuance-hook/openapi.yaml` · `auth_service/issuancehook/claims.go`.
 *
 * `careerhub:` 네임스페이스인 것은 제품이 `urn:zitadel:iam` 접두를 버리는 것과
 * 표준 클레임 키와 부딪혀 로그 클레임으로 밀리는 것을 피하기 위해서다(같은 파일의 주석).
 */
const CLAIM_AUTHORITIES = "careerhub:authorities";
const CLAIM_AGREEMENTS_FULFILLED = "careerhub:agreements_fulfilled";

/**
 * 권한 하나.
 *
 * 만료된 권한은 애초에 실리지 않는다. 그럼에도 `expiresAt`이 동봉되는 것은 클레임이
 * 발급 시점 스냅샷이고 액세스 토큰 수명이 그 스냅샷의 유효기간이기 때문이다 —
 * **수명 안에서 만료되는 권한은 보는 쪽이 걸러야 한다**(발급 훅 계약의 명시).
 */
export interface Authority {
  /** 권한 코드 (`authority.authority_code`) — 예: `AUTHORITY_ADMIN` */
  code: string;
  /** 만료 시각. `null`이면 무기한. */
  expiresAt: Date | null;
}

/** 화면이 볼 수 있는 세션의 사실. 토큰 문자열은 여기 담기지 않는다. */
export interface SessionClaims {
  /** 전역 사용자 식별자 — Zitadel이 발급한 `sub`를 그대로 쓴다 (ADR-0028). */
  subject: string | null;
  /** 발급 시점 스냅샷이다 — 부여·회수의 발효는 토큰 갱신에 묶인다 (ADR-0031). */
  authorities: readonly Authority[];
  /** 필수 약관 동의를 마쳤는가. 온보딩 게이트의 입력이다. */
  agreementsFulfilled: boolean;
  /** `exp`를 epoch ms로. 클레임에 없으면 `null`. */
  expiresAt: number | null;
}

function toAuthority(item: unknown): Authority | null {
  if (typeof item !== "object" || item === null) {
    return null;
  }
  const record = item as Record<string, unknown>;
  const code = record["code"];
  if (typeof code !== "string" || code === "") {
    return null;
  }

  const expiresAt = record["expiresAt"];
  if (typeof expiresAt !== "string") {
    return { code, expiresAt: null };
  }
  const parsed = new Date(expiresAt);
  return {
    code,
    expiresAt: Number.isNaN(parsed.getTime()) ? null : parsed,
  };
}

function toAuthorities(value: unknown): readonly Authority[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(toAuthority)
    .filter((authority): authority is Authority => authority !== null);
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

  const decoded = decodeBase64Url(payloadSegment);
  if (decoded === null) {
    return null;
  }
  const json = new TextDecoder().decode(decoded);

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
    authorities: toAuthorities(record[CLAIM_AUTHORITIES]),
    agreementsFulfilled: record[CLAIM_AGREEMENTS_FULFILLED] === true,
    // `exp`는 epoch 초다 — 저장·비교는 ms로 통일한다.
    expiresAt: typeof expiresAt === "number" ? expiresAt * 1000 : null,
  };
}

/** 지금 시점에 살아 있는 권한만. 스냅샷 안에서 만료된 것을 걸러낸다. */
export function effectiveAuthorities(
  claims: SessionClaims,
  now: number = Date.now(),
): readonly Authority[] {
  return claims.authorities.filter(
    (authority) => authority.expiresAt === null || authority.expiresAt.getTime() > now,
  );
}
