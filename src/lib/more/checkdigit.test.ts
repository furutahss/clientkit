import { describe, expect, it } from "vitest";

import { computeCheckDigit, validateCheckDigit } from "./checkdigit";

describe("チェックディジット", () => {
  it("Luhn（クレジットカードのテスト番号・IMEI）", () => {
    expect(validateCheckDigit("luhn", "4539 5787 6362 1486")).toMatchObject({ valid: true, brand: "Visa" });
    expect(validateCheckDigit("luhn", "4539578763621487")).toMatchObject({ valid: false, reason: "digit", expected: "6" });
    expect(validateCheckDigit("imei", "490154203237518").valid).toBe(true);
    expect(validateCheckDigit("luhn", "5555555555554444").brand).toBe("Mastercard");
  });

  it("JAN/EAN・ISBN", () => {
    expect(validateCheckDigit("ean13", "4006381333931").valid).toBe(true);
    expect(validateCheckDigit("ean8", "96385074").valid).toBe(true);
    expect(validateCheckDigit("isbn13", "978-0-306-40615-7").valid).toBe(true);
    expect(validateCheckDigit("isbn10", "0-306-40615-2").valid).toBe(true);
    expect(validateCheckDigit("isbn10", "080442957X").valid).toBe(true);
    expect(validateCheckDigit("ean13", "123")).toEqual({ valid: false, reason: "length" });
    expect(computeCheckDigit("ean13", "400638133393")).toBe("1");
  });

  it("法人番号・マイナンバー", () => {
    expect(validateCheckDigit("houjin", "1180301018771").valid).toBe(true);
    expect(validateCheckDigit("houjin", "2180301018771").valid).toBe(false);
    const body = "12345678901";
    const full = body + computeCheckDigit("mynumber", body);
    expect(validateCheckDigit("mynumber", full).valid).toBe(true);
    expect(validateCheckDigit("mynumber", body + ((Number(full.slice(-1)) + 1) % 10)).valid).toBe(false);
  });
});
