/** UUID・ULID・Snowflake・MongoDB ObjectId から、バージョンや生成時刻を読み取る */

export type IdInfo = { type: string; details: [string, string][] };

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const TWITTER_EPOCH = 1288834974657n;
export const DISCORD_EPOCH = 1420070400000n;

const iso = (ms: number | bigint) => { const d = new Date(Number(ms)); return Number.isNaN(d.getTime()) ? "invalid" : d.toISOString(); };

export function inspectUuid(s: string): IdInfo | null {
  const m = /^\{?([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})\}?$/i.exec(s.trim());
  if (!m) return null;
  const [, a, b, c, d, e] = m.map((x) => x.toLowerCase());
  const version = parseInt(c[0], 16);
  const variantNibble = parseInt(d[0], 16);
  const variant = variantNibble < 8 ? "NCS (0xxx)" : variantNibble < 12 ? "RFC 4122 / 9562 (10xx)" : variantNibble < 14 ? "Microsoft (110x)" : "reserved (111x)";
  const details: [string, string][] = [["canonical", `${a}-${b}-${c}-${d}-${e}`], ["version", String(version)], ["variant", variant]];
  if (a + b + c + d + e === "0".repeat(32)) details.push(["note", "nil UUID"]);
  if (a + b + c + d + e === "f".repeat(32)) details.push(["note", "max UUID"]);
  if (version === 7) details.push(["timestamp (ms)", iso(parseInt(a + b, 16))]);
  if (version === 1 || version === 6) {
    // 100ナノ秒単位、1582-10-15 起点
    const ts = version === 1 ? BigInt("0x" + c.slice(1) + b + a) : BigInt("0x" + a + b + c.slice(1));
    details.push(["timestamp (100ns)", iso(Number(ts / 10000n) - 12219292800000)]);
    details.push(["node", e.replace(/(..)(?=.)/g, "$1:")]);
    details.push(["clock sequence", String(parseInt(d, 16) & 0x3fff)]);
  }
  if (version === 4) details.push(["note", "random (122 random bits)"]);
  if (version === 3 || version === 5) details.push(["note", `name-based (${version === 3 ? "MD5" : "SHA-1"})`]);
  return { type: "UUID", details };
}

export function inspectUlid(s: string): IdInfo | null {
  const t = s.trim().toUpperCase();
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(t) || t[0] > "7") return null;
  let ms = 0n;
  for (const c of t.slice(0, 10)) ms = ms * 32n + BigInt(CROCKFORD.indexOf(c));
  return { type: "ULID", details: [["timestamp (ms)", iso(ms)], ["randomness", t.slice(10)]] };
}

export function inspectObjectId(s: string): IdInfo | null {
  const t = s.trim().toLowerCase();
  if (!/^[0-9a-f]{24}$/.test(t)) return null;
  return { type: "MongoDB ObjectId", details: [["timestamp (s)", iso(parseInt(t.slice(0, 8), 16) * 1000)], ["random", t.slice(8, 18)], ["counter", String(parseInt(t.slice(18), 16))]] };
}

/** Snowflake形式（41bit時刻 | 5bit | 5bit | 12bitシーケンス）。epochは既定で Twitter / Discord の2通りを表示する */
export function inspectSnowflake(s: string, customEpoch?: bigint): IdInfo[] {
  const t = s.trim();
  if (!/^\d{15,20}$/.test(t)) return [];
  const id = BigInt(t);
  if (id >= 1n << 64n) return [];
  const common: [string, string][] = [["worker/datacenter (high 5 bits)", String((id >> 17n) & 31n)], ["worker/process (low 5 bits)", String((id >> 12n) & 31n)], ["sequence", String(id & 4095n)]];
  const epochs: [string, bigint][] = customEpoch !== undefined ? [["custom epoch", customEpoch]] : [["Twitter (X) epoch", TWITTER_EPOCH], ["Discord epoch", DISCORD_EPOCH]];
  return epochs.map(([name, epoch]) => ({ type: `Snowflake — ${name}`, details: [["timestamp", iso((id >> 22n) + epoch)], ...common] }));
}

export function inspectId(s: string, customEpoch?: bigint): IdInfo[] {
  const out: IdInfo[] = [];
  for (const f of [inspectUuid, inspectUlid, inspectObjectId]) { const r = f(s); if (r) out.push(r); }
  out.push(...inspectSnowflake(s, customEpoch));
  return out;
}
