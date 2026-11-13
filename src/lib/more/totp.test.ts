import { describe, expect, it } from "vitest";

import { base32Decode, hotp, parseOtpauth, totpWindows } from "./totp";
import { utf8 } from "./util";

const secret = utf8("12345678901234567890");

describe("TOTP / HOTP", () => {
  it("RFC 4226 のHOTPテストベクトルと一致する", async () => {
    const expected = ["755224", "287082", "359152", "969429", "338314"];
    for (const [i, code] of expected.entries()) expect(await hotp(secret, i)).toBe(code);
  });

  it("RFC 6238 のTOTPテストベクトルと一致する", async () => {
    const p = { ...parseOtpauth("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ")!, digits: 8 };
    expect((await totpWindows(p, 59_000, 0)).windows[0].code).toBe("94287082");
    expect((await totpWindows(p, 1111111109_000, 0)).windows[0].code).toBe("07081804");
    const s = (await totpWindows(p, 59_000, 1));
    expect(s.remaining).toBe(1);
    expect(s.windows.map((w) => w.offset)).toEqual([-1, 0, 1]);
  });

  it("otpauth URIとBase32を解析する", () => {
    const p = parseOtpauth("otpauth://totp/Example:alice@x.com?secret=JBSWY3DPEHPK3PXP&issuer=Example&digits=8&period=60&algorithm=SHA256")!;
    expect(p).toMatchObject({ algo: "SHA-256", digits: 8, period: 60, issuer: "Example", type: "totp" });
    expect(Array.from(base32Decode("jbsw y3dp")!)).toEqual([72, 101, 108, 108, 111]);
    expect(parseOtpauth("otpauth://totp/x?secret=1!")).toBeNull();
    expect(parseOtpauth("not base32 !")).toBeNull();
  });
});
