/**
 * 画像の背景除去で使う純粋関数群（推論の前処理・マスクの拡大・しきい値・侵食／拡張・ぼかし・余白の切り抜き）。
 * 推論は Web Worker（background-removal.worker.ts）で onnxruntime-web と U²-Net（u2netp）を使って行う。
 */

/** u2netp の入力サイズ */
export const MODEL_SIZE = 320;
/** 処理する画像の長辺の上限（メモリ不足を防ぐ） */
export const MAX_IMAGE_EDGE = 4096;

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/**
 * RGBA の画素（MODEL_SIZE×MODEL_SIZE）を、モデルの入力（1×3×H×W、ImageNet の平均・標準偏差で正規化）に変換する。
 * rembg と同じく、画像内の最大値で割ってから正規化する。
 */
export function toModelInput(rgba: Uint8ClampedArray | Uint8Array, size = MODEL_SIZE): Float32Array {
  const pixels = size * size;
  let max = 0;
  for (let i = 0; i < pixels * 4; i += 4) max = Math.max(max, rgba[i], rgba[i + 1], rgba[i + 2]);
  const scale = max > 0 ? 1 / max : 0;
  const out = new Float32Array(3 * pixels);
  for (let p = 0; p < pixels; p++) {
    for (let c = 0; c < 3; c++) out[c * pixels + p] = (rgba[p * 4 + c] * scale - MEAN[c]) / STD[c];
  }
  return out;
}

/** モデルの出力を 0〜1 に正規化する（最小値〜最大値で引き伸ばす） */
export function normalizeMask(values: Float32Array): Float32Array {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  return values.map((v) => (range > 0 ? (v - min) / range : 0));
}

/** マスクを双線形補間で拡大・縮小する */
export function resizeMask(mask: Float32Array, srcWidth: number, srcHeight: number, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  const sx = srcWidth / width;
  const sy = srcHeight / height;
  for (let y = 0; y < height; y++) {
    const fy = Math.min(srcHeight - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(srcHeight - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.min(srcWidth - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(srcWidth - 1, x0 + 1);
      const tx = fx - x0;
      const top = mask[y0 * srcWidth + x0] * (1 - tx) + mask[y0 * srcWidth + x1] * tx;
      const bottom = mask[y1 * srcWidth + x0] * (1 - tx) + mask[y1 * srcWidth + x1] * tx;
      out[y * width + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

/**
 * しきい値と境界のやわらかさを適用して不透明度（0〜255）にする。
 * softness が 0 なら完全に二値化し、大きいほど境界がなめらかになる。
 */
export function applyThreshold(mask: Float32Array, threshold: number, softness: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mask.length);
  const s = Math.max(0.001, softness);
  const low = threshold - s;
  for (let i = 0; i < mask.length; i++) out[i] = ((mask[i] - low) / (2 * s)) * 255;
  return out;
}

/** 1方向の最大値・最小値フィルタ（侵食・拡張の分離処理） */
function morphPass(src: Uint8ClampedArray, width: number, height: number, radius: number, dilate: boolean, horizontal: boolean): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  const lines = horizontal ? height : width;
  const length = horizontal ? width : height;
  for (let line = 0; line < lines; line++) {
    for (let i = 0; i < length; i++) {
      let value = dilate ? 0 : 255;
      for (let k = Math.max(0, i - radius); k <= Math.min(length - 1, i + radius); k++) {
        const v = src[horizontal ? line * width + k : k * width + line];
        value = dilate ? Math.max(value, v) : Math.min(value, v);
      }
      out[horizontal ? line * width + i : i * width + line] = value;
    }
  }
  return out;
}

/** 被写体の縁を広げる（radius > 0）または削る（radius < 0） */
export function morph(alpha: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  if (radius === 0) return alpha;
  const r = Math.abs(Math.round(radius));
  const dilate = radius > 0;
  return morphPass(morphPass(alpha, width, height, r, dilate, true), width, height, r, dilate, false);
}

/** 不透明度をぼかして境界をなめらかにする（分離型のボックスぼかし） */
export function featherAlpha(alpha: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  const r = Math.round(radius);
  if (r <= 0) return alpha;
  const blur = (src: Uint8ClampedArray, horizontal: boolean) => {
    const out = new Uint8ClampedArray(src.length);
    const lines = horizontal ? height : width;
    const length = horizontal ? width : height;
    const at = (line: number, i: number) => src[horizontal ? line * width + i : i * width + line];
    for (let line = 0; line < lines; line++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += at(line, Math.min(length - 1, Math.max(0, k)));
      for (let i = 0; i < length; i++) {
        out[horizontal ? line * width + i : i * width + line] = sum / (2 * r + 1);
        sum += at(line, Math.min(length - 1, i + r + 1)) - at(line, Math.max(0, i - r));
      }
    }
    return out;
  };
  return blur(blur(alpha, true), false);
}

export type Box = { x: number; y: number; width: number; height: number };

/** 不透明な部分（alpha > minAlpha）を囲む矩形に余白を加えたもの。被写体がなければ null */
export function alphaBoundingBox(alpha: Uint8ClampedArray, width: number, height: number, padding = 0, minAlpha = 16): Box | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] > minAlpha) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  return { x, y, width: Math.min(width, maxX + 1 + padding) - x, height: Math.min(height, maxY + 1 + padding) - y };
}

/** 長辺が上限を超えないように縮小した大きさ */
export function limitSize(width: number, height: number, maxEdge = MAX_IMAGE_EDGE): { width: number; height: number } {
  const k = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

export type MaskAdjustments = {
  threshold: number;
  softness: number;
  /** 正で拡張、負で侵食（px、元画像の解像度） */
  grow: number;
  feather: number;
};

/** 推論結果のマスクから、元画像の大きさの不透明度を作る */
export function buildAlpha(mask: Float32Array, maskSize: number, width: number, height: number, adjust: MaskAdjustments): Uint8ClampedArray {
  const resized = resizeMask(mask, maskSize, maskSize, width, height);
  const alpha = applyThreshold(resized, adjust.threshold, adjust.softness);
  return featherAlpha(morph(alpha, width, height, adjust.grow), width, height, adjust.feather);
}
