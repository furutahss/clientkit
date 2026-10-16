import { describe, expect, it } from "vitest";

import {
  alphaBoundingBox,
  applyThreshold,
  buildAlpha,
  featherAlpha,
  limitSize,
  morph,
  normalizeMask,
  resizeMask,
  toModelInput,
} from "./background-removal";

describe("前処理", () => {
  it("CHW 形式に並べ、最大値で割ってから ImageNet の平均・標準偏差で正規化する", () => {
    // 2×2 画像: 白・黒・赤・中間
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255, 128, 128, 128, 255]);
    const input = toModelInput(rgba, 2);
    expect(input).toHaveLength(12);
    expect(input[0]).toBeCloseTo((1 - 0.485) / 0.229); // R チャンネルの白
    expect(input[1]).toBeCloseTo((0 - 0.485) / 0.229); // R チャンネルの黒
    expect(input[4 + 2]).toBeCloseTo((0 - 0.456) / 0.224); // G チャンネルの赤
    expect(input[8 + 3]).toBeCloseTo((128 / 255 - 0.406) / 0.225); // B チャンネルの中間
  });

  it("出力を 0〜1 に正規化する", () => {
    expect(Array.from(normalizeMask(new Float32Array([2, 4, 6])))).toEqual([0, 0.5, 1]);
    expect(Array.from(normalizeMask(new Float32Array([3, 3])))).toEqual([0, 0]);
  });
});

describe("マスクの加工", () => {
  it("双線形補間で拡大する", () => {
    const resized = resizeMask(new Float32Array([0, 1, 0, 1]), 2, 2, 4, 2);
    expect(Array.from(resized)).toEqual([0, 0.25, 0.75, 1, 0, 0.25, 0.75, 1]);
  });

  it("しきい値とやわらかさ", () => {
    const mask = new Float32Array([0.1, 0.45, 0.5, 0.55, 0.9]);
    expect(Array.from(applyThreshold(mask, 0.5, 0))).toEqual([0, 0, 128, 255, 255]);
    const soft = Array.from(applyThreshold(mask, 0.5, 0.1));
    expect(soft[0]).toBe(0);
    expect(soft[1]).toBe(64);
    expect(soft[3]).toBe(191);
    expect(soft[4]).toBe(255);
  });

  it("侵食・拡張", () => {
    // 5×5 の中央に 1 画素だけ不透明
    const alpha = new Uint8ClampedArray(25);
    alpha[12] = 255;
    const grown = morph(alpha, 5, 5, 1);
    expect(Array.from(grown).filter((v) => v === 255)).toHaveLength(9);
    expect(Array.from(morph(grown, 5, 5, -1)).filter((v) => v === 255)).toHaveLength(1);
    expect(morph(alpha, 5, 5, 0)).toBe(alpha);
  });

  it("ぼかしで境界をなめらかにする（全体の明るさは保つ）", () => {
    const alpha = new Uint8ClampedArray([0, 0, 255, 255, 255, 0, 0]);
    const blurred = Array.from(featherAlpha(alpha, 7, 1, 1));
    expect(blurred).toEqual([0, 85, 170, 255, 170, 85, 0]);
    expect(featherAlpha(alpha, 7, 1, 0)).toBe(alpha);
  });

  it("元画像の大きさの不透明度を作る", () => {
    const mask = new Float32Array([0, 0, 0, 1]);
    const alpha = buildAlpha(mask, 2, 4, 4, { threshold: 0.5, softness: 0, grow: 0, feather: 0 });
    expect(alpha).toHaveLength(16);
    expect(alpha[0]).toBe(0);
    expect(alpha[15]).toBe(255);
  });
});

describe("余白の切り抜き・サイズ", () => {
  it("被写体を囲む矩形に余白を加える", () => {
    const alpha = new Uint8ClampedArray(6 * 4);
    alpha[1 * 6 + 2] = 255;
    alpha[2 * 6 + 3] = 255;
    expect(alphaBoundingBox(alpha, 6, 4)).toEqual({ x: 2, y: 1, width: 2, height: 2 });
    expect(alphaBoundingBox(alpha, 6, 4, 5)).toEqual({ x: 0, y: 0, width: 6, height: 4 });
    expect(alphaBoundingBox(new Uint8ClampedArray(4), 2, 2)).toBeNull();
  });

  it("長辺の上限に収める", () => {
    expect(limitSize(8000, 6000)).toEqual({ width: 4096, height: 3072 });
    expect(limitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
