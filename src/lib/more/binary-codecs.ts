/** MessagePack と CBOR の最小実装（デコード・エンコード）。バイナリは {"$binary": "hex"}、拡張型は {"$ext": n, "data": hex} で表す */
import { bytesToHex } from "./util";

export type V = null | boolean | number | string | V[] | { [k: string]: V };

class Reader {
  pos = 0;
  constructor(readonly b: Uint8Array) {}
  get view() { return new DataView(this.b.buffer, this.b.byteOffset, this.b.byteLength); }
  need(n: number) { if (this.pos + n > this.b.length) throw new Error("unexpected end of data"); }
  u8() { this.need(1); return this.b[this.pos++]; }
  u16() { this.need(2); const v = this.view.getUint16(this.pos); this.pos += 2; return v; }
  u32() { this.need(4); const v = this.view.getUint32(this.pos); this.pos += 4; return v; }
  u64() { this.need(8); const v = this.view.getBigUint64(this.pos); this.pos += 8; return v; }
  bytes(n: number) { this.need(n); const v = this.b.subarray(this.pos, this.pos + n); this.pos += n; return v; }
}
const big = (v: bigint): number | string => (v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString());
const text = (b: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(b);
const keyOf = (k: V) => (typeof k === "string" ? k : JSON.stringify(k));

export function decodeMsgpack(bytes: Uint8Array): V {
  const r = new Reader(bytes);
  const read = (depth = 0): V => {
    if (depth > 100) throw new Error("nesting too deep");
    const t = r.u8();
    if (t <= 0x7f) return t;
    if (t >= 0xe0) return t - 0x100;
    if (t >= 0xa0 && t <= 0xbf) return text(r.bytes(t & 0x1f));
    if (t >= 0x90 && t <= 0x9f) return arr(t & 0x0f, depth);
    if (t >= 0x80 && t <= 0x8f) return map(t & 0x0f, depth);
    switch (t) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xc4: return { $binary: bytesToHex(r.bytes(r.u8())) };
      case 0xc5: return { $binary: bytesToHex(r.bytes(r.u16())) };
      case 0xc6: return { $binary: bytesToHex(r.bytes(r.u32())) };
      case 0xc7: return ext(r.u8());
      case 0xc8: return ext(r.u16());
      case 0xc9: return ext(r.u32());
      case 0xca: { r.need(4); const v = r.view.getFloat32(r.pos); r.pos += 4; return v; }
      case 0xcb: { r.need(8); const v = r.view.getFloat64(r.pos); r.pos += 8; return v; }
      case 0xcc: return r.u8();
      case 0xcd: return r.u16();
      case 0xce: return r.u32();
      case 0xcf: return big(r.u64());
      case 0xd0: { const v = r.u8(); return v > 127 ? v - 256 : v; }
      case 0xd1: { const v = r.u16(); return v > 32767 ? v - 65536 : v; }
      case 0xd2: return r.u32() | 0;
      case 0xd3: return big(BigInt.asIntN(64, r.u64()));
      case 0xd4: return ext(1); case 0xd5: return ext(2); case 0xd6: return ext(4); case 0xd7: return ext(8); case 0xd8: return ext(16);
      case 0xd9: return text(r.bytes(r.u8()));
      case 0xda: return text(r.bytes(r.u16()));
      case 0xdb: return text(r.bytes(r.u32()));
      case 0xdc: return arr(r.u16(), depth);
      case 0xdd: return arr(r.u32(), depth);
      case 0xde: return map(r.u16(), depth);
      case 0xdf: return map(r.u32(), depth);
    }
    throw new Error(`invalid type byte 0x${t.toString(16)}`);
  };
  const arr = (n: number, d: number): V[] => { const out: V[] = []; for (let i = 0; i < n; i++) out.push(read(d + 1)); return out; };
  const map = (n: number, d: number): V => { const out: { [k: string]: V } = {}; for (let i = 0; i < n; i++) { const k = read(d + 1); out[keyOf(k)] = read(d + 1); } return out; };
  const ext = (len: number): V => {
    const type = r.u8() > 127 ? r.b[r.pos - 1] - 256 : r.b[r.pos - 1];
    const data = r.bytes(len);
    if (type === -1) { // タイムスタンプ拡張
      const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
      if (len === 4) return new Date(v.getUint32(0) * 1000).toISOString();
      if (len === 8) { const x = v.getBigUint64(0); return new Date(Number(x & 0x3ffffffffn) * 1000 + Number(x >> 34n) / 1e6).toISOString(); }
      if (len === 12) return new Date(Number(v.getBigInt64(4)) * 1000 + v.getUint32(0) / 1e6).toISOString();
    }
    return { $ext: type, data: bytesToHex(data) };
  };
  const out = read();
  if (r.pos !== bytes.length) throw new Error(`${bytes.length - r.pos} trailing bytes after the first value`);
  return out;
}

