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
 *
 * ---
 *
 * **없는 것과 어긋난 것을 가른다.**
 *
 * 발급 훅은 원장에 없는 사용자에게 **빈 `append_claims`로 응답한다**(200) —
 * 그러면 `careerhub:*` 키가 아예 없다. 그것은 정상이고 "권한이 없다"가 맞는 해석이다.
 * 반면 키가 **있는데 모양이 다르면** 발급 훅·제품 설정이 깨진 것이다. 그때 빈 값으로
 * 넘어가면 화면은 조용히 "권한 없음"을 그리고 아무도 고장을 모른다 —
 * 그래서 어긋난 모양은 던진다.
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
 * 토큰이 계약과 다른 모양으로 왔다 — 발급 훅이나 제품 설정이 깨졌다는 뜻이다.
 *
 * 사용자의 문제가 아니므로 로그인 실패로 다루지 않는다. 그대로 터뜨려서 서버 로그와
 * 오류 화면에 남긴다 — 조용히 빈 값을 흘리면 "권한이 없다"와 구분되지 않는다.
 *
 * 이것을 던져도 안전한 이유: 여기 오는 토큰은 봉인된 쿠키에서 나왔고(봉인이 풀리지 않는
 * 값은 애초에 세션 없음으로 처리된다) 그 값은 TLS로 발급자에게 직접 받은 것이다.
 * 즉 밖에서 아무 문자열이나 밀어 넣어 이 오류를 유발할 수 없다.
 */
export class ClaimContractError extends Error {
  constructor(detail: string) {
    super(`토큰 클레임이 계약과 다르다: ${detail}`);
    this.name = "ClaimContractError";
  }
}

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
  /** 만료 시각. `null`이면 무기한 — 계약이 nullable로 선언한 값이다. */
  expiresAt: Date | null;
}

/** 화면이 볼 수 있는 세션의 사실. 토큰 문자열은 여기 담기지 않는다. */
export interface SessionClaims {
  /** 전역 사용자 식별자 — Zitadel이 발급한 `sub`를 그대로 쓴다 (ADR-0028). */
  subject: string;
  /** 발급 시점 스냅샷이다 — 부여·회수의 발효는 토큰 갱신에 묶인다 (ADR-0031). */
  authorities: readonly Authority[];
  /** 필수 약관 동의를 마쳤는가. 온보딩 게이트의 입력이다. */
  agreementsFulfilled: boolean;
  /** `exp`를 epoch ms로. */
  expiresAt: number;
}

function toAuthority(item: unknown, index: number): Authority {
  const at = `${CLAIM_AUTHORITIES}[${index}]`;
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    throw new ClaimContractError(`${at}가 객체가 아니다`);
  }

  const record = item as Record<string, unknown>;
  const code = record["code"];
  if (typeof code !== "string" || code === "") {
    throw new ClaimContractError(`${at}.code가 비어 있거나 문자열이 아니다`);
  }

  // 계약상 required이면서 nullable이다 — `null`은 무기한이고, 없는 것은 어긋난 것이다.
  if (!("expiresAt" in record)) {
    throw new ClaimContractError(`${at}.expiresAt이 없다 (무기한이면 null이어야 한다)`);
  }
  const expiresAt = record["expiresAt"];
  if (expiresAt === null) {
    return { code, expiresAt: null };
  }
  if (typeof expiresAt !== "string") {
    throw new ClaimContractError(`${at}.expiresAt이 문자열도 null도 아니다`);
  }

  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new ClaimContractError(`${at}.expiresAt이 시각으로 읽히지 않는다: ${expiresAt}`);
  }
  return { code, expiresAt: parsed };
}

function toAuthorities(value: unknown): readonly Authority[] {
  // 원장에 없는 사용자 — 훅이 빈 응답을 냈고 키가 아예 없다. 정상이다.
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ClaimContractError(`${CLAIM_AUTHORITIES}가 배열이 아니다`);
  }
  return value.map(toAuthority);
}

function toAgreementsFulfilled(value: unknown): boolean {
  // 위와 같다 — 키가 없으면 원장 밖 사용자이고, 동의를 마치지 않은 것이 맞는 해석이다.
  if (value === undefined) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new ClaimContractError(`${CLAIM_AGREEMENTS_FULFILLED}가 boolean이 아니다`);
  }
  return value;
}

/**
 * access token의 payload를 읽는다.
 *
 * 이 모듈 안에서만 부른다 — 밖에서는 `getSessionClaims()`를 쓴다.
 *
 * @throws {ClaimContractError} 토큰이 JWT가 아니거나 클레임 모양이 계약과 다를 때
 */
export function decodeClaims(accessToken: string): SessionClaims {
  // 액세스 토큰은 JWT로 발급된다(구성 선언의 `accessTokenType: OIDC_TOKEN_TYPE_JWT`).
  // 아니라면 제품 설정이 뒤집힌 것이고, 로컬 검증(ADR-0029)·클레임 주입(ADR-0031)의
  // 전제가 통째로 깨진 상태다 — 조용히 넘길 일이 아니다.
  const payloadSegment = accessToken.split(".")[1];
  if (payloadSegment === undefined) {
    throw new ClaimContractError("액세스 토큰이 JWT가 아니다 (세그먼트 부족)");
  }

  const decoded = decodeBase64Url(payloadSegment);
  if (decoded === null) {
    throw new ClaimContractError("JWT payload가 base64url이 아니다");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(decoded));
  } catch {
    throw new ClaimContractError("JWT payload가 JSON이 아니다");
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new ClaimContractError("JWT payload가 객체가 아니다");
  }

  const record = payload as Record<string, unknown>;

  const subject = record["sub"];
  if (typeof subject !== "string" || subject === "") {
    throw new ClaimContractError("`sub`이 없다 — 사용자를 식별할 수 없다");
  }

  const expiresAt = record["exp"];
  if (typeof expiresAt !== "number") {
    // 없으면 만료를 알 수 없고, 그러면 죽은 토큰을 영원히 살아 있다고 보게 된다.
    throw new ClaimContractError("`exp`가 없다 — 만료를 알 수 없다");
  }

  return {
    subject,
    authorities: toAuthorities(record[CLAIM_AUTHORITIES]),
    agreementsFulfilled: toAgreementsFulfilled(record[CLAIM_AGREEMENTS_FULFILLED]),
    // `exp`는 epoch 초다 — 저장·비교는 ms로 통일한다.
    expiresAt: expiresAt * 1000,
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
