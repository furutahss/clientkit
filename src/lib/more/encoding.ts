/** 文字コードの判定・変換・文字化け修復。TextDecoderで復号し、逆引き表を作って Shift_JIS / EUC-JP / ISO-2022-JP に符号化する */

export const ENCODINGS = ["utf-8", "shift_jis", "euc-jp", "iso-2022-jp", "utf-16le", "utf-16be", "windows-1252", "gb18030", "big5", "euc-kr"] as const;
export type EncodingName = (typeof ENCODINGS)[number];

export function decodeBytes(bytes: Uint8Array, label: string, fatal = false): string {
  return new TextDecoder(label, { fatal }).decode(bytes);
}

const tryDecode = (bytes: Uint8Array, label: string): string | null => { try { return decodeBytes(bytes, label, true); } catch { return null; } };

/** 「日本語として自然か」の簡易スコア（0〜1）。かな・漢字・ASCII の割合から、制御文字・私用領域・U+FFFD を減点 */
export function japaneseScore(text: string): number {
  if (!text) return 0;
  let good = 0, bad = 0, kana = 0, kanji = 0, total = 0;
  for (const ch of text) {
    total++;
    const c = ch.codePointAt(0)!;
    if (c === 0xfffd || (c < 0x20 && c !== 9 && c !== 10 && c !== 13) || (c >= 0xe000 && c <= 0xf8ff) || (c >= 0x80 && c < 0xa0)) bad++;
    else if ((c >= 0x3040 && c <= 0x30ff) || c === 0x30fc) { good++; kana++; }
    else if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf)) { good++; kanji++; }
    else if (c >= 0xff61 && c <= 0xff9f) bad += 0.6; // 半角カタカナは文字化けに多い
    else if (c < 0x80 || (c >= 0x3000 && c <= 0x303f) || (c >= 0xff00 && c <= 0xff60)) good++;
    else if (c >= 0x2500 && c <= 0x25ff) bad += 0.3; // 罫線・図形（化けると出やすい）
    else bad += 0.2;
  }
  const base = (good - bad * 2) / total;
  return Math.max(0, Math.min(1, base + (kana > 0 && kanji > 0 ? 0.05 : 0)));
}

export type Detection = { encoding: string; text: string; score: number; bom?: boolean };

