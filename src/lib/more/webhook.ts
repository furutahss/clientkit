import { bytesToHex, bytesToBase64, constantTimeEqual, utf8 } from "./util";

export type Provider = "generic" | "github" | "stripe" | "slack";
export type Algo = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export async function hmac(secret: string, message: string, algo: Algo = "SHA-256"): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", utf8(secret) as BufferSource, { name: "HMAC", hash: algo }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, utf8(message) as BufferSource));
}

export type WebhookInput = { provider: Provider; secret: string; payload: string; signature: string; timestamp?: string; algo?: Algo; encoding?: "hex" | "base64"; now?: number };
export type WebhookResult = { computed: string; expected: string; match: boolean | null; signedPayload: string; notes: string[] };

/** プロバイダごとの署名の作り方に従って、HMACを計算し、受け取った署名と比較する */
export async function checkWebhook(i: WebhookInput): Promise<WebhookResult> {
  const notes: string[] = [];
  let signedPayload = i.payload;
  let algo: Algo = i.algo ?? "SHA-256";
  let encoding = i.encoding ?? "hex";
  let expected = i.signature.trim();
  const t = i.timestamp?.trim();
  if (i.provider === "github") { algo = "SHA-256"; encoding = "hex"; expected = expected.replace(/^sha256=/i, ""); }
  else if (i.provider === "stripe") {
    algo = "SHA-256"; encoding = "hex";
    const parts = expected.split(",").map((p) => p.trim().split("="));
    const ts = parts.find(([k]) => k === "t")?.[1] ?? t ?? "";
    const v1 = parts.filter(([k]) => k === "v1").map(([, v]) => v);
    signedPayload = `${ts}.${i.payload}`;
    expected = v1[0] ?? "";
    const age = Math.abs((i.now ?? Date.now()) / 1000 - Number(ts));
    if (!ts) notes.push("missing-timestamp");
    else if (age > 300) notes.push("stale-timestamp");
    if (v1.length > 1) notes.push("multiple-v1");
    if (v1.length > 1 && v1.length) {
      const computedAll = bytesToHex(await hmac(i.secret, signedPayload, algo));
      return { computed: computedAll, expected: v1.join(", "), match: v1.some((v) => constantTimeEqual(computedAll, v)), signedPayload, notes };
    }
  } else if (i.provider === "slack") {
    algo = "SHA-256"; encoding = "hex";
    signedPayload = `v0:${t ?? ""}:${i.payload}`;
    expected = expected.replace(/^v0=/i, "");
    if (!t) notes.push("missing-timestamp");
    else if (Math.abs((i.now ?? Date.now()) / 1000 - Number(t)) > 300) notes.push("stale-timestamp");
  } else expected = expected.replace(/^(sha\d+=)/i, "");
  const sig = await hmac(i.secret, signedPayload, algo);
  const computed = encoding === "hex" ? bytesToHex(sig) : bytesToBase64(sig);
  const norm = (s: string) => (encoding === "hex" ? s.toLowerCase() : s);
  return { computed, expected, match: expected ? constantTimeEqual(norm(computed), norm(expected)) : null, signedPayload, notes };
}
