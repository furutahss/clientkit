/** 追加ツール共通の小さなバイト列・文字列ユーティリティ */

export function bytesToHex(bytes: Uint8Array, sep = ""): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(sep);
}

/** 16進文字列（空白・0x・コロン区切りを許容）をバイト列にする。不正ならnull */
export function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.replace(/0x/gi, "").replace(/[\s:,-]/g, "");
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Base64 / Base64URL（空白・改行・パディング省略を許容）をバイト列にする。不正ならnull */
export function base64ToBytes(input: string): Uint8Array | null {
  const clean = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (/[^A-Za-z0-9+/]/.test(clean) || clean.length % 4 === 1) return null;
  try {
    const bin = atob(clean + "=".repeat((4 - (clean.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export function base64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
export const fromUtf8 = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/** 入力欄のテキスト、またはファイルの中身（UTF-8）のうち、あるほうを返す */
export function textOrFile(text: string, files: { bytes: Uint8Array }[]): string {
  return files[0] ? fromUtf8(files[0].bytes) : text;
}

/** 文字列比較を一定時間で行う（署名検証用） */
export function constantTimeEqual(a: string, b: string): boolean {
  const x = utf8(a);
  const y = utf8(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countBy<T>(items: T[], key: (item: T) => string): [string, number][] {
  const map = new Map<string, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** バイナリDERの最小リーダー（タグ・長さ・値）。SSH鍵やDKIM、CSRの解析に使う */
export type Tlv = { tag: number; start: number; len: number; end: number; header: number };
export function readTlv(buf: Uint8Array, pos: number): Tlv | null {
  if (pos + 2 > buf.length) return null;
  const tag = buf[pos];
  let len = buf[pos + 1];
  let header = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4 || pos + 2 + n > buf.length) return null;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[pos + 2 + i];
    header = 2 + n;
  }
  const start = pos + header;
  if (start + len > buf.length) return null;
  return { tag, start, len, end: start + len, header };
}
