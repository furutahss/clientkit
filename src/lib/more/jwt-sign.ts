import { pemToBytes } from "./pem";
import { base64ToBytes, base64Url, fromUtf8, utf8 } from "./util";

export type JwtAlg = "HS256" | "HS384" | "HS512" | "RS256" | "RS384" | "RS512" | "ES256" | "ES384" | "ES512";

const HASH = (alg: JwtAlg) => `SHA-${alg.slice(2)}`;
const CURVE: Record<string, string> = { ES256: "P-256", ES384: "P-384", ES512: "P-521" };

async function importKey(alg: JwtAlg, key: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  if (alg.startsWith("HS")) return crypto.subtle.importKey("raw", utf8(key) as BufferSource, { name: "HMAC", hash: HASH(alg) }, false, [usage]);
  const algo = alg.startsWith("RS") ? { name: "RSASSA-PKCS1-v1_5", hash: HASH(alg) } : { name: "ECDSA", namedCurve: CURVE[alg] };
  const text = key.trim();
  if (text.startsWith("{")) return crypto.subtle.importKey("jwk", JSON.parse(text) as JsonWebKey, algo, false, [usage]);
  const pem = pemToBytes(text);
  if (!pem) throw new Error("bad-key");
  if (usage === "sign" && pem.label !== "PRIVATE KEY") throw new Error("need-pkcs8");
  if (usage === "verify" && pem.label !== "PUBLIC KEY") throw new Error("need-spki");
  return crypto.subtle.importKey(usage === "sign" ? "pkcs8" : "spki", pem.bytes as BufferSource, algo, false, [usage]);
}

const signParams = (alg: JwtAlg) => (alg.startsWith("HS") ? { name: "HMAC" } : alg.startsWith("RS") ? { name: "RSASSA-PKCS1-v1_5" } : { name: "ECDSA", hash: HASH(alg) });

export async function signJwt(headerJson: string, payloadJson: string, alg: JwtAlg, key: string): Promise<string> {
  const header = JSON.parse(headerJson) as Record<string, unknown>;
  header.alg = alg;
  const signingInput = `${base64Url(utf8(JSON.stringify(header)))}.${base64Url(utf8(JSON.stringify(JSON.parse(payloadJson))))}`;
  const sig = new Uint8Array(await crypto.subtle.sign(signParams(alg), await importKey(alg, key, "sign"), utf8(signingInput) as BufferSource));
  return `${signingInput}.${base64Url(sig)}`;
}

export type VerifyResult = { valid: boolean; alg: string; header: unknown; payload: unknown; claims: { name: string; message: string; level: "error" | "warn" | "ok" }[] };

export async function verifyJwt(token: string, key: string, expectedAlg: JwtAlg, now = Date.now()): Promise<VerifyResult> {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new Error("bad-token");
  const parse = (s: string) => { const b = base64ToBytes(s); if (!b) throw new Error("bad-token"); return JSON.parse(fromUtf8(b)) as Record<string, unknown>; };
  const header = parse(parts[0]);
  const payload = parse(parts[1]);
  const claims: VerifyResult["claims"] = [];
  const alg = String(header.alg);
  // 攻撃を防ぐため、トークン内のalgではなく、利用者が選んだアルゴリズムだけで検証する
  let valid = false;
  if (alg === expectedAlg) {
    const sig = base64ToBytes(parts[2]);
    if (sig) {
      const k = await importKey(expectedAlg, key, "verify");
      valid = await crypto.subtle.verify(signParams(expectedAlg), k, sig as BufferSource, utf8(`${parts[0]}.${parts[1]}`) as BufferSource);
    }
  } else claims.push({ name: "alg", level: "error", message: `alg-mismatch:${alg}` });
  const sec = now / 1000;
  if (typeof payload.exp === "number") claims.push({ name: "exp", level: payload.exp < sec ? "error" : "ok", message: payload.exp < sec ? "expired" : "not-expired" });
  if (typeof payload.nbf === "number") claims.push({ name: "nbf", level: payload.nbf > sec ? "error" : "ok", message: payload.nbf > sec ? "not-yet-valid" : "valid-from" });
  return { valid, alg, header, payload, claims };
}
