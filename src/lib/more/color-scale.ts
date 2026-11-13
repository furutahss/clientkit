/** 1色から 50〜950 のカラースケールを OKLCH で作る */
import { contrastRatio, formatHex, parseHex, type Rgb } from "@/lib/color";

type Lch = { l: number; c: number; h: number };

const toLinear = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const fromLinear = (v: number) => { const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055; return c * 255; };

export function rgbToOklch({ r, g, b }: Rgb): Lch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

/** sRGBの範囲外（ガマット外）なら null */
function oklchToRgb({ l, c, h }: Lch): Rgb | null {
  const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_];
  if (lin.some((v) => v < -0.0005 || v > 1.0005)) return null;
  const [r, g, bl] = lin.map((v) => Math.round(Math.min(255, Math.max(0, fromLinear(Math.min(1, Math.max(0, v)))))));
  return { r, g, b: bl };
}

export function oklchToHex(c: Lch): string {
  // 色域に収まるまで彩度を下げる
  let chroma = c.c;
  for (let i = 0; i < 40; i++) { const rgb = oklchToRgb({ ...c, c: chroma }); if (rgb) return formatHex(rgb); chroma *= 0.93; }
  return formatHex(oklchToRgb({ ...c, c: 0 }) ?? { r: 0, g: 0, b: 0 });
}

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const L_TARGET = [0.975, 0.94, 0.885, 0.815, 0.73, 0.65, 0.57, 0.49, 0.41, 0.33, 0.25];
const C_FACTOR = [0.12, 0.28, 0.5, 0.75, 0.92, 1, 0.95, 0.85, 0.72, 0.58, 0.45];

export type ScaleEntry = { step: number; hex: string; onWhite: number; onBlack: number; anchor: boolean };

export function buildScale(baseHex: string): ScaleEntry[] | null {
  const rgb = parseHex(baseHex);
  if (!rgb) return null;
  const base = rgbToOklch(rgb);
  // 元の色に一番近い明度の段を、その色そのものにする
  const anchor = L_TARGET.reduce((best, l, i) => (Math.abs(l - base.l) < Math.abs(L_TARGET[best] - base.l) ? i : best), 0);
  const peakChroma = base.c / C_FACTOR[anchor];
  const white = { r: 255, g: 255, b: 255 }, black = { r: 0, g: 0, b: 0 };
  return STEPS.map((step, i) => {
    const hex = i === anchor ? formatHex(rgb) : oklchToHex({ l: L_TARGET[i], c: peakChroma * C_FACTOR[i], h: base.h });
    const p = parseHex(hex)!;
    return { step, hex, onWhite: Math.round(contrastRatio(p, white) * 100) / 100, onBlack: Math.round(contrastRatio(p, black) * 100) / 100, anchor: i === anchor };
  });
}
