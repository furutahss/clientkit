/**
 * パスワードハッシュ（鍵導出関数）の生成と検証。
 * Argon2・bcrypt・scryptはWebAssembly実装（hash-wasm）、PBKDF2はWeb Crypto APIで計算する。
 * すべてブラウザ内で完結し、パスワードがサーバーに送信されることはない。
 */

export type PasswordHashAlgorithm = "argon2" | "bcrypt" | "scrypt" | "pbkdf2";
export type Argon2Variant = "argon2id" | "argon2i" | "argon2d";
export type Pbkdf2Hash = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
export type SaltEncoding = "hex" | "text";

export const PASSWORD_HASH_ALGORITHMS: PasswordHashAlgorithm[] = [
  "argon2",
  "bcrypt",
  "scrypt",
  "pbkdf2",
];
export const ARGON2_VARIANTS: Argon2Variant[] = ["argon2id", "argon2i", "argon2d"];
export const PBKDF2_HASHES: Pbkdf2Hash[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

export type Argon2Params = {
  variant: Argon2Variant;
  /** メモリサイズ（KiB） */
  memorySize: number;
  iterations: number;
  parallelism: number;
  hashLength: number;
};

export type BcryptParams = { cost: number };

export type ScryptParams = {
  /** CPU/メモリコスト N の log2 */
  logN: number;
  blockSize: number;
  parallelism: number;
  hashLength: number;
};

export type Pbkdf2Params = {
  hash: Pbkdf2Hash;
  iterations: number;
  hashLength: number;
};

/** OWASP Password Storage Cheat Sheet の推奨値を初期値にする */
export const DEFAULT_ARGON2_PARAMS: Argon2Params = {
  variant: "argon2id",
  memorySize: 19456,
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
};
export const DEFAULT_BCRYPT_PARAMS: BcryptParams = { cost: 10 };
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = {
  logN: 17,
  blockSize: 8,
  parallelism: 1,
  hashLength: 32,
};
export const DEFAULT_PBKDF2_PARAMS: Pbkdf2Params = {
  hash: "SHA-256",
  iterations: 600000,
  hashLength: 32,
};

/** 入力できるパラメータの範囲（ブラウザが固まったりメモリ不足になったりしない程度に制限する） */
export const PARAM_LIMITS = {
  argon2MemorySize: { min: 8, max: 1048576 },
  argon2Iterations: { min: 1, max: 100 },
  argon2Parallelism: { min: 1, max: 16 },
  bcryptCost: { min: 4, max: 20 },
  scryptLogN: { min: 1, max: 20 },
  scryptBlockSize: { min: 1, max: 32 },
  scryptParallelism: { min: 1, max: 16 },
  pbkdf2Iterations: { min: 1, max: 10000000 },
  hashLength: { min: 4, max: 256 },
} as const;

export const BCRYPT_SALT_BYTES = 16;
export const BCRYPT_MAX_PASSWORD_BYTES = 72;
export const ARGON2_MIN_SALT_BYTES = 8;

export type PasswordHashErrorCode =
  | "invalidSaltHex"
  | "emptySalt"
  | "argon2SaltTooShort"
  | "bcryptSaltLength"
  | "bcryptPasswordTooLong"
  | "scryptMemoryTooLarge"
  | "unsupportedFormat";

export class PasswordHashError extends Error {
  constructor(public readonly code: PasswordHashErrorCode) {
    super(code);
    this.name = "PasswordHashError";
  }
}

export type PasswordHashResult = {
  /** PHC文字列形式など、そのままDBに保存できる形式（Argon2・bcryptのみ） */
  encoded: string | null;
  hex: string | null;
  base64: string | null;
  /** 実際に使ったソルト（16進数） */
  saltHex: string;
  elapsedMs: number;
};

export type PasswordHashInput =
  | { algorithm: "argon2"; params: Argon2Params }
  | { algorithm: "bcrypt"; params: BcryptParams }
  | { algorithm: "scrypt"; params: ScryptParams }
  | { algorithm: "pbkdf2"; params: Pbkdf2Params };

export function clampParam(value: number, limit: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return limit.min;
  return Math.min(limit.max, Math.max(limit.min, Math.floor(value)));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.replace(/\s+/g, "");
  if (normalized.length % 2 !== 0 || /[^0-9a-f]/i.test(normalized)) {
    throw new PasswordHashError("invalidSaltHex");
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function randomSaltHex(length = 16): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(length)));
}

export function decodeSalt(salt: string, encoding: SaltEncoding): Uint8Array {
  const bytes = encoding === "hex" ? hexToBytes(salt) : new TextEncoder().encode(salt);
  if (bytes.length === 0) throw new PasswordHashError("emptySalt");
  return bytes;
}

/** scryptが必要とするメモリ量（バイト）。128 * N * r を目安とする */
export function scryptMemoryBytes(params: ScryptParams): number {
  return 128 * 2 ** params.logN * params.blockSize;
}

const SCRYPT_MAX_MEMORY_BYTES = 1024 * 1024 * 1024;

const loadHashWasm = () => import("hash-wasm");