export function decodeCbor(bytes: Uint8Array): V {
  const r = new Reader(bytes);
  const half = (h: number) => { const e = (h >> 10) & 0x1f, f = h & 0x3ff; return (h & 0x8000 ? -1 : 1) * (e === 0 ? f * 2 ** -24 : e === 31 ? (f ? NaN : Infinity) : (1 + f / 1024) * 2 ** (e - 15)); };
  const len = (ai: number): number | null => {
    if (ai < 24) return ai;
    if (ai === 24) return r.u8();
    if (ai === 25) return r.u16();
    if (ai === 26) return r.u32();
    if (ai === 27) return Number(big(r.u64()));
    if (ai === 31) return null;
    throw new Error(`invalid additional info ${ai}`);
  };
  const read = (depth = 0): V => {
    if (depth > 100) throw new Error("nesting too deep");
    const ib = r.u8();
    const major = ib >> 5, ai = ib & 31;
    switch (major) {
      case 0: return ai === 27 ? big(r.u64()) : (len(ai) as number);
      case 1: return ai === 27 ? big(-1n - r.u64()) : -1 - (len(ai) as number);
      case 2: case 3: {
        const n = len(ai);
        const chunks: Uint8Array[] = [];
        if (n === null) { while (r.b[r.pos] !== 0xff) { const c = read(depth + 1); chunks.push(typeof c === "string" ? new TextEncoder().encode(c) : hexBytes((c as { $binary: string }).$binary)); } r.pos++; }
        else chunks.push(r.bytes(n));
        const joined = Uint8Array.from(chunks.flatMap((c) => [...c]));
        return major === 3 ? text(joined) : { $binary: bytesToHex(joined) };
      }
      case 4: { const n = len(ai); const out: V[] = []; if (n === null) { while (r.b[r.pos] !== 0xff) out.push(read(depth + 1)); r.pos++; } else for (let i = 0; i < n; i++) out.push(read(depth + 1)); return out; }
      case 5: { const n = len(ai); const out: { [k: string]: V } = {}; const one = () => { const k = read(depth + 1); out[keyOf(k)] = read(depth + 1); }; if (n === null) { while (r.b[r.pos] !== 0xff) one(); r.pos++; } else for (let i = 0; i < n; i++) one(); return out; }
      case 6: { const tag = len(ai) as number; const v = read(depth + 1); if (tag === 1 && typeof v === "number") return new Date(v * 1000).toISOString(); if (tag === 0 || tag === 32) return v; return { $tag: tag, value: v }; }
      default:
        if (ai === 20) return false;
        if (ai === 21) return true;
        if (ai === 22 || ai === 23) return null;
        if (ai === 25) return half(r.u16());
        if (ai === 26) { r.need(4); const v = r.view.getFloat32(r.pos); r.pos += 4; return v; }
        if (ai === 27) { r.need(8); const v = r.view.getFloat64(r.pos); r.pos += 8; return v; }
        if (ai < 20) return { $simple: ai };
        if (ai === 24) return { $simple: r.u8() };
        throw new Error(`invalid simple value ${ai}`);
    }
  };
  const out = read();
  if (r.pos !== bytes.length) throw new Error(`${bytes.length - r.pos} trailing bytes after the first value`);
  return out;
}

