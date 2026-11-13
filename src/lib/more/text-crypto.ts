import { base64Url, base64ToBytes, fromUtf8, utf8 } from "./util";

const PREFIX = "CK1.";
export const DEFAULT_ITERATIONS = 600_000;

async function deriveKey(pass: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", utf8(pass) as BufferSource, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** PBKDF2-SHA256 + AES-256-GCM。形式: "CK1." + Base64URL(反復回数4B | salt16B | iv12B | 暗号文+タグ) */
export async function encryptText(text: string, pass: string, iterations = DEFAULT_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, await deriveKey(pass, salt, iterations), utf8(text) as BufferSource));
  const out = new Uint8Array(4 + 16 + 12 + ct.length);
  new DataView(out.buffer).setUint32(0, iterations);
  out.set(salt, 4); out.set(iv, 20); out.set(ct, 32);
  return PREFIX + base64Url(out);
}

export async function decryptText(token: string, pass: string): Promise<string> {
  const t = token.trim();
  if (!t.startsWith(PREFIX)) throw new Error("bad-format");
  const data = base64ToBytes(t.slice(PREFIX.length));
  if (!data || data.length < 32 + 16) throw new Error("bad-format");
  const iterations = new DataView(data.buffer, data.byteOffset).getUint32(0);
  if (iterations < 1000 || iterations > 10_000_000) throw new Error("bad-format");
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(20, 32) as BufferSource }, await deriveKey(pass, data.slice(4, 20), iterations), data.slice(32) as BufferSource);
    return fromUtf8(new Uint8Array(pt));
  } catch {
    throw new Error("wrong-passphrase");
  }
}
