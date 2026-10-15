import { describe, expect, it } from "vitest";

import {
  computePasswordHash,
  decodeSalt,
  parsePasswordHash,
  PasswordHashError,
  verifyPasswordHash,
} from "./password-hash";

const text = (value: string) => new TextEncoder().encode(value);

describe("パスワードハッシュ生成", () => {
  it("Argon2iがリファレンス実装と同じPHC文字列を返す", async () => {
    const result = await computePasswordHash("password", text("somesalt"), {
      algorithm: "argon2",
      params: { variant: "argon2i", memorySize: 65536, iterations: 2, parallelism: 4, hashLength: 24 },
    });
    expect(result.encoded).toBe(
      "$argon2i$v=19$m=65536,t=2,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG"
    );
    expect(result.hex).toBe("45d7ac72e76f242b20b77b9bf9bf9d5915894e669a24e6c6");
  });

  it("Argon2idで生成したハッシュを検証できる", async () => {
    const result = await computePasswordHash("パスワード", text("saltsalt"), {
      algorithm: "argon2",
      params: { variant: "argon2id", memorySize: 64, iterations: 1, parallelism: 1, hashLength: 32 },
    });
    expect(result.encoded).toMatch(/^\$argon2id\$v=19\$m=64,t=1,p=1\$/);
    await expect(verifyPasswordHash("パスワード", result.encoded!)).resolves.toBe(true);
    await expect(verifyPasswordHash("password", result.encoded!)).resolves.toBe(false);
  });

  it("scryptがRFC 7914のテストベクターと一致する", async () => {
    const result = await computePasswordHash("password", text("NaCl"), {
      algorithm: "scrypt",
      params: { logN: 10, blockSize: 8, parallelism: 16, hashLength: 64 },
    });
    expect(result.hex).toBe(
      "fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640"
    );
  });

  it("PBKDF2-SHA256がRFC 7914のテストベクターと一致する", async () => {
    const result = await computePasswordHash("passwd", text("salt"), {
      algorithm: "pbkdf2",
      params: { hash: "SHA-256", iterations: 1, hashLength: 64 },
    });
    expect(result.hex).toBe(
      "55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783"
    );
  });

  it("bcryptで生成したハッシュを検証でき、$2y$形式も受け付ける", async () => {
    const result = await computePasswordHash("secret", new Uint8Array(16).fill(7), {
      algorithm: "bcrypt",
      params: { cost: 4 },
    });
    expect(result.encoded).toMatch(/^\$2[ab]\$04\$/);
    await expect(verifyPasswordHash("secret", result.encoded!)).resolves.toBe(true);
    await expect(
      verifyPasswordHash("secret", result.encoded!.replace(/^\$2[ab]\$/, "$2y$"))
    ).resolves.toBe(true);
    await expect(verifyPasswordHash("wrong", result.encoded!)).resolves.toBe(false);
  });

  it("bcryptの既知のハッシュを検証できる", async () => {
    await expect(
      verifyPasswordHash("U*U", "$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW")
    ).resolves.toBe(true);
  });

  it("制約を満たさない入力はエラーコード付きで失敗する", async () => {
    await expect(
      computePasswordHash("a".repeat(73), new Uint8Array(16), { algorithm: "bcrypt", params: { cost: 4 } })
    ).rejects.toMatchObject({ code: "bcryptPasswordTooLong" });
    await expect(
      computePasswordHash("a", new Uint8Array(8), { algorithm: "bcrypt", params: { cost: 4 } })
    ).rejects.toMatchObject({ code: "bcryptSaltLength" });
    await expect(
      computePasswordHash("a", new Uint8Array(4), {
        algorithm: "argon2",
        params: { variant: "argon2id", memorySize: 64, iterations: 1, parallelism: 1, hashLength: 32 },
      })
    ).rejects.toMatchObject({ code: "argon2SaltTooShort" });
    await expect(verifyPasswordHash("a", "not a hash")).rejects.toBeInstanceOf(PasswordHashError);
    expect(() => decodeSalt("abc", "hex")).toThrow(PasswordHashError);
  });
});

describe("ハッシュ文字列の解析", () => {
  it("Argon2とbcryptのパラメータを読み取る", () => {
    expect(
      parsePasswordHash("$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG")
    ).toEqual({ algorithm: "argon2", variant: "argon2id", memorySize: 19456, iterations: 2, parallelism: 1 });
    expect(
      parsePasswordHash("$2b$12$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW")
    ).toEqual({ algorithm: "bcrypt", cost: 12 });
    expect(parsePasswordHash("5f4dcc3b5aa765d61d8327deb882cf99")).toBeNull();
  });
});
