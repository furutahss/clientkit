/** IEEE 754 の浮動小数点（binary32 / binary64）のビット構造と、厳密な10進展開 */
export type FloatInfo = { bits: string; hex: string; sign: number; exponentBits: string; exponentRaw: number; exponentUnbiased: number | null; mantissaBits: string; kind: string; exact: string };

function exactDecimal(neg: boolean, mantissa: bigint, exp2: number): string {
  if (mantissa === 0n) return neg ? "-0" : "0";
  let digits: string, scale = 0;
  if (exp2 >= 0) digits = (mantissa << BigInt(exp2)).toString();
  else { digits = (mantissa * 5n ** BigInt(-exp2)).toString(); scale = -exp2; }
  let int = digits, frac = "";
  if (scale > 0) { digits = digits.padStart(scale + 1, "0"); int = digits.slice(0, digits.length - scale); frac = digits.slice(digits.length - scale).replace(/0+$/, ""); }
  return `${neg ? "-" : ""}${int}${frac ? "." + frac : ""}`;
}

export function inspectFloat(value: number, width: 32 | 64): FloatInfo {
  const buf = new DataView(new ArrayBuffer(8));
  if (width === 64) buf.setFloat64(0, value); else buf.setFloat32(0, value);
  const total = width / 8;
  let bits = "";
  for (let i = 0; i < total; i++) bits += buf.getUint8(i).toString(2).padStart(8, "0");
  const expLen = width === 64 ? 11 : 8, manLen = width === 64 ? 52 : 23, bias = width === 64 ? 1023 : 127;
  const sign = Number(bits[0]);
  const exponentBits = bits.slice(1, 1 + expLen), mantissaBits = bits.slice(1 + expLen);
  const exponentRaw = parseInt(exponentBits, 2);
  const man = BigInt("0b" + mantissaBits);
  const maxExp = (1 << expLen) - 1;
  let kind = "normal", exact: string, unbiased: number | null = exponentRaw - bias;
  if (exponentRaw === maxExp) { kind = man === 0n ? (sign ? "-Infinity" : "Infinity") : "NaN"; exact = kind === "NaN" ? "NaN" : kind; unbiased = null; }
  else if (exponentRaw === 0) { kind = man === 0n ? (sign ? "negative zero" : "zero") : "subnormal"; unbiased = man === 0n ? null : 1 - bias; exact = exactDecimal(!!sign, man, 1 - bias - manLen); }
  else exact = exactDecimal(!!sign, (1n << BigInt(manLen)) | man, exponentRaw - bias - manLen);
  const hex = BigInt("0b" + bits).toString(16).padStart(total * 2, "0");
  return { bits, hex, sign, exponentBits, exponentRaw, exponentUnbiased: unbiased, mantissaBits, kind, exact };
}

export function floatFromHex(hex: string, width: 32 | 64): number | null {
  const h = hex.trim().replace(/^0x/i, "").replace(/[\s_]/g, "");
  if (!/^[0-9a-f]+$/i.test(h) || h.length > width / 4) return null;
  const v = new DataView(new ArrayBuffer(8));
  const n = BigInt("0x" + h);
  if (width === 64) v.setBigUint64(0, n); else v.setUint32(0, Number(n));
  return width === 64 ? v.getFloat64(0) : v.getFloat32(0);
}
