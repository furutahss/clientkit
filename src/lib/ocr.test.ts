import { describe, expect, it } from "vitest";

import {
  applyPixelFilters,
  fitScale,
  joinParagraphLines,
  rectFromPoints,
  removeJapaneseSpaces,
  rotatedSize,
  tidyText,
} from "./ocr";

const pixel = (r: number, g: number, b: number) => new Uint8ClampedArray([r, g, b, 255]);

describe("applyPixelFilters", () => {
  it("グレースケールに変換する", () => {
    const data = pixel(255, 0, 0);
    applyPixelFilters(data, { grayscale: true, contrast: 0, threshold: null });
    expect(Array.from(data)).toEqual([76, 76, 76, 255]);
  });

  it("コントラストを上げると中間色から離れる", () => {
    const data = pixel(100, 150, 128);
    applyPixelFilters(data, { grayscale: false, contrast: 50, threshold: null });
    expect(data[0]).toBeLessThan(100);
    expect(data[1]).toBeGreaterThan(150);
    expect(data[2]).toBe(128);
    expect(data[3]).toBe(255);
  });

  it("しきい値で二値化する（グレースケールも適用される）", () => {
    const light = pixel(200, 200, 200);
    const dark = pixel(90, 90, 90);
    applyPixelFilters(light, { grayscale: false, contrast: 0, threshold: 128 });
    applyPixelFilters(dark, { grayscale: false, contrast: 0, threshold: 128 });
    expect(Array.from(light)).toEqual([255, 255, 255, 255]);
    expect(Array.from(dark)).toEqual([0, 0, 0, 255]);
  });
});

describe("サイズ計算", () => {
  it("長辺の上限を超えないように倍率を調整する", () => {
    expect(fitScale(1000, 500, 2, 4000)).toBe(2);
    expect(fitScale(3000, 1000, 2, 4000)).toBeCloseTo(4000 / 3000);
    expect(fitScale(8000, 6000, 1, 4000)).toBe(0.5);
  });

  it("回転後のサイズを返す", () => {
    expect(rotatedSize(300, 200, 0)).toEqual({ width: 300, height: 200 });
    expect(rotatedSize(300, 200, 90)).toEqual({ width: 200, height: 300 });
    expect(rotatedSize(300, 200, 270)).toEqual({ width: 200, height: 300 });
  });

  it("ドラッグ範囲を画像内に収める", () => {
    const bounds = { width: 100, height: 80 };
    expect(rectFromPoints({ x: 90, y: 70 }, { x: 10.5, y: -5 }, bounds)).toEqual({ x: 10.5, y: 0, width: 79.5, height: 70 });
    expect(rectFromPoints({ x: 50, y: 50 }, { x: 150, y: 120 }, bounds)).toEqual({ x: 50, y: 50, width: 50, height: 30 });
    expect(rectFromPoints({ x: 10, y: 10 }, { x: 12, y: 40 }, bounds)).toBeNull();
    // 割合（0〜1）の座標でも丸められないこと
    expect(rectFromPoints({ x: 0, y: 0.5 }, { x: 1, y: 0.99 }, { width: 1, height: 1 }, 0.01)).toEqual({
      x: 0,
      y: 0.5,
      width: 1,
      height: 0.49,
    });
  });
});

describe("日本語の後処理", () => {
  it("日本語の文字間の半角スペースを除去する", () => {
    expect(removeJapaneseSpaces("こ れ は テ ス ト で す 。")).toBe("これはテストです。");
    expect(removeJapaneseSpaces("日本 語 と English words を 含む")).toBe("日本語と English words を含む");
    expect(removeJapaneseSpaces("ＡＢＣ　漢字")).toBe("ＡＢＣ　漢字");
    expect(removeJapaneseSpaces("価格 1,000円")).toBe("価格 1,000円");
  });

  it("段落内の改行を結合する", () => {
    expect(joinParagraphLines("吾輩は猫で\nある。名前は\nまだ無い。\n\nどこで生れたか")).toBe(
      "吾輩は猫である。名前はまだ無い。\n\nどこで生れたか"
    );
    expect(joinParagraphLines("This is a\nsimple sen-\ntence.\r\n\r\n\r\nNext")).toBe("This is a simple sentence.\n\nNext");
    expect(joinParagraphLines("日本語の行\nEnglish line")).toBe("日本語の行English line");
  });

  it("空行と行末の空白を整える", () => {
    expect(tidyText("\n\nline1  \n\n\n\nline2\n")).toBe("line1\n\nline2");
  });
});
