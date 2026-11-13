import { describe, expect, it } from "vitest";

import { analyzeEmailAuth, countSpfLookups } from "./email-auth";

const en = (_: string, e: string) => e;

describe("SPF / DKIM / DMARC", () => {
  it("SPFのDNS参照回数を数え、+allを拒否する", () => {
    const spf = "v=spf1 include:a.com include:b.com a mx ip4:1.2.3.4 redirect=x.com";
    expect(countSpfLookups(spf)).toBe(5);
    expect(analyzeEmailAuth("v=spf1 +all", en).some((x) => x.level === "error")).toBe(true);
    expect(analyzeEmailAuth("v=spf1 " + "include:x.com ".repeat(11) + "-all", en).some((x) => x.message.includes("exceed"))).toBe(true);
  });

  it("DMARCの p=none と rua 形式を指摘する", () => {
    const f = analyzeEmailAuth("v=DMARC1; p=none; rua=a@x.com", en);
    expect(f.map((x) => x.level)).toEqual(["warn", "error"]);
  });

  it("DKIM RSA鍵のビット数を判定する", async () => {
    const { publicKey } = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
    const spki = new Uint8Array(await crypto.subtle.exportKey("spki", publicKey));
    const b64 = btoa(String.fromCharCode(...spki));
    expect(analyzeEmailAuth(`v=DKIM1; k=rsa; p=${b64}`, en)[0].message).toBe("RSA 2048-bit.");
    expect(analyzeEmailAuth("v=DKIM1; p=", en)[0].level).toBe("warn");
  });
});
