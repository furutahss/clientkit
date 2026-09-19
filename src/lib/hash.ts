import { md5 } from "@/lib/md5";

export type HashAlgorithm = "MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export const HASH_ALGORITHMS: HashAlgorithm[] = [
  "MD5",
  "SHA-1",
  "SHA-256",
  "SHA-384",
  "SHA-512",
];

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function digestHex(
  algorithm: "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512",
  data: Uint8Array
): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(algorithm, data as BufferSource);
  return toHex(hashBuffer);
}

/** 指定したバイト列に対してMD5/SHA-1/SHA-256/SHA-384/SHA-512を計算する（すべてブラウザ内で完結） */
export async function computeAllHashes(
  bytes: Uint8Array
): Promise<Record<HashAlgorithm, string>> {
  const [sha1, sha256, sha384, sha512] = await Promise.all([
    digestHex("SHA-1", bytes),
    digestHex("SHA-256", bytes),
    digestHex("SHA-384", bytes),
    digestHex("SHA-512", bytes),
  ]);

  return {
    MD5: md5(bytes),
    "SHA-1": sha1,
    "SHA-256": sha256,
    "SHA-384": sha384,
    "SHA-512": sha512,
  };
}

export function normalizeHashForCompare(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}
