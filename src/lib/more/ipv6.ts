/** IPv6アドレスの解析・表記変換・CIDR計算（BigInt） */

export function parseIPv6(input: string): bigint | null {
  let s = input.trim().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (!s) return null;
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s);
  if (v4) {
    const o = v4.slice(1).map(Number);
    if (o.some((n) => n > 255)) return null;
    s = s.slice(0, v4.index) + ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const toGroups = (p: string) => (p ? p.split(":") : []);
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (halves.length === 1 && head.length !== 8) return null;
  if (halves.length === 2 && head.length + tail.length > 7) return null;
  const groups = halves.length === 2 ? [...head, ...Array(8 - head.length - tail.length).fill("0"), ...tail] : head;
  let value = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    value = (value << 16n) | BigInt(parseInt(g, 16));
  }
  return value;
}

const groupsOf = (v: bigint) => Array.from({ length: 8 }, (_, i) => Number((v >> BigInt((7 - i) * 16)) & 0xffffn));
export const expandIPv6 = (v: bigint) => groupsOf(v).map((g) => g.toString(16).padStart(4, "0")).join(":");

/** RFC 5952の短縮表記（最長のゼロ連続を ::、同長なら先頭、1グループだけなら短縮しない） */
export function compressIPv6(v: bigint): string {
  const g = groupsOf(v);
  let best = { start: -1, len: 0 };
  for (let i = 0; i < 8; ) {
    if (g[i] !== 0) { i++; continue; }
    let j = i;
    while (j < 8 && g[j] === 0) j++;
    if (j - i > best.len) best = { start: i, len: j - i };
    i = j;
  }
  const hex = g.map((x) => x.toString(16));
  if (best.len < 2) return hex.join(":");
  return `${hex.slice(0, best.start).join(":")}::${hex.slice(best.start + best.len).join(":")}`;
}

export const reverseDnsIPv6 = (v: bigint) => expandIPv6(v).replace(/:/g, "").split("").reverse().join(".") + ".ip6.arpa";

export function classifyIPv6(v: bigint): string {
  const inPrefix = (prefix: bigint, bits: number) => v >> BigInt(128 - bits) === prefix >> BigInt(128 - bits);
  if (v === 0n) return "unspecified (::)";
  if (v === 1n) return "loopback (::1)";
  if (inPrefix(0xffffn << 32n, 96)) return "IPv4-mapped (::ffff:0:0/96)";
  if (inPrefix(0x20010db8n << 96n, 32)) return "documentation (2001:db8::/32)";
  if (inPrefix(0xfe80n << 112n, 10)) return "link-local (fe80::/10)";
  if (inPrefix(0xfc00n << 112n, 7)) return "unique local (fc00::/7)";
  if (inPrefix(0xffn << 120n, 8)) return "multicast (ff00::/8)";
  if (inPrefix(0x2n << 124n, 3)) return "global unicast (2000::/3)";
  return "other / reserved";
}

export type Ipv6Cidr = { network: bigint; first: bigint; last: bigint; prefix: number; total: bigint; slash64s: bigint };
export function parseIPv6Cidr(input: string): Ipv6Cidr | null {
  const [addr, p] = input.trim().split("/");
  const ip = parseIPv6(addr);
  const prefix = p === undefined ? 128 : /^\d+$/.test(p) ? Number(p) : NaN;
  if (ip === null || !(prefix >= 0 && prefix <= 128)) return null;
  const hostBits = BigInt(128 - prefix);
  const mask = ((1n << 128n) - 1n) ^ ((1n << hostBits) - 1n);
  const network = ip & mask;
  return { network, first: network, last: network | ((1n << hostBits) - 1n), prefix, total: 1n << hostBits, slash64s: prefix >= 64 ? 1n : 1n << BigInt(64 - prefix) };
}
