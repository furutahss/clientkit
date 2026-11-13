/** 1次元バーコード（EAN-13 / UPC-A / EAN-8 / Code 128 / Code 39 / ITF）のエンコードとSVG出力 */
export type BarcodeKind = "ean13" | "upca" | "ean8" | "code128" | "code39" | "itf";

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function eanCheckDigit(body: string): number {
  const len = body.length;
  let sum = 0;
  for (let i = 0; i < len; i++) sum += Number(body[i]) * ((len - i) % 2 === 1 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

export function encodeEan(digits: string, kind: "ean13" | "upca" | "ean8"): { modules: string; text: string } {
  const want = kind === "ean8" ? 8 : kind === "upca" ? 12 : 13;
  if (!/^\d+$/.test(digits)) throw new Error("digits-only");
  let d = digits;
  if (d.length === want - 1) d += eanCheckDigit(d);
  if (d.length !== want) throw new Error(`length:${want - 1}or${want}`);
  if (eanCheckDigit(d.slice(0, -1)) !== Number(d[d.length - 1])) throw new Error("check-digit");
  if (kind === "upca") d = "0" + d;
  if (kind === "ean8") {
    const left = d.slice(0, 4), right = d.slice(4);
    return { modules: "101" + [...left].map((c) => L[+c]).join("") + "01010" + [...right].map((c) => R[+c]).join("") + "101", text: d };
  }
  const parity = PARITY[+d[0]];
  const left = [...d.slice(1, 7)].map((c, i) => (parity[i] === "L" ? L[+c] : G[+c])).join("");
  const right = [...d.slice(7)].map((c) => R[+c]).join("");
  return { modules: "101" + left + "01010" + right + "101", text: kind === "upca" ? d.slice(1) : d };
}

// Code 128: 各シンボルのバー幅（11モジュール、最後の stop は13）
const C128 = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];

export function code128Values(text: string): number[] {
  const chars = Array.from(text);
  if (!chars.length) throw new Error("empty");
  for (const c of chars) if (c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126) throw new Error("ascii-printable");
  const values: number[] = [];
  // 数字が4桁以上続く区間は Code C（2桁を1シンボル）、それ以外は Code B
  let i = 0, set: "B" | "C" | null = null;
  while (i < chars.length) {
    let run = 0;
    while (i + run < chars.length && /\d/.test(chars[i + run])) run++;
    const useC = run >= 4 && (i === 0 || set === "C" || run >= 4) && (run % 2 === 0 || run >= 5);
    if (useC) {
      const pairs = Math.floor(run / 2);
      if (set === null) values.push(105); else if (set !== "C") values.push(99);
      set = "C";
      for (let k = 0; k < pairs; k++) values.push(Number(chars[i + k * 2] + chars[i + k * 2 + 1]));
      i += pairs * 2;
    } else {
      if (set === null) values.push(104); else if (set !== "B") values.push(100);
      set = "B";
      values.push(chars[i].charCodeAt(0) - 32);
      i++;
    }
  }
  const sum = values.reduce((s, v, idx) => s + v * (idx === 0 ? 1 : idx), 0);
  values.push(sum % 103, 106);
  return values;
}

export function encodeCode128(text: string): { modules: string; text: string } {
  let modules = "";
  for (const v of code128Values(text)) {
    const widths = C128[v];
    [...widths].forEach((w, i) => { modules += (i % 2 === 0 ? "1" : "0").repeat(Number(w)); });
  }
  return { modules, text };
}

const C39: Record<string, string> = { "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn", A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn", K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn", U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn", Z: "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", $: "nwnwnwnnn", "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn", "*": "nwnnwnwnn" };

export function encodeCode39(text: string): { modules: string; text: string } {
  const t = text.toUpperCase();
  for (const c of t) if (!(c in C39) || c === "*") throw new Error("code39-chars");
  let modules = "";
  [...`*${t}*`].forEach((c, ci) => {
    if (ci > 0) modules += "0";
    [...C39[c]].forEach((w, i) => { modules += (i % 2 === 0 ? "1" : "0").repeat(w === "w" ? 3 : 1); });
  });
  return { modules, text: t };
}

const ITF = ["nnwwn", "wnnnw", "nwnnw", "wwnnn", "nnwnw", "wnwnn", "nwwnn", "nnnww", "wnnwn", "nwnwn"];
export function encodeItf(digits: string): { modules: string; text: string } {
  if (!/^\d+$/.test(digits) || digits.length % 2 !== 0) throw new Error("itf-even");
  let modules = "1010";
  for (let i = 0; i < digits.length; i += 2) {
    const a = ITF[+digits[i]], b = ITF[+digits[i + 1]];
    for (let k = 0; k < 5; k++) modules += "1".repeat(a[k] === "w" ? 3 : 1) + "0".repeat(b[k] === "w" ? 3 : 1);
  }
  return { modules: modules + "11101", text: digits };
}

export function encodeBarcode(kind: BarcodeKind, value: string): { modules: string; text: string } {
  switch (kind) {
    case "ean13": case "upca": case "ean8": return encodeEan(value.trim(), kind);
    case "code128": return encodeCode128(value);
    case "code39": return encodeCode39(value);
    case "itf": return encodeItf(value.trim());
  }
}

/** モジュール列をSVG文字列にする（隣り合う黒を1つの矩形にまとめる） */
export function barcodeSvg(modules: string, text: string, opts: { moduleWidth: number; height: number; quiet: number; showText: boolean }): string {
  const w = (modules.length + opts.quiet * 2) * opts.moduleWidth;
  const h = opts.height + (opts.showText ? 18 : 0);
  const rects: string[] = [];
  for (let i = 0; i < modules.length; ) {
    if (modules[i] !== "1") { i++; continue; }
    let j = i;
    while (modules[j] === "1") j++;
    rects.push(`<rect x="${(i + opts.quiet) * opts.moduleWidth}" y="0" width="${(j - i) * opts.moduleWidth}" height="${opts.height}"/>`);
    i = j;
  }
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/><g fill="#000">${rects.join("")}</g>${opts.showText ? `<text x="${w / 2}" y="${opts.height + 14}" text-anchor="middle" font-family="monospace" font-size="12">${esc}</text>` : ""}</svg>`;
}
