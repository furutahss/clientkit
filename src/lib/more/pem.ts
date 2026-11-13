import { base64ToBytes, bytesToBase64 } from "./util";

export function pemToBytes(pem: string): { label: string; bytes: Uint8Array } | null {
  const m = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(pem);
  if (!m) return null;
  const bytes = base64ToBytes(m[2]);
  return bytes ? { label: m[1], bytes } : null;
}

export function bytesToPem(bytes: Uint8Array, label: string): string {
  return `-----BEGIN ${label}-----\n${bytesToBase64(bytes).replace(/(.{64})/g, "$1\n").replace(/\n$/, "")}\n-----END ${label}-----`;
}

export function decodeOid(bytes: Uint8Array): string {
  if (!bytes.length) return "";
  const parts = [bytes[0] < 80 ? Math.floor(bytes[0] / 40) : 2, bytes[0] < 80 ? bytes[0] % 40 : bytes[0] - 80];
  let v = 0;
  for (let i = 1; i < bytes.length; i++) {
    v = v * 128 + (bytes[i] & 0x7f);
    if (!(bytes[i] & 0x80)) { parts.push(v); v = 0; }
  }
  return parts.join(".");
}