export async function computePasswordHash(
  password: string,
  salt: Uint8Array,
  input: PasswordHashInput
): Promise<PasswordHashResult> {
  const passwordBytes = new TextEncoder().encode(password);
  const saltHex = bytesToHex(salt);
  const start = performance.now();
  const done = (partial: Omit<PasswordHashResult, "saltHex" | "elapsedMs">) => ({
    ...partial,
    saltHex,
    elapsedMs: performance.now() - start,
  });

  switch (input.algorithm) {
    case "argon2": {
      if (salt.length < ARGON2_MIN_SALT_BYTES) {
        throw new PasswordHashError("argon2SaltTooShort");
      }
      const wasm = await loadHashWasm();
      const { variant, ...params } = input.params;
      const fn = { argon2id: wasm.argon2id, argon2i: wasm.argon2i, argon2d: wasm.argon2d }[variant];
      const encoded = await fn({
        password: passwordBytes,
        salt,
        ...params,
        // 並列度に対してメモリが少なすぎると計算できないため、Argon2の仕様どおり 8 * p KiB を下限にする
        memorySize: Math.max(params.memorySize, 8 * params.parallelism),
        outputType: "encoded",
      });
      // 2回計算しないよう、PHC文字列の末尾（パディングなしBase64）からハッシュ本体を取り出す
      const raw = base64ToBytes(encoded.slice(encoded.lastIndexOf("$") + 1));
      return done({ encoded, hex: bytesToHex(raw), base64: bytesToBase64(raw) });
    }
    case "bcrypt": {
      if (salt.length !== BCRYPT_SALT_BYTES) throw new PasswordHashError("bcryptSaltLength");
      if (passwordBytes.length > BCRYPT_MAX_PASSWORD_BYTES) {
        throw new PasswordHashError("bcryptPasswordTooLong");
      }
      const wasm = await loadHashWasm();
      const encoded = await wasm.bcrypt({
        password: passwordBytes,
        salt,
        costFactor: input.params.cost,
        outputType: "encoded",
      });
      return done({ encoded, hex: null, base64: null });
    }
    case "scrypt": {
      if (scryptMemoryBytes(input.params) > SCRYPT_MAX_MEMORY_BYTES) {
        throw new PasswordHashError("scryptMemoryTooLarge");
      }
      const wasm = await loadHashWasm();
      const raw = await wasm.scrypt({
        password: passwordBytes,
        salt,
        costFactor: 2 ** input.params.logN,
        blockSize: input.params.blockSize,
        parallelism: input.params.parallelism,
        hashLength: input.params.hashLength,
        outputType: "binary",
      });
      return done({ encoded: null, hex: bytesToHex(raw), base64: bytesToBase64(raw) });
    }
    case "pbkdf2": {
      const key = await crypto.subtle.importKey(
        "raw",
        passwordBytes as BufferSource,
        "PBKDF2",
        false,
        ["deriveBits"]
      );
      const bits = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: input.params.hash,
          salt: salt as BufferSource,
          iterations: input.params.iterations,
        },
        key,
        input.params.hashLength * 8
      );
      const raw = new Uint8Array(bits);
      return done({ encoded: null, hex: bytesToHex(raw), base64: bytesToBase64(raw) });
    }
  }
}

export type ParsedPasswordHash =
  | {
      algorithm: "argon2";
      variant: Argon2Variant;
      memorySize: number;
      iterations: number;
      parallelism: number;
    }
  | { algorithm: "bcrypt"; cost: number };

const ARGON2_PATTERN =
  /^\$(argon2id|argon2i|argon2d)\$(?:v=\d+\$)?m=(\d+),t=(\d+),p=(\d+)\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;
const BCRYPT_PATTERN = /^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/;

/** Argon2のPHC文字列、またはbcryptのハッシュ文字列を解析する。対応していない形式ならnullを返す */
export function parsePasswordHash(hash: string): ParsedPasswordHash | null {
  const value = hash.trim();
  const argon2 = ARGON2_PATTERN.exec(value);
  if (argon2) {
    return {
      algorithm: "argon2",
      variant: argon2[1] as Argon2Variant,
      memorySize: Number(argon2[2]),
      iterations: Number(argon2[3]),
      parallelism: Number(argon2[4]),
    };
  }
  const bcrypt = BCRYPT_PATTERN.exec(value);
  if (bcrypt) return { algorithm: "bcrypt", cost: Number(bcrypt[1]) };
  return null;
}

/** パスワードがハッシュ文字列（Argon2のPHC文字列またはbcrypt）と一致するかを検証する */
export async function verifyPasswordHash(password: string, hash: string): Promise<boolean> {
  const value = hash.trim();
  const parsed = parsePasswordHash(value);
  if (!parsed) throw new PasswordHashError("unsupportedFormat");
  const wasm = await loadHashWasm();
  if (parsed.algorithm === "argon2") {
    return wasm.argon2Verify({ password, hash: value });
  }
  if (new TextEncoder().encode(password).length > BCRYPT_MAX_PASSWORD_BYTES) {
    throw new PasswordHashError("bcryptPasswordTooLong");
  }
  // $2y$（PHP）は$2b$と同じ計算結果になるため、hash-wasmが確実に受け付ける形式に揃えて検証する
  return wasm.bcryptVerify({ password, hash: value.replace(/^\$2y\$/, "$2b$") });
}
