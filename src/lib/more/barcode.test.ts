import { describe, expect, it } from "vitest";

import { barcodeSvg, code128Values, eanCheckDigit, encodeBarcode, encodeCode39, encodeEan } from "./barcode";

describe("バーコード", () => {
  it("EAN-13: 95モジュール・ガードパターン・チェックディジット補完", () => {
    const { modules, text } = encodeEan("400638133393", "ean13");
    expect(text).toBe("4006381333931");
    expect(modules).toHaveLength(95);
    expect(modules.startsWith("101")).toBe(true);
    expect(modules.slice(45, 50)).toBe("01010");
    expect(modules.endsWith("101")).toBe(true);
    expect(modules).toBe(encodeEan("4006381333931", "ean13").modules);
    expect(eanCheckDigit("400638133393")).toBe(1);
  });

  it("EAN-8・UPC-A・誤ったチェックディジットの拒否", () => {
    expect(encodeEan("9638507", "ean8").modules).toHaveLength(67);
    expect(encodeEan("03600029145", "upca").text).toBe("036000291452");
    expect(encodeEan("036000291452", "upca").modules).toHaveLength(95);
    expect(() => encodeEan("4006381333932", "ean13")).toThrow("check-digit");
    expect(() => encodeEan("123", "ean13")).toThrow(/length/);
    expect(() => encodeEan("abc", "ean13")).toThrow("digits-only");
  });

  it("Code 128: 開始コード・チェックサム・Code Cへの切替", () => {
    expect(code128Values("Hello")).toEqual([104, 40, 69, 76, 76, 79, 76, 106]);
    expect(code128Values("12345678")).toEqual([105, 12, 34, 56, 78, (105 + 12 + 2 * 34 + 3 * 56 + 4 * 78) % 103, 106]);
    const v = code128Values("AB123456");
    expect(v.slice(0, 4)).toEqual([104, 33, 34, 99]);
    expect(encodeBarcode("code128", "Hello").modules.length).toBe(11 * 7 + 13);
    expect(() => code128Values("日本")).toThrow("ascii-printable");
  });

  it("Code 39・ITF とSVG出力", () => {
    expect(encodeCode39("A-1").modules).toMatch(/^1/);
    expect(() => encodeCode39("a*b")).toThrow("code39-chars");
    expect(() => encodeBarcode("itf", "123")).toThrow("itf-even");
    expect(encodeBarcode("itf", "1234").modules.startsWith("1010")).toBe(true);
    const svg = barcodeSvg("1101", "1<2", { moduleWidth: 2, height: 40, quiet: 1, showText: true });
    expect(svg).toContain('width="12"');
    expect(svg).toContain('<rect x="2" y="0" width="4"');
    expect(svg).toContain('<rect x="8" y="0" width="2"');
    expect(svg).toContain("1&lt;2");
  });
});
