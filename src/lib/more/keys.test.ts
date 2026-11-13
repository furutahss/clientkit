import { describe, expect, it } from "vitest";

import { convertKey, generateKeyPair } from "./keys";

describe("鍵の生成・PEM/JWK変換", () => {
  it("EC鍵を生成し、PEM→JWK→PEMで往復できる", async () => {
    const k = await generateKeyPair("ec-p256");
    expect(k.publicPem).toMatch(/^-----BEGIN PUBLIC KEY-----/);
    expect(k.privateJwk).toMatchObject({ kty: "EC", crv: "P-256" });
    const fromPem = await convertKey(k.privatePem!);
    expect(fromPem.isPrivate).toBe(true);
    expect(fromPem.publicJwk).toMatchObject({ x: k.publicJwk.x, y: k.publicJwk.y });
    const fromJwk = await convertKey(JSON.stringify(k.privateJwk));
    expect(fromJwk.privatePem).toBe(k.privatePem);
    expect(fromJwk.publicPem).toBe(k.publicPem);
    expect((await convertKey(k.publicPem)).publicJwk.x).toBe(k.publicJwk.x);
  });

  it("RSAとEd25519も扱え、不正な入力は拒否する", async () => {
    const r = await generateKeyPair("rsa-2048");
    expect((await convertKey(r.publicPem)).publicJwk.kty).toBe("RSA");
    const e = await generateKeyPair("ed25519");
    expect((await convertKey(e.privatePem!)).publicJwk.kty).toBe("OKP");
    await expect(convertKey("hello")).rejects.toThrow("not-pem");
    await expect(convertKey("-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----")).rejects.toThrow(/unsupported-label/);
  });
});
