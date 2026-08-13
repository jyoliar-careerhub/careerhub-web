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
 * 봉인을 푼다. 위조·키 불일치·형식 이탈은 전부 `null`이다 — 부르는 쪽에서 "세션 없음"과
 * 같게 다루면 되고, 그래서 키를 회전시키면 기존 세션이 조용히 만료된다.
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
