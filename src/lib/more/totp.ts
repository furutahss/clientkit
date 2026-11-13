import type { Algo } from "./webhook";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Uint8Array | null {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  if (!clean || /[^A-Z2-7]/.test(clean)) return null;
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Uint8Array.from(out);
}

export type OtpParams = { secret: Uint8Array; algo: "SHA-1" | "SHA-256" | "SHA-512"; digits: number; period: number; type: "totp" | "hotp"; counter: number; issuer: string; label: string };

export function parseOtpauth(input: string): OtpParams | null {
  const text = input.trim();
  const defaults = { algo: "SHA-1" as const, digits: 6, period: 30, type: "totp" as const, counter: 0, issuer: "", label: "" };
  if (!/^otpauth:\/\//i.test(text)) {
    const secret = base32Decode(text);
    return secret ? { ...defaults, secret } : null;
  }
  let url: URL;
  try { url = new URL(text); } catch { return null; }
  const secret = base32Decode(url.searchParams.get("secret") ?? "");
  if (!secret) return null;
  const algo = ({ SHA1: "SHA-1", SHA256: "SHA-256", SHA512: "SHA-512" } as const)[(url.searchParams.get("algorithm") ?? "SHA1").toUpperCase() as "SHA1"] ?? "SHA-1";
  const label = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  return {
    secret, algo, type: url.hostname.toLowerCase() === "hotp" ? "hotp" : "totp",
    digits: Number(url.searchParams.get("digits") ?? 6) || 6,
    period: Number(url.searchParams.get("period") ?? 30) || 30,
    counter: Number(url.searchParams.get("counter") ?? 0) || 0,
    issuer: url.searchParams.get("issuer") ?? label.split(":")[0] ?? "", label,
  };
}

async function hmacBytes(secret: Uint8Array, msg: Uint8Array, algo: Algo): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", secret as BufferSource, { name: "HMAC", hash: algo }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, msg as BufferSource));
}

/** RFC 4226 HOTP */
export async function hotp(secret: Uint8Array, counter: number, digits = 6, algo: Algo = "SHA-1"): Promise<string> {
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setBigUint64(0, BigInt(counter));
  const h = await hmacBytes(secret, msg, algo);
  const o = h[h.length - 1] & 0xf;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

/** RFC 6238 TOTP。前後のウィンドウも返す（時計ずれの確認用） */
export async function totpWindows(p: OtpParams, nowMs: number, around = 1) {
  const step = Math.floor(nowMs / 1000 / p.period);
  const out: { offset: number; code: string; validFrom: number; validUntil: number }[] = [];
  for (let off = -around; off <= around; off++) out.push({ offset: off, code: await hotp(p.secret, step + off, p.digits, p.algo), validFrom: (step + off) * p.period * 1000, validUntil: (step + off + 1) * p.period * 1000 });
  return { windows: out, remaining: p.period - (Math.floor(nowMs / 1000) % p.period) };
}
