import { decodeBase64Url, encodeBase64Url } from "./base64url";
import { cookieSecret } from "./config";

/**
 * 쿠키 봉인 — AES-256-GCM.
 *
 * D1이 요구하는 "암호화 HttpOnly 쿠키"의 암호 부분이다. HttpOnly가 브라우저 JS의 읽기를
 * 막고, 봉인은 그 위에서 **서버만 값을 만들 수 있게** 한다 — GCM이라 위조도 검출된다.
 *
 * 이 파일이 인증 모듈 안에 있는 것이 중요하다: 봉인 형식은 저장 매체의 상세이고,
 * D0으로 후퇴하면 통째로 필요 없어진다 (ops-workflow#8의 경계).
 */

const IV_BYTES = 12;

async function key(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    cookieSecret(),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/** 값을 봉인해 쿠키에 담을 수 있는 문자열로. IV를 앞에 붙여 한 덩어리로 만든다. */
export async function seal(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), plaintext),
  );

  const packed = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  packed.set(iv);
  packed.set(ciphertext, iv.byteLength);
  return encodeBase64Url(packed);
}

/**
 * 봉인을 푼다. 위조·키 불일치·형식 이탈은 전부 `null`이다.
 *
 * **여기서만 조용한 것이 맞다.** 이 입력은 브라우저가 보낸 쿠키, 곧 누구나 아무 값이나
 * 넣을 수 있는 문자열이다. 이상한 값에 오류를 던지면 남이 우리 서버의 오류율을 마음대로
 * 올릴 수 있으므로, "우리가 만든 값이 아니다 = 세션 없음"으로 다룬다.
 *
 * 봉인이 풀린 **뒤**의 검사는 반대다(claims.ts) — 그 값은 우리가 만들었고 발급자에게
 * TLS로 받은 것이라, 모양이 어긋나면 우리 쪽 고장이고 조용히 넘길 일이 아니다.
 *
 * 딸린 성질 하나: 키를 회전시키면 기존 세션이 전부 조용히 만료된다.
 */
export async function unseal<T>(sealed: string): Promise<T | null> {
  try {
    const packed = decodeBase64Url(sealed);
    if (packed === null || packed.byteLength <= IV_BYTES) {
      return null;
    }
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: packed.subarray(0, IV_BYTES) },
      await key(),
      packed.subarray(IV_BYTES),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}
