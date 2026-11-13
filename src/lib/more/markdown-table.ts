export type Align = "left" | "center" | "right" | "none";
export type Grid = { header: string[]; rows: string[][]; align: Align[] };

const width = (s: string) => Array.from(s).reduce((n, c) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]|\p{Extended_Pictographic}/u.test(c) ? 2 : 1), 0);

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  const t = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "\\" && t[i + 1] === "|") { cur += "|"; i++; }
    else if (t[i] === "|") { cells.push(cur.trim()); cur = ""; }
    else cur += t[i];
  }
  cells.push(cur.trim());
  return cells;
}

const isSeparator = (cells: string[]) => cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c));

export function parseMarkdownTable(text: string): Grid | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const header = splitRow(lines[0]);
  const sep = splitRow(lines[1]);
  if (!isSeparator(sep)) return null;
  const align = header.map((_, i) => { const s = sep[i] ?? "---"; return s.startsWith(":") && s.endsWith(":") ? "center" : s.endsWith(":") ? "right" : s.startsWith(":") ? "left" : "none"; }) as Align[];
  const rows = lines.slice(2).map((l) => { const c = splitRow(l); return header.map((_, i) => c[i] ?? ""); });
  return { header, rows, align };
}

/** CSV / TSV を解析する。区切り文字は先頭行から推定し、ダブルクォートを扱う */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const d = delimiter ?? (first.includes("\t") ? "\t" : first.includes(";") && !first.includes(",") ? ";" : ",");
  const rows: string[][] = [];
  let row: string[] = [], cur = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else quoted = false; } else cur += c; }
    else if (c === '"' && !cur) quoted = true;
    else if (c === d) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ""));
}

export function gridFromRows(rows: string[][]): Grid {
  const n = Math.max(...rows.map((r) => r.length), 1);
  const fix = (r: string[]) => Array.from({ length: n }, (_, i) => r[i] ?? "");
  return { header: fix(rows[0] ?? []), rows: rows.slice(1).map(fix), align: Array(n).fill("none") };
}

export function formatMarkdownTable(g: Grid, align?: Align): string {
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
  const al = g.align.map((a) => (align && align !== "none" ? align : a));
  const cells = [g.header, ...g.rows].map((r) => r.map(esc));
  const w = g.header.map((_, i) => Math.max(3, ...cells.map((r) => width(r[i]))));
  const pad = (s: string, i: number) => { const gap = w[i] - width(s); return al[i] === "right" ? " ".repeat(gap) + s : al[i] === "center" ? " ".repeat(Math.floor(gap / 2)) + s + " ".repeat(Math.ceil(gap / 2)) : s + " ".repeat(gap); };
  const sep = (i: number) => (al[i] === "center" ? ":" + "-".repeat(w[i] - 2) + ":" : al[i] === "right" ? "-".repeat(w[i] - 1) + ":" : al[i] === "left" ? ":" + "-".repeat(w[i] - 1) : "-".repeat(w[i]));
  const line = (r: string[]) => `| ${r.map(pad).join(" | ")} |`;
  return [line(cells[0]), `| ${g.header.map((_, i) => sep(i)).join(" | ")} |`, ...cells.slice(1).map(line)].join("\n");
}

export function gridToDelimited(g: Grid, d: "," | "\t"): string {
  const esc = (s: string) => (d === "," && /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : d === "\t" ? s.replace(/[\t\n]/g, " ") : s);
  return [g.header, ...g.rows].map((r) => r.map(esc).join(d)).join("\n");
}
