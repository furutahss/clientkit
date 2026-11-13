export type LineOp = "sort" | "sort-desc" | "sort-natural" | "sort-number" | "sort-length" | "unique" | "duplicates" | "count" | "reverse" | "shuffle" | "trim" | "remove-empty" | "number" | "prefix-suffix" | "join" | "union" | "intersection" | "difference" | "symmetric";

export const LINE_OPS: LineOp[] = ["sort", "sort-desc", "sort-natural", "sort-number", "sort-length", "unique", "duplicates", "count", "reverse", "shuffle", "trim", "remove-empty", "number", "prefix-suffix", "join", "union", "intersection", "difference", "symmetric"];
export const SET_OPS: LineOp[] = ["union", "intersection", "difference", "symmetric"];

const lines = (s: string) => (s === "" ? [] : s.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n"));

function mulberry(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export type LineOptions = { ignoreCase: boolean; trim: boolean; prefix: string; suffix: string; separator: string; seed: number; other: string };

export function runLineOp(op: LineOp, text: string, o: LineOptions): { lines: string[]; info?: string } {
  let ls = lines(text);
  const key = (s: string) => { let k = o.trim ? s.trim() : s; if (o.ignoreCase) k = k.toLowerCase(); return k; };
  switch (op) {
    case "sort": return { lines: [...ls].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0)) };
    case "sort-desc": return { lines: [...ls].sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0)) };
    case "sort-natural": return { lines: [...ls].sort((a, b) => key(a).localeCompare(key(b), undefined, { numeric: true, sensitivity: o.ignoreCase ? "base" : "variant" })) };
    case "sort-number": return { lines: [...ls].sort((a, b) => { const x = parseFloat(a.replace(/,/g, "")), y = parseFloat(b.replace(/,/g, "")); return (Number.isNaN(x) ? Infinity : x) - (Number.isNaN(y) ? Infinity : y); }), info: "Lines that are not numbers go last." };
    case "sort-length": return { lines: [...ls].sort((a, b) => Array.from(a).length - Array.from(b).length) };
    case "unique": { const seen = new Set<string>(); const out = ls.filter((l) => { const k = key(l); if (seen.has(k)) return false; seen.add(k); return true; }); return { lines: out, info: `${ls.length - out.length}` }; }
    case "duplicates": { const c = new Map<string, number>(); ls.forEach((l) => c.set(key(l), (c.get(key(l)) ?? 0) + 1)); const seen = new Set<string>(); return { lines: ls.filter((l) => { const k = key(l); if ((c.get(k) ?? 0) < 2 || seen.has(k)) return false; seen.add(k); return true; }) }; }
    case "count": { const c = new Map<string, { n: number; first: string }>(); for (const l of ls) { const k = key(l); const e = c.get(k); if (e) e.n++; else c.set(k, { n: 1, first: l }); } return { lines: [...c.values()].sort((a, b) => b.n - a.n).map((e) => `${e.n}\t${e.first}`) }; }
    case "reverse": return { lines: [...ls].reverse() };
    case "shuffle": { const r = mulberry(o.seed); const a = [...ls]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return { lines: a }; }
    case "trim": return { lines: ls.map((l) => l.trim()) };
    case "remove-empty": return { lines: ls.filter((l) => l.trim() !== "") };
    case "number": return { lines: ls.map((l, i) => `${i + 1}${o.separator || ". "}${l}`) };
    case "prefix-suffix": return { lines: ls.map((l) => `${o.prefix}${l}${o.suffix}`) };
    case "join": return { lines: [ls.join(o.separator)] };
    default: {
      const other = lines(o.other);
      const a = new Map<string, string>(), b = new Map<string, string>();
      ls.forEach((l) => !a.has(key(l)) && a.set(key(l), l));
      other.forEach((l) => !b.has(key(l)) && b.set(key(l), l));
      ls = [];
      if (op === "union") ls = [...a.values(), ...[...b].filter(([k]) => !a.has(k)).map(([, v]) => v)];
      else if (op === "intersection") ls = [...a].filter(([k]) => b.has(k)).map(([, v]) => v);
      else if (op === "difference") ls = [...a].filter(([k]) => !b.has(k)).map(([, v]) => v);
      else ls = [...[...a].filter(([k]) => !b.has(k)), ...[...b].filter(([k]) => !a.has(k))].map(([, v]) => v);
      return { lines: ls };
    }
  }
}
