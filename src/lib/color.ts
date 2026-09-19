export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };
export type Hsv = { h: number; s: number; v: number };
export type Cmyk = { c: number; m: number; y: number; k: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isValidRgb(rgb: Rgb): boolean {
  return [rgb.r, rgb.g, rgb.b].every(
    (v) => Number.isFinite(v) && v >= 0 && v <= 255
  );
}

// ---------- HEX ----------

export function parseHex(input: string): Rgb | null {
  const hex = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return { r, g, b };
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

export function formatHex({ r, g, b }: Rgb): string {
  const toHex = (v: number) =>
    clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// ---------- RGB ----------

export function parseRgbString(input: string): Rgb | null {
  const numbers = input.match(/-?\d+(\.\d+)?/g);
  if (!numbers || numbers.length < 3) return null;
  const [r, g, b] = numbers.slice(0, 3).map(Number);
  const rgb = { r, g, b };
  return isValidRgb(rgb) ? rgb : null;
}

export function formatRgb({ r, g, b }: Rgb): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// ---------- HSL ----------

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r1, g1, b1] = [0, 0, 0];

  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const m = ln - c / 2;
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
}

export function parseHslString(input: string): Rgb | null {
  const numbers = input.match(/-?\d+(\.\d+)?/g);
  if (!numbers || numbers.length < 3) return null;
  const [h, s, l] = numbers.slice(0, 3).map(Number);
  if (![h, s, l].every(Number.isFinite)) return null;
  return hslToRgb({ h, s, l });
}

export function formatHsl(rgb: Rgb): string {
  const { h, s, l } = rgbToHsl(rgb);
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

// ---------- HSV ----------

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s: s * 100, v: v * 100 };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const sn = s / 100;
  const vn = v / 100;
  const c = vn * sn;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r1, g1, b1] = [0, 0, 0];

  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const m = vn - c;
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
}

export function parseHsvString(input: string): Rgb | null {
  const numbers = input.match(/-?\d+(\.\d+)?/g);
  if (!numbers || numbers.length < 3) return null;
  const [h, s, v] = numbers.slice(0, 3).map(Number);
  if (![h, s, v].every(Number.isFinite)) return null;
  return hsvToRgb({ h, s, v });
}

export function formatHsv(rgb: Rgb): string {
  const { h, s, v } = rgbToHsv(rgb);
  return `hsv(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(v)}%)`;
}

// ---------- CMYK ----------

export function rgbToCmyk({ r, g, b }: Rgb): Cmyk {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);

  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };

  const c = (1 - rn - k) / (1 - k);
  const m = (1 - gn - k) / (1 - k);
  const y = (1 - bn - k) / (1 - k);

  return { c: c * 100, m: m * 100, y: y * 100, k: k * 100 };
}

export function cmykToRgb({ c, m, y, k }: Cmyk): Rgb {
  const cn = c / 100;
  const mn = m / 100;
  const yn = y / 100;
  const kn = k / 100;

  return {
    r: 255 * (1 - cn) * (1 - kn),
    g: 255 * (1 - mn) * (1 - kn),
    b: 255 * (1 - yn) * (1 - kn),
  };
}

export function parseCmykString(input: string): Rgb | null {
  const numbers = input.match(/-?\d+(\.\d+)?/g);
  if (!numbers || numbers.length < 4) return null;
  const [c, m, y, k] = numbers.slice(0, 4).map(Number);
  if (![c, m, y, k].every(Number.isFinite)) return null;
  return cmykToRgb({ c, m, y, k });
}

export function formatCmyk(rgb: Rgb): string {
  const { c, m, y, k } = rgbToCmyk(rgb);
  return `cmyk(${Math.round(c)}%, ${Math.round(m)}%, ${Math.round(y)}%, ${Math.round(k)}%)`;
}

// ---------- WCAG コントラスト比 ----------

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type WcagResult = {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
};

/** WCAG 2.1に基づくコントラスト比判定（AA: 4.5/3.0、AAA: 7.0/4.5） */
export function evaluateWcag(foreground: Rgb, background: Rgb): WcagResult {
  const ratio = contrastRatio(foreground, background);
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  };
}
