import { describe, expect, it } from "vitest";

import { decryptText, encryptText } from "./text-crypto";

describe("テキスト暗号化", () => {
  it("暗号化して復号でき、毎回異なる出力になる", async () => {
    const a = await encryptText("こんにちは🔑", "pass", 2000);
    const b = await encryptText("こんにちは🔑", "pass", 2000);
    expect(a).toMatch(/^CK1\./);
    expect(a).not.toBe(b);
    expect(await decryptText(a, "pass")).toBe("こんにちは🔑");
  });

  it("誤ったパスフレーズ・改ざん・不正形式を拒否する", async () => {
    const a = await encryptText("secret", "pass", 2000);
    await expect(decryptText(a, "nope")).rejects.toThrow("wrong-passphrase");
    const tampered = a.slice(0, -2) + (a.endsWith("AA") ? "BB" : "AA");
    await expect(decryptText(tampered, "pass")).rejects.toThrow("wrong-passphrase");
    await expect(decryptText("hello", "pass")).rejects.toThrow("bad-format");
  });
});
