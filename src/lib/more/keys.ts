import { bytesToPem, decodeOid, pemToBytes } from "./pem";
import { readTlv } from "./util";

export type KeyKind = "rsa-2048" | "rsa-3072" | "rsa-4096" | "ec-p256" | "ec-p384" | "ec-p521" | "ed25519";

type Algo = RsaHashedImportParams | EcKeyImportParams | { name: "Ed25519" };

const CURVES: Record<string, string> = { "1.2.840.10045.3.1.7": "P-256", "1.3.132.0.34": "P-384", "1.3.132.0.35": "P-521" };

/** SPKI / PKCS#8 のDERからアルゴリズムを判定してWeb Cryptoのインポート用パラメーターにする */
function algoFromDer(der: Uint8Array, pkcs8: boolean): Algo {
  const seq = readTlv(der, 0);
  if (!seq) throw new Error("bad-der");
  let pos = seq.start;
  if (pkcs8) { const v = readTlv(der, pos); if (!v) throw new Error("bad-der"); pos = v.end; }
  const alg = readTlv(der, pos);
  const oidTlv = alg && readTlv(der, alg.start);
  if (!alg || !oidTlv) throw new Error("bad-der");
  const oid = decodeOid(der.subarray(oidTlv.start, oidTlv.end));
  if (oid === "1.2.840.113549.1.1.1") return { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
  if (oid === "1.3.101.112") return { name: "Ed25519" };
  if (oid === "1.2.840.10045.2.1") {
    const curveTlv = readTlv(der, oidTlv.end);
    const curve = curveTlv && CURVES[decodeOid(der.subarray(curveTlv.start, curveTlv.end))];
    if (!curve) throw new Error("unsupported-curve");
    return { name: "ECDSA", namedCurve: curve };
  }
  throw new Error("unsupported-algorithm");
}

/** 秘密鍵JWKから公開鍵として使える部分だけを取り出す */
function publicPart(jwk: JsonWebKey): JsonWebKey {
  const copy = { ...jwk };
  for (const k of ["d", "p", "q", "dp", "dq", "qi", "oth", "key_ops"] as const) delete copy[k];
  return copy;
}

export type KeyOutput = { publicPem: string; privatePem?: string; publicJwk: JsonWebKey; privateJwk?: JsonWebKey };

async function exportAll(pub: CryptoKey, priv?: CryptoKey): Promise<KeyOutput> {
  const out: KeyOutput = {
    publicPem: bytesToPem(new Uint8Array(await crypto.subtle.exportKey("spki", pub)), "PUBLIC KEY"),
    publicJwk: await crypto.subtle.exportKey("jwk", pub),
  };
  if (priv) {
    out.privatePem = bytesToPem(new Uint8Array(await crypto.subtle.exportKey("pkcs8", priv)), "PRIVATE KEY");
    out.privateJwk = await crypto.subtle.exportKey("jwk", priv);
  }
  return out;
}

export async function generateKeyPair(kind: KeyKind): Promise<KeyOutput> {
  let params: RsaHashedKeyGenParams | EcKeyGenParams | { name: "Ed25519" };
  if (kind.startsWith("rsa")) params = { name: "RSASSA-PKCS1-v1_5", modulusLength: Number(kind.slice(4)), publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
  else if (kind === "ed25519") params = { name: "Ed25519" };
  else params = { name: "ECDSA", namedCurve: `P-${kind.slice(4)}` };
  const pair = (await crypto.subtle.generateKey(params as Algorithm, true, ["sign", "verify"])) as CryptoKeyPair;
  return exportAll(pair.publicKey, pair.privateKey);
}

/** PEM（PUBLIC KEY / PRIVATE KEY）またはJWKを読み込み、PEMとJWKの両方で返す */
export async function convertKey(input: string): Promise<KeyOutput & { isPrivate: boolean }> {
  const text = input.trim();
  if (text.startsWith("{")) {
    const jwk = JSON.parse(text) as JsonWebKey;
    const algo: Algo = jwk.kty === "RSA" ? { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } : jwk.kty === "EC" ? { name: "ECDSA", namedCurve: jwk.crv ?? "" } : { name: "Ed25519" };
    const isPrivate = Boolean(jwk.d);
    const key = await crypto.subtle.importKey("jwk", jwk, algo, true, isPrivate ? ["sign"] : ["verify"]);
    if (!isPrivate) return { ...(await exportAll(key)), isPrivate };
    // 秘密鍵JWKから公開鍵部分を取り出す
    const pub = await crypto.subtle.importKey("jwk", publicPart(jwk), algo, true, ["verify"]);
    return { ...(await exportAll(pub, key)), isPrivate };
  }
  const pem = pemToBytes(text);
  if (!pem) throw new Error("not-pem");
  if (pem.label === "PUBLIC KEY") {
    const key = await crypto.subtle.importKey("spki", pem.bytes as BufferSource, algoFromDer(pem.bytes, false), true, ["verify"]);
    return { ...(await exportAll(key)), isPrivate: false };
  }
  if (pem.label === "PRIVATE KEY") {
    const algo = algoFromDer(pem.bytes, true);
    const key = await crypto.subtle.importKey("pkcs8", pem.bytes as BufferSource, algo, true, ["sign"]);
    const jwk = await crypto.subtle.exportKey("jwk", key);
    const pub = await crypto.subtle.importKey("jwk", publicPart(jwk), algo, true, ["verify"]);
    return { ...(await exportAll(pub, key)), isPrivate: true };
  }
  throw new Error(`unsupported-label:${pem.label}`);
}
