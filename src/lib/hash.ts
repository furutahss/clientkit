import { md5 } from "@/lib/md5";

export type HashAlgorithm =
  | "MD5"
  | "SHA-1"
  | "SHA-224"
  | "SHA-256"
  | "SHA-384"
  | "SHA-512"
  | "SHA3-224"
  | "SHA3-256"
  | "SHA3-384"
  | "SHA3-512"
  | "Keccak-256"
  | "BLAKE2b-512"
  | "BLAKE2s-256"
  | "BLAKE3"
  | "RIPEMD-160"
  | "CRC32"
  | "xxHash64";

export type HashGroupId = "sha2" | "sha3" | "blake" | "other";

/** 画面に表示する順序でまとめたアルゴリズムのグループ */
export const HASH_GROUPS: { id: HashGroupId; algorithms: HashAlgorithm[] }[] = [
  { id: "sha2", algorithms: ["MD5", "SHA-1", "SHA-224", "SHA-256", "SHA-384", "SHA-512"] },
  { id: "sha3", algorithms: ["SHA3-224", "SHA3-256", "SHA3-384", "SHA3-512", "Keccak-256"] },
  { id: "blake", algorithms: ["BLAKE2b-512", "BLAKE2s-256", "BLAKE3"] },
  { id: "other", algorithms: ["RIPEMD-160", "CRC32", "xxHash64"] },
];

export const HASH_ALGORITHMS: HashAlgorithm[] = HASH_GROUPS.flatMap(
  (group) => group.algorithms
);

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

/**
 * 指定したバイト列に対してすべてのアルゴリズムのハッシュ値を計算する（すべてブラウザ内で完結）。
 * SHA-1/SHA-2はWeb Crypto API、Web Crypto APIにないアルゴリズムはWebAssembly実装（hash-wasm）を使う。
 */
export async function computeAllHashes(
  bytes: Uint8Array
): Promise<Record<HashAlgorithm, string>> {
  // WebAssemblyを含むため、ハッシュを計算するときに初めて読み込む
  const wasm = await import("hash-wasm");

  // hash-wasmは内部のWebAssemblyインスタンスを共有するため、Promise.allで並べても順番に処理される
  const [sha1, sha256, sha384, sha512] = await Promise.all([
    digestHex("SHA-1", bytes),
    digestHex("SHA-256", bytes),
    digestHex("SHA-384", bytes),
    digestHex("SHA-512", bytes),
  ]);

  return {
    MD5: md5(bytes),
    "SHA-1": sha1,
    "SHA-224": await wasm.sha224(bytes),
    "SHA-256": sha256,
    "SHA-384": sha384,
    "SHA-512": sha512,
    "SHA3-224": await wasm.sha3(bytes, 224),
    "SHA3-256": await wasm.sha3(bytes, 256),
    "SHA3-384": await wasm.sha3(bytes, 384),
    "SHA3-512": await wasm.sha3(bytes, 512),
    "Keccak-256": await wasm.keccak(bytes, 256),
    "BLAKE2b-512": await wasm.blake2b(bytes, 512),
    "BLAKE2s-256": await wasm.blake2s(bytes, 256),
    BLAKE3: await wasm.blake3(bytes, 256),
    "RIPEMD-160": await wasm.ripemd160(bytes),
    CRC32: await wasm.crc32(bytes),
    xxHash64: await wasm.xxhash64(bytes),
  };
}

export function normalizeHashForCompare(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}
