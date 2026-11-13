/** 基数変換・ビット演算（BigInt）。2の補数表示にも対応 */
export function parseInteger(input: string, base: number): bigint | null {
  let s = input.trim().replace(/[_\s]/g, "");
  let neg = false;
  if (s.startsWith("-")) { neg = true; s = s.slice(1); } else if (s.startsWith("+")) s = s.slice(1);
  const prefixes: Record<string, number> = { "0x": 16, "0b": 2, "0o": 8 };
  const p = prefixes[s.slice(0, 2).toLowerCase()];
  if (p) { base = p; s = s.slice(2); }
  if (!s) return null;
  let v = 0n;
  const b = BigInt(base);
  for (const ch of s.toLowerCase()) {
    const d = parseInt(ch, 36);
    if (Number.isNaN(d) || d >= base) return null;
    v = v * b + BigInt(d);
  }
  return neg ? -v : v;
}

export const toBase = (v: bigint, base: number) => (v < 0n ? "-" : "") + (v < 0n ? -v : v).toString(base);

export const WIDTHS = [8, 16, 32, 64] as const;
export function toUnsigned(v: bigint, width: number): bigint { return BigInt.asUintN(width, v); }
export function toSigned(v: bigint, width: number): bigint { return BigInt.asIntN(width, v); }

export function bitsString(v: bigint, width: number, group = 4): string {
  const s = BigInt.asUintN(width, v).toString(2).padStart(width, "0");
  return s.replace(new RegExp(`(.{${group}})(?=.)`, "g"), "$1 ");
}

export type BitOp = "and" | "or" | "xor" | "not" | "shl" | "shr" | "sar";
export function bitOp(op: BitOp, a: bigint, b: bigint, width: number): bigint {
  const mask = (1n << BigInt(width)) - 1n;
  const ua = a & mask, ub = b & mask;
  switch (op) {
    case "and": return ua & ub;
    case "or": return ua | ub;
    case "xor": return ua ^ ub;
    case "not": return ~ua & mask;
    case "shl": return (ua << (b & 0xffn)) & mask;
    case "shr": return ua >> (b & 0xffn);
    case "sar": return BigInt.asUintN(width, BigInt.asIntN(width, ua) >> (b & 0xffn));
  }
}

export function fitsWidth(v: bigint, width: number): { unsigned: boolean; signed: boolean } {
  return { unsigned: v >= 0n && v < 1n << BigInt(width), signed: v >= -(1n << BigInt(width - 1)) && v < 1n << BigInt(width - 1) };
}
