import type { Table, ToolSpec } from "@/lib/more/types";

export const LEVEL: Record<string, string> = { error: "✖ error", warn: "▲ warn", info: "● info", ok: "✔ ok" };
const order = ["error", "warn", "info", "ok"];

/** 重大度順に並べた「レベル / 対象 / メッセージ」の表 */
export function findingsTable<T extends { level: string; message: string }>(items: T[], target: (i: T) => string, head: [string, string, string]): Table {
  const sorted = [...items].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
  return { head, rows: sorted.map((i) => [LEVEL[i.level] ?? i.level, target(i), i.message]) };
}

export const countNote = (t: (ja: string, en: string) => string, items: { level: string }[]) => {
  const n = (l: string) => items.filter((i) => i.level === l).length;
  return t(`エラー ${n("error")} 件 / 警告 ${n("warn")} 件`, `${n("error")} errors / ${n("warn")} warnings`);
};

export type Specs = Record<string, ToolSpec>;
