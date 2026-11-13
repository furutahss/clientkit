import { describe, expect, it } from "vitest";

import { generateKeyPair } from "./keys";
import { signJwt, verifyJwt } from "./jwt-sign";

const KNOWN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("JWT署名・検証", () => {
  it("HS256が jwt.io の既知トークンと一致する", async () => {
    const token = await signJwt('{"alg":"HS256","typ":"JWT"}', '{"sub":"1234567890","name":"John Doe","iat":1516239022}', "HS256", "your-256-bit-secret");
    expect(token).toBe(KNOWN);
    expect((await verifyJwt(KNOWN, "your-256-bit-secret", "HS256")).valid).toBe(true);
    expect((await verifyJwt(KNOWN, "wrong", "HS256")).valid).toBe(false);
  });

  it("選んだアルゴリズムと違うalgは検証しない（alg差し替え対策）", async () => {
    const r = await verifyJwt(KNOWN, "your-256-bit-secret", "HS512");
    expect(r.valid).toBe(false);
    expect(r.claims[0].message).toBe("alg-mismatch:HS256");
  });

  it("RS256とES256の署名を公開鍵で検証でき、期限切れを検出する", async () => {
    for (const [kind, alg] of [["rsa-2048", "RS256"], ["ec-p256", "ES256"]] as const) {
      const k = await generateKeyPair(kind);
      const token = await signJwt("{}", '{"exp":1000}', alg, k.privatePem!);
      const r = await verifyJwt(token, k.publicPem, alg, 2_000_000);
      expect(r.valid).toBe(true);
      expect(r.claims).toEqual([{ name: "exp", level: "error", message: "expired" }]);
      const other = await generateKeyPair(kind);
      expect((await verifyJwt(token, other.publicPem, alg)).valid).toBe(false);
    }
  });
});
