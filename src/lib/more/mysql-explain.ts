import type { T } from "./types";

export type ExplainRow = Record<string, string>;
export type Warning = { level: "error" | "warn" | "info"; table: string; message: string };

/** EXPLAIN の出力（罫線付きの表・TSV・\G 形式・FORMAT=JSON）を行の配列にする */
export function parseExplain(text: string): ExplainRow[] {
  const src = text.trim();
  if (src.startsWith("{")) return parseJson(JSON.parse(src));
  if (/^\*+\s*\d+\.\s*row\s*\*+/im.test(src)) {
    return src.split(/^\*+\s*\d+\.\s*row\s*\*+$/im).map((b) => b.trim()).filter(Boolean).map((b) => Object.fromEntries(b.split(/\r?\n/).map((l) => { const i = l.indexOf(":"); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })));
  }
  const lines = src.split(/\r?\n/).filter((l) => l.trim() && !/^[+\-=\s|]+$/.test(l) || /^\|.*[A-Za-z]/.test(l));
  const grid = lines.filter((l) => !/^\+[-+]+\+$/.test(l.trim())).map((l) => (l.includes("|") ? l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()) : l.split("\t").map((c) => c.trim())));
  if (grid.length < 2) return [];
  const head = grid[0].map((h) => h.toLowerCase());
  return grid.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

function parseJson(j: unknown): ExplainRow[] {
  const rows: ExplainRow[] = [];
  const walk = (node: unknown, ctx: { filesort?: boolean; temp?: boolean }): void => {
    if (Array.isArray(node)) { node.forEach((n) => walk(n, ctx)); return; }
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    const next = { filesort: ctx.filesort || o.using_filesort === true, temp: ctx.temp || o.using_temporary_table === true };
    if (typeof o.table_name === "string") {
      rows.push({ id: "", select_type: "", table: o.table_name, type: String(o.access_type ?? ""), possible_keys: ((o.possible_keys as string[]) ?? []).join(","), key: String(o.key ?? "NULL"), key_len: String(o.key_length ?? ""), rows: String(o.rows_examined_per_scan ?? o.rows ?? ""), filtered: String(o.filtered ?? ""), extra: [next.filesort && "Using filesort", next.temp && "Using temporary", o.using_index === true && "Using index", o.attached_condition && "Using where", o.using_join_buffer && "Using join buffer"].filter(Boolean).join("; ") });
    }
    for (const v of Object.values(o)) if (typeof v === "object") walk(v, next);
  };
  walk(j, {});
  return rows;
}

export function analyzeExplain(rows: ExplainRow[], t: T): Warning[] {
  const w: Warning[] = [];
  const add = (level: Warning["level"], table: string, ja: string, en: string) => w.push({ level, table, message: t(ja, en) });
  for (const r of rows) {
    const table = r.table || "?", type = (r.type || "").toLowerCase(), key = r.key ?? "", extra = r.extra ?? "";
    const n = Number((r.rows || "").replace(/,/g, ""));
    if (type === "all") add(n > 10000 ? "error" : "warn", table, `type=ALL: テーブル全体を走査します${Number.isFinite(n) && n ? `（推定 ${n.toLocaleString()} 行）` : ""}。WHERE・JOINの列にインデックスを検討してください。`, `type=ALL: a full table scan${Number.isFinite(n) && n ? ` (about ${n.toLocaleString()} rows)` : ""}. Consider indexes on the WHERE and JOIN columns.`);
    if (type === "index") add("warn", table, "type=index: インデックス全体を走査しています（テーブルスキャンより軽いものの、行が多いと重くなります）。", "type=index: scans the whole index (cheaper than a table scan but slow for many rows).");
    if ((!key || /^null$/i.test(key)) && type !== "" && !/^(const|system)$/.test(type) && !/no matching row|impossible|optimized away/i.test(extra)) add("warn", table, "使用されたインデックス（key）がありません。", "No index (key) was used.");
    if (/filesort/i.test(extra)) add("warn", table, "Using filesort: ORDER BY をインデックスで満たせず、追加のソートが発生します。", "Using filesort: ORDER BY is not satisfied by an index, so an extra sort is needed.");
    if (/temporary/i.test(extra)) add("warn", table, "Using temporary: 一時テーブルを使っています（GROUP BY・DISTINCT・UNION など）。", "Using temporary: a temporary table is used (GROUP BY, DISTINCT, UNION, …).");
    if (/join buffer/i.test(extra)) add("warn", table, "Using join buffer: JOINにインデックスが使えていません。", "Using join buffer: the JOIN cannot use an index.");
    if (/impossible where/i.test(extra)) add("info", table, "Impossible WHERE: 条件が常に偽で、行は返りません。", "Impossible WHERE: the condition is always false so no rows are returned.");
    if (/using where/i.test(extra) && /^all$/i.test(type)) add("info", table, "Using where と type=ALL の組み合わせ: 全行を読んでから絞り込んでいます。", "Using where with type=ALL: every row is read and then filtered.");
    const f = Number(r.filtered);
    if (Number.isFinite(f) && r.filtered !== "" && f < 10 && n > 1000) add("info", table, `filtered=${f}%: 読み取った行の大半が捨てられます。`, `filtered=${f}%: most rows read are discarded.`);
  }
  const total = rows.reduce((p, r) => p * (Number((r.rows || "").replace(/,/g, "")) || 1), 1);
  if (rows.length > 1 && total > 1e7) add("warn", "-", `結合の推定行数の積が約 ${total.toExponential(1)} です（JOINの順序・インデックスを確認）。`, `The product of estimated rows across the join is about ${total.toExponential(1)} (check join order and indexes).`);
  if (!w.length && rows.length) add("info", "-", "目立った問題は見つかりませんでした。", "No obvious problems found.");
  return w;
}