export function detectEncoding(bytes: Uint8Array): Detection[] {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return [{ encoding: "utf-8", text: decodeBytes(bytes.subarray(3), "utf-8"), score: 1, bom: true }];
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return [{ encoding: "utf-16le", text: decodeBytes(bytes.subarray(2), "utf-16le"), score: 1, bom: true }];
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return [{ encoding: "utf-16be", text: decodeBytes(bytes.subarray(2), "utf-16be"), score: 1, bom: true }];
  const out: Detection[] = [];
  const ascii = bytes.every((b) => b < 0x80 && b !== 0x1b);
  if (ascii) return [{ encoding: "ascii (utf-8 compatible)", text: decodeBytes(bytes, "utf-8"), score: 1 }];
  const hasEsc = bytes.includes(0x1b);
  for (const enc of hasEsc ? ["iso-2022-jp", "utf-8"] : ["utf-8", "shift_jis", "euc-jp", "utf-16le", "utf-16be", "gb18030", "big5", "euc-kr", "windows-1252"]) {
    const text = tryDecode(bytes, enc);
    if (text === null) continue;
    let score = japaneseScore(text);
    if (enc === "utf-8") score = Math.min(1, score + 0.1); // 厳密に復号できる UTF-8 は偶然では成立しにくい
    if (enc.startsWith("utf-16") && !/[぀-ヿ一-鿿]/.test(text)) score *= 0.3;
    if (!/[぀-ヿ一-鿿]/.test(text) && enc !== "utf-8") score *= 0.6;
    out.push({ encoding: enc, text, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ---- 符号化（逆引き表） ----
const tables = new Map<string, Map<string, number[]>>();

function buildTable(label: "shift_jis" | "euc-jp"): Map<string, number[]> {
  const cached = tables.get(label);
  if (cached) return cached;
  const dec = new TextDecoder(label);
  const m = new Map<string, number[]>();
  const put = (ch: string, bytes: number[]) => { if (ch && ch !== "�" && ch.length >= 1 && !m.has(ch)) m.set(ch, bytes); };
  for (let b = 0; b < 0x80; b++) put(dec.decode(Uint8Array.of(b)), [b]);
  if (label === "shift_jis") {
    for (let b = 0xa1; b <= 0xdf; b++) put(dec.decode(Uint8Array.of(b)), [b]);
    for (let lead = 0x81; lead <= 0xfc; lead++) {
      if (lead > 0x9f && lead < 0xe0) continue;
      for (let trail = 0x40; trail <= 0xfc; trail++) { if (trail === 0x7f) continue; const s = dec.decode(Uint8Array.of(lead, trail)); if (Array.from(s).length === 1) put(s, [lead, trail]); }
    }
  } else {
    for (let b = 0xa1; b <= 0xdf; b++) put(dec.decode(Uint8Array.of(0x8e, b)), [0x8e, b]);
    for (let a = 0xa1; a <= 0xfe; a++) for (let b = 0xa1; b <= 0xfe; b++) { const s = dec.decode(Uint8Array.of(a, b)); if (Array.from(s).length === 1) put(s, [a, b]); }
    for (let a = 0xa1; a <= 0xfe; a++) for (let b = 0xa1; b <= 0xfe; b++) { const s = dec.decode(Uint8Array.of(0x8f, a, b)); if (Array.from(s).length === 1) put(s, [0x8f, a, b]); }
  }
  tables.set(label, m);
  return m;
}

/** 符号化できなかった文字は "?" に置き換え、その数を返す。lostByte を指定すると、U+FFFD（復号で失われたバイト）をそのバイト値にする（文字化け修復用） */
export function encodeText(text: string, label: EncodingName, lostByte?: number): { bytes: Uint8Array; replaced: number } {
  let replaced = 0;
  if (label === "utf-8") return { bytes: new TextEncoder().encode(text), replaced };
  if (label === "utf-16le" || label === "utf-16be") {
    const out = new Uint8Array(text.length * 2);
    for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); out[i * 2 + (label === "utf-16le" ? 0 : 1)] = c & 0xff; out[i * 2 + (label === "utf-16le" ? 1 : 0)] = c >> 8; }
    return { bytes: out, replaced };
  }
  if (label === "windows-1252") {
    const dec = new TextDecoder("windows-1252");
    const rev = new Map<string, number>();
    for (let b = 0; b < 256; b++) { const ch = dec.decode(Uint8Array.of(b)); if (!rev.has(ch)) rev.set(ch, b); }
    const out: number[] = [];
    for (const ch of text) { const b = ch === "\ufffd" && lostByte !== undefined ? lostByte : rev.get(ch); if (b === undefined) { out.push(0x3f); replaced++; } else out.push(b); }
    return { bytes: Uint8Array.from(out), replaced };
  }
  if (label === "shift_jis" || label === "euc-jp") {
    const t = buildTable(label);
    const out: number[] = [];
    for (const ch of text) {
      if (ch === "�" && lostByte !== undefined) { out.push(lostByte); continue; }
      const b = t.get(ch) ?? t.get(ch === "¥" ? "\\" : ch === "‾" ? "~" : ch === "～" ? "〜" : ch);
      if (!b) { out.push(0x3f); replaced++; } else out.push(...b);
    }
    return { bytes: Uint8Array.from(out), replaced };
  }
  if (label === "iso-2022-jp") {
    const t = buildTable("euc-jp");
    const out: number[] = [];
    let mode: "ascii" | "jis" = "ascii";
    const to = (m: "ascii" | "jis") => { if (m !== mode) { out.push(...(m === "jis" ? [0x1b, 0x24, 0x42] : [0x1b, 0x28, 0x42])); mode = m; } };
    for (const ch of text) {
      const b = t.get(ch);
      if (b && b.length === 1 && b[0] < 0x80) { to("ascii"); out.push(b[0]); }
      else if (b && b.length === 2 && b[0] !== 0x8e) { to("jis"); out.push(b[0] - 0x80, b[1] - 0x80); }
      else { to("ascii"); out.push(0x3f); replaced++; }
    }
    to("ascii");
    return { bytes: Uint8Array.from(out), replaced };
  }
  throw new Error(`unsupported encoding: ${label}`);
}

export type Repair = { path: string; text: string; score: number };

/** 文字化けしたテキストを、「元の符号化 → 誤った復号」の逆をたどって復元する候補を返す */
export function repairMojibake(text: string): Repair[] {
  const paths: [string, EncodingName, string][] = [
    ["UTF-8 → Shift_JIS", "shift_jis", "utf-8"],
    ["UTF-8 → Latin-1 (Windows-1252)", "windows-1252", "utf-8"],
    ["UTF-8 → EUC-JP", "euc-jp", "utf-8"],
    ["Shift_JIS → Latin-1 (Windows-1252)", "windows-1252", "shift_jis"],
    ["EUC-JP → Shift_JIS", "shift_jis", "euc-jp"],
    ["Shift_JIS → EUC-JP", "euc-jp", "shift_jis"],
  ];
  const out: Repair[] = [];
  for (const [path, wrongly, original] of paths) {
    // 誤った復号で失われたバイト（U+FFFD）は 0xFF にして、復元できない文字は � のまま残す
    const { bytes, replaced } = encodeText(text, wrongly, 0xff);
    if (replaced > 0) continue;
    const fixed = decodeBytes(bytes, original);
    const lost = Array.from(fixed).filter((c) => c === "\ufffd").length;
    if (fixed === text || lost > Array.from(fixed).length * 0.5) continue;
    out.push({ path, text: fixed, score: japaneseScore(fixed.replace(/\ufffd/g, "")) - (lost / Array.from(fixed).length) * 0.5 });
  }
  return out.filter((r) => r.score > 0.15).sort((a, b) => b.score - a.score);
}

export function convertLineEndings(text: string, to: "lf" | "crlf" | "cr" | "keep"): string {
  if (to === "keep") return text;
  const lf = text.replace(/\r\n?/g, "\n");
  return to === "lf" ? lf : to === "crlf" ? lf.replace(/\n/g, "\r\n") : lf.replace(/\n/g, "\r");
}

export function lineEndingKind(text: string): string {
  const crlf = (text.match(/\r\n/g) ?? []).length, lf = (text.match(/(?<!\r)\n/g) ?? []).length, cr = (text.match(/\r(?!\n)/g) ?? []).length;
  const kinds = [crlf && `CRLF×${crlf}`, lf && `LF×${lf}`, cr && `CR×${cr}`].filter(Boolean);
  return kinds.length ? kinds.join(" + ") : "none";
}
