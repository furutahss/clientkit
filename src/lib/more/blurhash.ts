/** BlurHash のエンコード・デコード（画像の小さなぼかしプレースホルダー）。ピクセル処理だけを扱い、画像の読み込みは呼び出し側で行う */
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

export const encode83 = (value: number, length: number) => { let r = ""; for (let i = 1; i <= length; i++) r += CHARS[Math.floor(value / 83 ** (length - i)) % 83]; return r; };
export const decode83 = (s: string) => { let v = 0; for (const c of s) { const i = CHARS.indexOf(c); if (i < 0) throw new Error("invalid-char"); v = v * 83 + i; } return v; };

const toLinear = (v: number) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const toSrgb = (v: number) => { const x = Math.max(0, Math.min(1, v)); return Math.round((x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055) * 255); };
const signPow = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;

export function encodeBlurHash(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, xc: number, yc: number): string {
  if (xc < 1 || xc > 9 || yc < 1 || yc > 9) throw new Error("components-range");
  if (rgba.length !== width * height * 4) throw new Error("size-mismatch");
  const factors: [number, number, number][] = [];
  for (let j = 0; j < yc; j++) for (let i = 0; i < xc; i++) {
    let r = 0, g = 0, b = 0;
    const norm = i === 0 && j === 0 ? 1 : 2;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const basis = norm * Math.cos((Math.PI * i * x) / width) * Math.cos((Math.PI * j * y) / height);
      const p = (y * width + x) * 4;
      r += basis * toLinear(rgba[p]); g += basis * toLinear(rgba[p + 1]); b += basis * toLinear(rgba[p + 2]);
    }
    const s = 1 / (width * height);
    factors.push([r * s, g * s, b * s]);
  }
  const dc = factors[0], ac = factors.slice(1);
  let hash = encode83(xc - 1 + (yc - 1) * 9, 1);
  let maximum = 1;
  if (ac.length) {
    const actual = Math.max(...ac.flatMap((f) => f.map(Math.abs)));
    const q = Math.max(0, Math.min(82, Math.floor(actual * 166 - 0.5)));
    maximum = (q + 1) / 166;
    hash += encode83(q, 1);
  } else hash += encode83(0, 1);
  hash += encode83((toSrgb(dc[0]) << 16) + (toSrgb(dc[1]) << 8) + toSrgb(dc[2]), 4);
  for (const f of ac) {
    const q = f.map((v) => Math.max(0, Math.min(18, Math.floor(signPow(v / maximum, 0.5) * 9 + 9.5))));
    hash += encode83(q[0] * 19 * 19 + q[1] * 19 + q[2], 2);
  }
  return hash;
}

export function decodeBlurHash(hash: string, width: number, height: number, punch = 1): Uint8ClampedArray {
  if (hash.length < 6) throw new Error("too-short");
  const sizeFlag = decode83(hash[0]);
  const yc = Math.floor(sizeFlag / 9) + 1, xc = (sizeFlag % 9) + 1;
  if (hash.length !== 4 + 2 * xc * yc) throw new Error("bad-length");
  const maximum = ((decode83(hash[1]) + 1) / 166) * punch;
  const colors: [number, number, number][] = [];
  for (let i = 0; i < xc * yc; i++) {
    if (i === 0) { const v = decode83(hash.slice(2, 6)); colors.push([toLinear(v >> 16), toLinear((v >> 8) & 255), toLinear(v & 255)]); }
    else { const v = decode83(hash.slice(4 + i * 2, 6 + i * 2)); colors.push([signPow((Math.floor(v / 361) - 9) / 9, 2) * maximum, signPow(((Math.floor(v / 19) % 19) - 9) / 9, 2) * maximum, signPow(((v % 19) - 9) / 9, 2) * maximum]); }
  }
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < yc; j++) for (let i = 0; i < xc; i++) {
      const basis = Math.cos((Math.PI * x * i) / width) * Math.cos((Math.PI * y * j) / height);
      const c = colors[i + j * xc];
      r += c[0] * basis; g += c[1] * basis; b += c[2] * basis;
    }
    const p = (y * width + x) * 4;
    out[p] = toSrgb(r); out[p + 1] = toSrgb(g); out[p + 2] = toSrgb(b); out[p + 3] = 255;
  }
  return out;
}
