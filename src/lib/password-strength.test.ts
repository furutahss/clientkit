import { describe, expect, it } from "vitest";

import { checkPasswordStrength } from "./password-strength";

describe("パスワード強度の簡易判定", () => {
  it("空入力を未判定にする", () => {
    expect(checkPasswordStrength("")).toEqual({ score: 0, length: 0, issues: [] });
  });

  it.each(["Password123!", "P@ssw0rd123!", "qwertyuiop123456!", "1234567890123456", "aaaaaaaaaaaaaaaa", "Ab1!Ab1!Ab1!Ab1!", "                "])(
    "予測しやすい入力 %s を強いと判定しない",
    (password) => {
      const result = checkPasswordStrength(password);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.issues.length).toBeGreaterThan(0);
    },
  );

  it("短い入力は文字種が多くても弱いと判定する", () => {
    expect(checkPasswordStrength("aB3!x").score).toBe(1);
    expect(checkPasswordStrength("aB3!x").issues).toContain("short");
  });

  it("長く多様な入力を高く評価する", () => {
    expect(checkPasswordStrength("m7#Vq2!Lz9@Rt4$X").score).toBe(4);
    expect(checkPasswordStrength("velvet orchard lantern canoe").score).toBe(4);
  });

  it("Unicodeコードポイントで数え、空白を勝手に削除しない", () => {
    expect(checkPasswordStrength("🔑あa ").length).toBe(4);
    expect(checkPasswordStrength("  a  ").length).toBe(5);
  });
});
