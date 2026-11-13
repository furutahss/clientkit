import { describe, expect, it } from "vitest";

import { decode83, decodeBlurHash, encode83, encodeBlurHash } from "./blurhash";

const solid = (w: number, h: number, [r, g, b]: number[]) => Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => [r, g, b, 255][i % 4]);

describe("BlurHash", () => {
  it("base83 の往復", () => {
    expect(decode83(encode83(16711680, 4))).toBe(16711680);
    expect(encode83(0, 1)).toBe("0");
    expect(() => decode83("あ")).toThrow("invalid-char");
  });

  it("単色画像は成分1つのハッシュになり、同じ色に復元できる", () => {
    const hash = encodeBlurHash(solid(8, 8, [255, 0, 0]), 8, 8, 1, 1);
    expect(hash).toHaveLength(6);
    expect(hash.slice(0, 2)).toBe("00");
    const px = decodeBlurHash(hash, 4, 4);
    expect(Array.from(px.slice(0, 4))).toEqual([255, 0, 0, 255]);
  });

  it("グラデーション画像は4x3成分で、おおよその色を保つ", () => {
    const w = 32, h = 32;
    const img = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = (y * w + x) * 4; img[p] = (x / (w - 1)) * 255; img[p + 1] = 40; img[p + 2] = (y / (h - 1)) * 255; img[p + 3] = 255; }
    const hash = encodeBlurHash(img, w, h, 4, 3);
    expect(hash).toHaveLength(4 + 2 * 12);
    const out = decodeBlurHash(hash, w, h);
    const at = (x: number, y: number) => Array.from(out.slice((y * w + x) * 4, (y * w + x) * 4 + 3));
    expect(at(1, 1)[0]).toBeLessThan(70);
    expect(at(30, 1)[0]).toBeGreaterThan(170);
    expect(at(1, 30)[2]).toBeGreaterThan(170);
    expect(Math.abs(at(16, 16)[1] - 40)).toBeLessThan(25);
  });

  it("不正な引数を拒否する", () => {
    expect(() => encodeBlurHash(new Uint8ClampedArray(4), 1, 1, 10, 1)).toThrow("components-range");
    expect(() => encodeBlurHash(new Uint8ClampedArray(4), 2, 2, 1, 1)).toThrow("size-mismatch");
    expect(() => decodeBlurHash("abc", 4, 4)).toThrow("too-short");
    expect(() => decodeBlurHash("LEHV6nWB2yk8", 4, 4)).toThrow("bad-length");
  });
});
