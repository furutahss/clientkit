import { md5 } from "@/lib/md5";

import { base64ToBytes, bytesToBase64 } from "./util";

export type SshKeyInfo = { type: string; bits: number | null; comment: string; sha256: string; md5: string; details: [string, string][] };

function readStrings(blob: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  for (let pos = 0; pos + 4 <= blob.length; ) {
    const len = view.getUint32(pos);
    if (pos + 4 + len > blob.length) throw new Error("truncated");
    out.push(blob.subarray(pos + 4, pos + 4 + len));
    pos += 4 + len;
  }
  return out;
}

const bitLen = (b: Uint8Array) => { let i = 0; while (i < b.length && b[i] === 0) i++; return i >= b.length ? 0 : (b.length - i - 1) * 8 + (32 - Math.clz32(b[i])); };
const text = (b: Uint8Array) => new TextDecoder().decode(b);

/** OpenSSHの公開鍵1行（authorized_keys形式）を解析し、ssh-keygen -l と同じ形式のフィンガープリントを返す */
export async function inspectSshKey(line: string): Promise<SshKeyInfo> {
  const m = /^(?:[^\s]+\s+)??((?:ssh|ecdsa|sk)-[\w@.-]+)\s+([A-Za-z0-9+/=]+)(?:\s+(.*))?$/.exec(line.trim());
  if (!m) throw new Error("not-ssh-key");
  const blob = base64ToBytes(m[2]);
  if (!blob) throw new Error("not-ssh-key");
  const fields = readStrings(blob);
  const type = text(fields[0] ?? new Uint8Array());
  if (type !== m[1]) throw new Error("type-mismatch");
  const details: [string, string][] = [];
  let bits: number | null = null;
  if (type === "ssh-rsa") {
    bits = bitLen(fields[2]);
    const e = fields[1].reduce((a, b) => a * 256 + b, 0);
    details.push(["exponent", String(e)]);
  } else if (type.startsWith("ecdsa-sha2-")) {
    const curve = text(fields[1]);
    bits = { nistp256: 256, nistp384: 384, nistp521: 521 }[curve] ?? null;
    details.push(["curve", curve]);
  } else if (type.includes("ed25519")) {
    bits = 256;
  } else if (type === "ssh-dss") bits = bitLen(fields[1]);
  if (type.startsWith("sk-")) details.push(["security-key", "FIDO/U2F hardware-backed"]);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", blob as BufferSource));
  return {
    type, bits, comment: m[3]?.trim() ?? "",
    sha256: `SHA256:${bytesToBase64(digest).replace(/=+$/, "")}`,
    md5: `MD5:${md5(blob).replace(/(..)(?=.)/g, "$1:")}`,
    details,
  };
}
