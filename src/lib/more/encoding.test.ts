import { describe, expect, it } from "vitest";

import { convertLineEndings, decodeBytes, detectEncoding, encodeText, japaneseScore, lineEndingKind, repairMojibake } from "./encoding";

describe("文字コード", () => {
  it("Shift_JIS・EUC-JP・ISO-2022-JP に符号化して復号すると元に戻る", () => {
    for (const enc of ["shift_jis", "euc-jp", "iso-2022-jp", "utf-8", "utf-16le", "utf-16be"] as const) {
      const { bytes, replaced } = encodeText("日本語のテキストです。ABC 123", enc);
      expect(replaced).toBe(0);
      expect(decodeBytes(bytes, enc)).toBe("日本語のテキストです。ABC 123");
    }
    expect(encodeText("あ", "shift_jis").bytes).toEqual(Uint8Array.of(0x82, 0xa0));
    expect(encodeText("あ", "euc-jp").bytes).toEqual(Uint8Array.of(0xa4, 0xa2));
    expect(Array.from(encodeText("あ", "iso-2022-jp").bytes)).toEqual([0x1b, 0x24, 0x42, 0x24, 0x22, 0x1b, 0x28, 0x42]);
  });

  it("符号化できない文字は ? に置き換えて数を返す", () => {
    expect(encodeText("a😀b", "shift_jis")).toEqual({ bytes: Uint8Array.of(0x61, 0x3f, 0x62), replaced: 1 });
  });

  it("文字コードを判定する", () => {
    const body = "これは日本語の文章です。文字コードを判定します。";
    expect(detectEncoding(encodeText(body, "utf-8").bytes)[0].encoding).toBe("utf-8");
    expect(detectEncoding(encodeText(body, "shift_jis").bytes)[0].encoding).toBe("shift_jis");
    expect(detectEncoding(encodeText(body, "euc-jp").bytes)[0].encoding).toBe("euc-jp");
    expect(detectEncoding(encodeText(body, "iso-2022-jp").bytes)[0].encoding).toBe("iso-2022-jp");
    expect(detectEncoding(Uint8Array.of(0xef, 0xbb, 0xbf, 0x61))[0]).toMatchObject({ encoding: "utf-8", bom: true });
    expect(detectEncoding(new TextEncoder().encode("plain"))[0].encoding).toMatch(/^ascii/);
    expect(japaneseScore(body)).toBeGreaterThan(0.9);
    expect(japaneseScore("譁�蟄怜喧縺代")).toBeLessThan(0.9);
  });

  it("文字化けを修復する（UTF-8をShift_JISとして読んだ場合・Latin-1として読んだ場合）", () => {
    const original = "ユーザー";
    const asSjis = decodeBytes(encodeText(original, "utf-8").bytes, "shift_jis");
    expect(repairMojibake(asSjis).find((r) => r.path.startsWith("UTF-8 → Shift_JIS"))?.text).toBe(original);
    // 復号で失われたバイトは復元できないため、その文字だけ � が残る
    const lossy = decodeBytes(encodeText("文字化けしたテキストを元に戻します", "utf-8").bytes, "shift_jis");
    const partial = repairMojibake(lossy).find((r) => r.path.startsWith("UTF-8 → Shift_JIS"))!.text;
    expect(partial).toContain("化けしたテキストを");
    expect(partial).toContain("\ufffd");
    const asLatin = decodeBytes(encodeText("日本語です", "utf-8").bytes, "windows-1252");
    expect(repairMojibake(asLatin)[0]).toMatchObject({ path: "UTF-8 → Latin-1 (Windows-1252)", text: "日本語です" });
    expect(repairMojibake("普通の日本語")).toEqual([]);
  });

  it("改行コードを変換・判定する", () => {
    expect(convertLineEndings("a\r\nb\nc\rd", "lf")).toBe("a\nb\nc\nd");
    expect(convertLineEndings("a\nb", "crlf")).toBe("a\r\nb");
    expect(lineEndingKind("a\r\nb\nc")).toBe("CRLF×1 + LF×1");
    expect(lineEndingKind("abc")).toBe("none");
  });
});
