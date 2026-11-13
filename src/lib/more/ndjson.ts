export type LogRow = { line: number; data: Record<string, unknown> };

const LEVEL_KEYS = ["level", "severity", "lvl", "log.level", "levelname"];
const TIME_KEYS = ["time", "timestamp", "ts", "@timestamp", "t", "datetime", "date"];
const MSG_KEYS = ["msg", "message", "event", "text"];

export const pickKey = (keys: string[], candidates: string[]) => candidates.find((c) => keys.includes(c));

const flat = (v: unknown, prefix = "", out: Record<string, unknown> = {}, depth = 0): Record<string, unknown> => {
  if (v !== null && typeof v === "object" && !Array.isArray(v) && depth < 3) for (const [k, x] of Object.entries(v)) flat(x, prefix ? `${prefix}.${k}` : k, out, depth + 1);
  else out[prefix] = v;
  return out;
};

/** NDJSON / JSON Lines（構造化ログ）を解析する。ネストしたキーは a.b の形に平坦化する */
export function parseNdjson(text: string): { rows: LogRow[]; errors: { line: number; message: string }[]; keys: string[] } {
  const rows: LogRow[] = [];
  const errors: { line: number; message: string }[] = [];
  const keys = new Set<string>();
  text.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    try {
      const v = JSON.parse(raw);
      const data = v !== null && typeof v === "object" && !Array.isArray(v) ? flat(v) : { value: v };
      Object.keys(data).forEach((k) => keys.add(k));
      rows.push({ line: i + 1, data });
    } catch (e) { errors.push({ line: i + 1, message: (e as Error).message }); }
  });
  return { rows, errors, keys: [...keys] };
}

const levelRank = (v: unknown): number => {
  const s = String(v).toLowerCase();
  if (/fatal|crit|panic|emerg|alert/.test(s) || s === "60" || s === "50") return 5;
  if (/err/.test(s) || s === "40") return 4;
  if (/warn/.test(s) || s === "30") return 3;
  if (/info|notice/.test(s) || s === "20") return 2;
  if (/debug/.test(s) || s === "10") return 1;
  if (/trace|verbose/.test(s)) return 0;
  return -1;
};

export type NdjsonQuery = { text: string; minLevel: number; field: string; limit: number };

export function filterRows(rows: LogRow[], keys: string[], q: NdjsonQuery): LogRow[] {
  const levelKey = pickKey(keys, LEVEL_KEYS);
  const timeKey = pickKey(keys, TIME_KEYS);
  const [fk, ...fv] = q.field.split("=");
  const needle = q.text.toLowerCase();
  let out = rows.filter((r) => {
    if (q.minLevel > 0 && levelKey && levelRank(r.data[levelKey]) < q.minLevel) return false;
    if (fk && fv.length && String(r.data[fk.trim()] ?? "") !== fv.join("=").trim()) return false;
    if (needle && !JSON.stringify(r.data).toLowerCase().includes(needle)) return false;
    return true;
  });
  if (timeKey) out = [...out].sort((a, b) => String(a.data[timeKey]).localeCompare(String(b.data[timeKey])) || a.line - b.line);
  return out.slice(0, q.limit);
}

export function defaultColumns(keys: string[]): string[] {
  const picked = [pickKey(keys, TIME_KEYS), pickKey(keys, LEVEL_KEYS), pickKey(keys, MSG_KEYS)].filter((x): x is string => !!x);
  return [...picked, ...keys.filter((k) => !picked.includes(k)).slice(0, Math.max(0, 5 - picked.length))];
}

export function levelCounts(rows: LogRow[], keys: string[]): [string, number][] {
  const k = pickKey(keys, LEVEL_KEYS);
  if (!k) return [];
  const m = new Map<string, number>();
  for (const r of rows) m.set(String(r.data[k]), (m.get(String(r.data[k])) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
export const LEVELS = { any: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 } as const;
