/**
 * 動画→GIF変換・動画圧縮ツールで使う純粋関数群（サイズ計算・ビットレート計算・GIFの減色とディザリング）。
 * 動画のデコード・エンコードは Web Worker（video-convert.worker.ts）で WebCodecs を使って行う。
 */

export type DitherMode = "none" | "floyd-steinberg" | "bayer";
export type PaletteMode = "global" | "perFrame";

/** 縦横比を保ったまま幅を合わせた大きさ（動画のエンコードのため偶数に丸める） */
export function fitDimensions(sourceWidth: number, sourceHeight: number, targetWidth: number): { width: number; height: number } {
  const width = Math.max(2, Math.min(sourceWidth, Math.round(targetWidth)));
  const height = Math.max(2, Math.round((sourceHeight * width) / sourceWidth));
  return { width: width - (width % 2), height: height - (height % 2) };
}

/** 縦横比を保ったまま、高さを上限以下にした大きさ（偶数に丸める）。元より大きくはしない */
export function limitHeight(sourceWidth: number, sourceHeight: number, maxHeight: number | null): { width: number; height: number } {
  if (!maxHeight || sourceHeight <= maxHeight) {
    return { width: sourceWidth - (sourceWidth % 2), height: sourceHeight - (sourceHeight % 2) };
  }
  return fitDimensions(sourceWidth, sourceHeight, (sourceWidth * maxHeight) / sourceHeight);
}

/** 開始〜終了の間で、指定のフレームレートで取り出す時刻（秒）の一覧 */
export function frameTimestamps(start: number, end: number, fps: number): number[] {
  const step = 1 / fps;
  const count = Math.max(1, Math.floor((end - start) * fps + 1e-9));
  return Array.from({ length: count }, (_, i) => start + i * step);
}

/** GIF の1フレームの表示時間（GIFは10ミリ秒単位） */
export function gifFrameDelay(fps: number): number {
  return Math.max(20, Math.round(100 / fps) * 10);
}

/** GIF のおおよその出力サイズ（バイト）。内容によって大きく変わるため目安として表示する */
export function estimateGifBytes(width: number, height: number, frames: number): number {
  return Math.round(width * height * frames * 0.35);
}

/**
 * 目標ファイルサイズから映像のビットレート（bps）を求める。
 * コンテナのオーバーヘッドを見込んで5%少なくし、音声の分を差し引く。
 */
export function targetVideoBitrate(targetBytes: number, durationSeconds: number, audioBitrate: number): number {
  if (durationSeconds <= 0) return 0;
  const total = (targetBytes * 8 * 0.95) / durationSeconds;
  return Math.max(100_000, Math.floor(total - audioBitrate));
}

/** 進捗から推定した残り時間（秒）。進捗が少ないうちは null */
export function estimateRemaining(elapsedSeconds: number, progress: number): number | null {
  if (progress < 0.02 || progress >= 1) return null;
  return (elapsedSeconds * (1 - progress)) / progress;
}

/** 秒を「m:ss」形式にする */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export type SizeWarning = "large" | "long" | null;

/** 処理に時間・メモリを要する入力かどうか（スマホは上限を厳しくする） */
export function sizeWarning(bytes: number, durationSeconds: number, mobile: boolean): SizeWarning {
  const maxBytes = (mobile ? 100 : 500) * 1024 * 1024;
  const maxSeconds = mobile ? 3 * 60 : 10 * 60;
  if (bytes > maxBytes) return "large";
  if (durationSeconds > maxSeconds) return "long";
  return null;
}

// ---------------------------------------------------------------------------
// GIF の減色・ディザリング
// ---------------------------------------------------------------------------

export type Palette = number[][];

/** パレットの中で最も近い色の番号（色の差の二乗和で比較） */
export function nearestIndex(palette: Palette, r: number, g: number, b: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i];
    const distance = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
      if (distance === 0) break;
    }
  }
  return best;
}

const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * RGBA の画素をパレットの番号に置き換える。
 * floyd-steinberg は誤差拡散、bayer は 4x4 の規則的なディザリングで、少ない色数でも階調を表現する。
 */
export function ditherToPalette(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, palette: Palette, mode: DitherMode): Uint8Array {
  const indexes = new Uint8Array(width * height);
  const cache = new Map<number, number>();
  const lookup = (r: number, g: number, b: number) => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let index = cache.get(key);
    if (index === undefined) {
      index = nearestIndex(palette, r, g, b);
      cache.set(key, index);
    }
    return index;
  };
  const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

  if (mode === "floyd-steinberg") {
    const buffer = new Float32Array(width * height * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
      buffer[j] = rgba[i];
      buffer[j + 1] = rgba[i + 1];
      buffer[j + 2] = rgba[i + 2];
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const r = clamp(buffer[p * 3]);
        const g = clamp(buffer[p * 3 + 1]);
        const b = clamp(buffer[p * 3 + 2]);
        const index = lookup(r | 0, g | 0, b | 0);
        indexes[p] = index;
        const [pr, pg, pb] = palette[index];
        const errors = [r - pr, g - pg, b - pb];
        const spread = (dx: number, dy: number, weight: number) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny >= height) return;
          const q = (ny * width + nx) * 3;
          buffer[q] += errors[0] * weight;
          buffer[q + 1] += errors[1] * weight;
          buffer[q + 2] += errors[2] * weight;
        };
        spread(1, 0, 7 / 16);
        spread(-1, 1, 3 / 16);
        spread(0, 1, 5 / 16);
        spread(1, 1, 1 / 16);
      }
    }
    return indexes;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const offset = mode === "bayer" ? (BAYER_4[y % 4][x % 4] / 16 - 0.5) * 32 : 0;
      indexes[p] = lookup(clamp(rgba[p * 4] + offset) | 0, clamp(rgba[p * 4 + 1] + offset) | 0, clamp(rgba[p * 4 + 2] + offset) | 0);
    }
  }
  return indexes;
}

/** 元のサイズからの増減を「-75%」「+12%」の形式で表す */
export function reductionLabel(before: number, after: number): string {
  if (before <= 0) return "0%";
  const rate = Math.round(((after - before) / before) * 1000) / 10;
  return `${rate > 0 ? "+" : ""}${rate}%`;
}
