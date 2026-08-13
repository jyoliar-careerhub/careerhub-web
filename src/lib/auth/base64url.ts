/**
 * base64url — OIDC가 곳곳에서 쓰는 인코딩(JWT 세그먼트·PKCE·봉인 쿠키).
 *
 * 런타임 내장(`atob`/`btoa`)만 쓴다. Node·Edge 어느 쪽에서 돌든 같게 동작해야 하고,
 * 인코딩 하나 때문에 의존성을 늘릴 이유가 없다.
 */

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/**
 * 형식이 어긋나면 `null` — 밖에서 온 문자열을 다루므로 던지지 않는다.
 *
 * 결과를 `new Uint8Array(n)`으로 짓는 것은 취향이 아니라 타입 때문이다:
 * `Uint8Array.from`은 `ArrayBufferLike`(SharedArrayBuffer 포함) 위에 서서
 * WebCrypto의 `BufferSource`에 그대로 들어가지 않는다.
 */
export function decodeBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  const padded = text
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(text.length / 4) * 4, "=");

  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    return null;
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
