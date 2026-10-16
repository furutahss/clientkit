import { tableToCsvText, type CsvTable } from "@/lib/csv";

export type KeyIssue = { side: "left" | "right"; type: "duplicate" | "empty"; key: string; records: number[] };

export type CellChange = { column: string; before: string; after: string };

export type ReconcileResult = {
  commonColumns: string[];
  leftOnlyColumns: string[];
  rightOnlyColumns: string[];
  added: { key: string; record: number; values: Record<string, string> }[];
  removed: { key: string; record: number; values: Record<string, string> }[];
  updated: { key: string; leftRecord: number; rightRecord: number; changes: CellChange[] }[];
  unchanged: number;
};

function indexByKey(table: CsvTable, keyColumn: string, side: KeyIssue["side"], issues: KeyIssue[]) {
  const keyIndex = table.headers.indexOf(keyColumn);
  const byKey = new Map<string, CsvTable["rows"][number]>();
  const recordsByKey = new Map<string, number[]>();
  const empty: number[] = [];
  for (const row of table.rows) {
    const key = row.cells[keyIndex];
    if (key === "") {
      empty.push(row.record);
      continue;
    }
    recordsByKey.set(key, [...(recordsByKey.get(key) ?? []), row.record]);
    byKey.set(key, row);
  }
  if (empty.length > 0) issues.push({ side, type: "empty", key: "", records: empty });
  for (const [key, records] of recordsByKey) {
    if (records.length > 1) issues.push({ side, type: "duplicate", key, records });
  }
  return byKey;
}

function rowValues(table: CsvTable, cells: string[]): Record<string, string> {
  return Object.fromEntries(table.headers.map((column, index) => [column, cells[index]]));
}

/** キー列で2つのCSVを突合する。キーに重複・空がある場合は突合せずに問題箇所を返す */
export function reconcileCsv(
  left: CsvTable,
  right: CsvTable,
  keyColumn: string
): { result?: ReconcileResult; keyIssues: KeyIssue[] } {
  const keyIssues: KeyIssue[] = [];
  const leftByKey = indexByKey(left, keyColumn, "left", keyIssues);
  const rightByKey = indexByKey(right, keyColumn, "right", keyIssues);
  if (keyIssues.length > 0) return { keyIssues };

  const commonColumns = left.headers.filter((column) => right.headers.includes(column));
  const result: ReconcileResult = {
    commonColumns,
    leftOnlyColumns: left.headers.filter((column) => !right.headers.includes(column)),
    rightOnlyColumns: right.headers.filter((column) => !left.headers.includes(column)),
    added: [],
    removed: [],
    updated: [],
    unchanged: 0,
  };

  for (const [key, row] of leftByKey) {
    const other = rightByKey.get(key);
    if (!other) {
      result.removed.push({ key, record: row.record, values: rowValues(left, row.cells) });
      continue;
    }
    const changes: CellChange[] = [];
    for (const column of commonColumns) {
      const before = row.cells[left.headers.indexOf(column)];
      const after = other.cells[right.headers.indexOf(column)];
      if (before !== after) changes.push({ column, before, after });
    }
    if (changes.length > 0) {
      result.updated.push({ key, leftRecord: row.record, rightRecord: other.record, changes });
    } else {
      result.unchanged += 1;
    }
  }
  for (const [key, row] of rightByKey) {
    if (!leftByKey.has(key)) {
      result.added.push({ key, record: row.record, values: rowValues(right, row.cells) });
    }
  }
  return { result, keyIssues };
}

/** 差分を「種別・キー・列・変更前・変更後」の縦持ちCSVにする */
export function reconcileResultToCsv(result: ReconcileResult, keyColumn: string, delimiter: string): string {
  const rows: string[][] = [];
  for (const row of result.removed) {
    for (const [column, value] of Object.entries(row.values)) rows.push(["removed", row.key, column, value, ""]);
  }
  for (const row of result.added) {
    for (const [column, value] of Object.entries(row.values)) rows.push(["added", row.key, column, "", value]);
  }
  for (const row of result.updated) {
    for (const change of row.changes) rows.push(["updated", row.key, change.column, change.before, change.after]);
  }
  return tableToCsvText(["diff_type", keyColumn, "column", "before", "after"], rows, delimiter);
}