const hexBytes = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
const concat = (parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

export function encodeMsgpack(v: V): Uint8Array {
  const u = (...b: number[]) => Uint8Array.from(b);
  const num = (n: number, bytes = 4) => { const x = new Uint8Array(bytes); const dv = new DataView(x.buffer); if (bytes === 2) dv.setUint16(0, n); else if (bytes === 4) dv.setUint32(0, n); return x; };
  const enc = (x: V): Uint8Array => {
    if (x === null) return u(0xc0);
    if (typeof x === "boolean") return u(x ? 0xc3 : 0xc2);
    if (typeof x === "number") {
      if (Number.isInteger(x)) {
        if (x >= 0) { if (x < 128) return u(x); if (x < 256) return u(0xcc, x); if (x < 65536) return concat([u(0xcd), num(x, 2)]); if (x < 2 ** 32) return concat([u(0xce), num(x)]); const b = new Uint8Array(9); b[0] = 0xcf; new DataView(b.buffer).setBigUint64(1, BigInt(x)); return b; }
        if (x >= -32) return u(x & 0xff);
        if (x >= -128) return u(0xd0, x & 0xff);
        if (x >= -32768) { const b = new Uint8Array(3); b[0] = 0xd1; new DataView(b.buffer).setInt16(1, x); return b; }
        if (x >= -(2 ** 31)) { const b = new Uint8Array(5); b[0] = 0xd2; new DataView(b.buffer).setInt32(1, x); return b; }
        const b = new Uint8Array(9); b[0] = 0xd3; new DataView(b.buffer).setBigInt64(1, BigInt(x)); return b;
      }
      const b = new Uint8Array(9); b[0] = 0xcb; new DataView(b.buffer).setFloat64(1, x); return b;
    }
    if (typeof x === "string") { const s = new TextEncoder().encode(x); const n = s.length; return concat([n < 32 ? u(0xa0 | n) : n < 256 ? u(0xd9, n) : n < 65536 ? concat([u(0xda), num(n, 2)]) : concat([u(0xdb), num(n)]), s]); }
    if (Array.isArray(x)) { const n = x.length; return concat([n < 16 ? u(0x90 | n) : n < 65536 ? concat([u(0xdc), num(n, 2)]) : concat([u(0xdd), num(n)]), ...x.map(enc)]); }
    const entries = Object.entries(x);
    const n = entries.length;
    return concat([n < 16 ? u(0x80 | n) : n < 65536 ? concat([u(0xde), num(n, 2)]) : concat([u(0xdf), num(n)]), ...entries.flatMap(([k, val]) => [enc(k), enc(val)])]);
  };
  return enc(v);
}

export function encodeCbor(v: V): Uint8Array {
  const head = (major: number, n: number): Uint8Array => {
    if (n < 24) return Uint8Array.of((major << 5) | n);
    if (n < 256) return Uint8Array.of((major << 5) | 24, n);
    if (n < 65536) return Uint8Array.of((major << 5) | 25, n >> 8, n & 255);
    if (n < 2 ** 32) { const b = new Uint8Array(5); b[0] = (major << 5) | 26; new DataView(b.buffer).setUint32(1, n); return b; }
    const b = new Uint8Array(9); b[0] = (major << 5) | 27; new DataView(b.buffer).setBigUint64(1, BigInt(n)); return b;
  };
  const enc = (x: V): Uint8Array => {
    if (x === null) return Uint8Array.of(0xf6);
    if (typeof x === "boolean") return Uint8Array.of(x ? 0xf5 : 0xf4);
    if (typeof x === "number") {
      if (Number.isInteger(x) && Math.abs(x) <= Number.MAX_SAFE_INTEGER) return x >= 0 ? head(0, x) : head(1, -1 - x);
      const b = new Uint8Array(9); b[0] = 0xfb; new DataView(b.buffer).setFloat64(1, x); return b;
    }
    if (typeof x === "string") { const s = new TextEncoder().encode(x); return concat([head(3, s.length), s]); }
    if (Array.isArray(x)) return concat([head(4, x.length), ...x.map(enc)]);
    const entries = Object.entries(x);
    return concat([head(5, entries.length), ...entries.flatMap(([k, val]) => [enc(k), enc(val)])]);
  };
  return enc(v);
}
