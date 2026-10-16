import { describe, expect, it } from "vitest";

import {
  ditherToPalette,
  estimateGifBytes,
  estimateRemaining,
  fitDimensions,
  formatClock,
  frameTimestamps,
  gifFrameDelay,
  limitHeight,
  nearestIndex,
  reductionLabel,
  sizeWarning,
  targetVideoBitrate,
} from "./video-convert";

describe("サイズ計算", () => {
  it("縦横比を保って幅を合わせ、偶数に丸める", () => {
    expect(fitDimensions(1920, 1080, 480)).toEqual({ width: 480, height: 270 });
    expect(fitDimensions(1920, 1080, 481)).toEqual({ width: 480, height: 270 });
    expect(fitDimensions(1080, 1920, 320)).toEqual({ width: 320, height: 568 });
    // 元より大きくはしない
    expect(fitDimensions(640, 360, 1280)).toEqual({ width: 640, height: 360 });
  });

  it("高さの上限に合わせる", () => {
    expect(limitHeight(1920, 1080, 720)).toEqual({ width: 1280, height: 720 });
    expect(limitHeight(1280, 720, 1080)).toEqual({ width: 1280, height: 720 });
    expect(limitHeight(1921, 1081, null)).toEqual({ width: 1920, height: 1080 });
  });
});

describe("フレーム", () => {
  it("取り出す時刻の一覧", () => {
    expect(frameTimestamps(1, 2, 4)).toEqual([1, 1.25, 1.5, 1.75]);
    expect(frameTimestamps(0, 0.01, 10)).toEqual([0]);
    expect(frameTimestamps(0, 3, 10)).toHaveLength(30);
  });

  it("GIF の表示時間は10ミリ秒単位", () => {
    expect(gifFrameDelay(10)).toBe(100);
    expect(gifFrameDelay(15)).toBe(70);
    expect(gifFrameDelay(30)).toBe(30);
    expect(gifFrameDelay(60)).toBe(20);
  });

  it("出力サイズの目安", () => {
    expect(estimateGifBytes(480, 270, 100)).toBe(4536000);
  });
});

describe("ビットレート・時間", () => {
  it("目標サイズから映像のビットレートを求める", () => {
    // 10MB・60秒・音声128kbps → 映像 約1.2Mbps
    expect(targetVideoBitrate(10 * 1024 * 1024, 60, 128_000)).toBe(1200196);
    expect(targetVideoBitrate(100_000, 600, 128_000)).toBe(100_000);
    expect(targetVideoBitrate(1000, 0, 0)).toBe(0);
  });

  it("残り時間と時刻表記", () => {
    expect(estimateRemaining(10, 0.25)).toBe(30);
    expect(estimateRemaining(1, 0.01)).toBeNull();
    expect(estimateRemaining(5, 1)).toBeNull();
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(75.4)).toBe("1:15");
    expect(formatClock(3600)).toBe("60:00");
    expect(reductionLabel(1000, 250)).toBe("-75%");
    expect(reductionLabel(1000, 1125)).toBe("+12.5%");
    expect(reductionLabel(0, 10)).toBe("0%");
  });

  it("サイズ・長さの警告（スマホは厳しめ）", () => {
    const mb = 1024 * 1024;
    expect(sizeWarning(400 * mb, 60, false)).toBeNull();
    expect(sizeWarning(600 * mb, 60, false)).toBe("large");
    expect(sizeWarning(10 * mb, 11 * 60, false)).toBe("long");
    expect(sizeWarning(150 * mb, 60, true)).toBe("large");
    expect(sizeWarning(10 * mb, 4 * 60, true)).toBe("long");
  });
});

describe("減色・ディザリング", () => {
  const palette = [
    [0, 0, 0],
    [255, 255, 255],
    [255, 0, 0],
  ];

  it("最も近い色を選ぶ", () => {
    expect(nearestIndex(palette, 10, 10, 10)).toBe(0);
    expect(nearestIndex(palette, 240, 250, 245)).toBe(1);
    expect(nearestIndex(palette, 200, 30, 20)).toBe(2);
  });

  it("ディザリングなしは各画素を最も近い色にする", () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 255, 250, 250, 250, 255, 220, 10, 10, 255, 128, 128, 128, 255]);
    expect(Array.from(ditherToPalette(rgba, 4, 1, palette, "none"))).toEqual([0, 1, 2, 1]);
  });

  it("誤差拡散で灰色を白黒の混在で表現する", () => {
    const size = 16;
    const gray = new Uint8ClampedArray(size * size * 4).fill(128);
    const indexes = ditherToPalette(gray, size, size, palette.slice(0, 2), "floyd-steinberg");
    const white = indexes.filter((i) => i === 1).length / indexes.length;
    expect(white).toBeGreaterThan(0.4);
    expect(white).toBeLessThan(0.6);
    // ディザリングなしではすべて同じ色になる
    expect(new Set(ditherToPalette(gray, size, size, palette.slice(0, 2), "none")).size).toBe(1);
  });

  it("Bayer ディザリングも白黒を混在させる", () => {
    const gray = new Uint8ClampedArray(8 * 8 * 4).fill(128);
    expect(new Set(ditherToPalette(gray, 8, 8, palette.slice(0, 2), "bayer")).size).toBe(2);
  });
});
