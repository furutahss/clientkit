import { describe, expect, it } from "vitest";

import { parseHex } from "@/lib/color";

import { buildScale, rgbToOklch } from "./color-scale";

describe("カラースケール", () => {
  it("OKLCHへの変換が既知の値に近い", () => {
    const white = rgbToOklch({ r: 255, g: 255, b: 255 });
    expect(white.l).toBeCloseTo(1, 2);
    expect(white.c).toBeCloseTo(0, 2);
    const red = rgbToOklch({ r: 255, g: 0, b: 0 });
    expect(red.l).toBeCloseTo(0.628, 2);
    expect(red.c).toBeCloseTo(0.2577, 2);
    expect(red.h).toBeCloseTo(29.2, 0);
  });

  it("11段のスケールは明度が単調に下がり、元の色を1段に含み、色相を保つ", () => {
    const scale = buildScale("#3b82f6")!;
    expect(scale.map((s) => s.step)).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
    expect(scale.filter((s) => s.anchor)).toHaveLength(1);
    expect(scale.find((s) => s.anchor)!.hex.toLowerCase()).toBe("#3b82f6");
    const ls = scale.map((s) => rgbToOklch(parseHex(s.hex)!).l);
    for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeLessThan(ls[i - 1] + 0.001);
    for (const s of scale.filter((x) => x.step >= 200 && x.step <= 800)) expect(Math.abs(rgbToOklch(parseHex(s.hex)!).h - 262)).toBeLessThan(12);
    expect(scale[0].onWhite).toBeLessThan(1.3);
    expect(scale[10].onWhite).toBeGreaterThan(10);
  });

  it("不正な色は null、無彩色でも壊れない", () => {
    expect(buildScale("nope")).toBeNull();
    expect(buildScale("#808080")!.every((s) => /^#[0-9a-f]{6}$/i.test(s.hex))).toBe(true);
  });
});
