import { describe, expect, it } from "vitest";

import { formatHexDump, readHexPage } from "./hex-viewer";

describe("Hexビューア", () => {
  it("制御文字と非ASCIIをドットに置き換え、短い行も列を揃える", () => {
    expect(formatHexDump(new Uint8Array([0, 31, 32, 65, 126, 127, 255])))
      .toBe("00000000  00 1F 20 41 7E 7F FF                             |.. A~..|");
  });

  it("16バイトで改行し、ファイル全体でのオフセットを表示する", () => {
    expect(formatHexDump(new Uint8Array(17).fill(65), 1024)).toBe(
      "00000400  41 41 41 41 41 41 41 41 41 41 41 41 41 41 41 41  |AAAAAAAAAAAAAAAA|\n" +
      "00000410  41                                               |A|",
    );
    expect(formatHexDump(new Uint8Array([65]), 0x100000000)).toContain("100000000  41");
  });

  it("空ファイルは空の表示を返す", async () => {
    expect(formatHexDump(await readHexPage(new Blob([]), 0))).toBe("");
  });

  it("指定ページだけを読み込み、末尾では残りのバイトだけを返す", async () => {
    const file = new Blob([new Uint8Array(1024).fill(65), new Uint8Array([0, 255])]);
    expect((await readHexPage(file, 0)).length).toBe(1024);
    expect(await readHexPage(file, 1)).toEqual(new Uint8Array([0, 255]));
  });
});
