const trim = (n: number, digits = 4) => String(Math.round(n * 10 ** digits) / 10 ** digits);

export const pxToRem = (px: number, base = 16) => px / base;
export const remToPx = (rem: number, base = 16) => rem * base;

/** 最小〜最大ビューポート幅の間で、サイズを線形に変化させる clamp() を作る（rem 単位） */
export function fluidClamp(minSize: number, maxSize: number, minViewport: number, maxViewport: number, base = 16, unit: "rem" | "px" = "rem"): { css: string; slope: number; intercept: number } {
  if (maxViewport === minViewport) throw new Error("same-viewport");
  const slope = (maxSize - minSize) / (maxViewport - minViewport);
  const intercept = minSize - slope * minViewport;
  const div = unit === "rem" ? base : 1;
  const lo = Math.min(minSize, maxSize), hi = Math.max(minSize, maxSize);
  // 傾きが負（大きい画面ほど小さくする）の場合は「a - b vw」の形で書く
  const preferred = slope < 0 ? `${trim(intercept / div)}${unit} - ${trim(-slope * 100)}vw` : `${trim(intercept / div)}${unit} + ${trim(slope * 100)}vw`;
  return { css: `clamp(${trim(lo / div)}${unit}, ${preferred}, ${trim(hi / div)}${unit})`, slope, intercept };
}

/** clamp() の中間値が、指定した幅でどのサイズになるか */
export function sizeAt(minSize: number, maxSize: number, minViewport: number, maxViewport: number, viewport: number): number {
  const slope = (maxSize - minSize) / (maxViewport - minViewport);
  const v = minSize + slope * (viewport - minViewport);
  return Math.min(Math.max(v, Math.min(minSize, maxSize)), Math.max(minSize, maxSize));
}
