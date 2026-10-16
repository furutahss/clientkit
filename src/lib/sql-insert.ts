import { parseCsvTable, type CsvTableError } from "@/lib/csv";

/** PostgreSQL向けINSERT文の生成。値の型はCSVでは常に文字列、JSONでは値の型に従う */

export type SqlValue = string | number | boolean | null | { default: true };

export type SqlSourceTable = {
  columns: string[];
  rows: { label: string; values: Record<string, SqlValue | undefined> }[];
};

export type JsonSourceError =
  | { type: "jsonSyntax"; message: string }
  | { type: "jsonNotArray" }
  | { type: "jsonNotObject"; path: string }
  | { type: "jsonNested"; path: string }
  | { type: "jsonUnsafeNumber"; path: string };

/** CSV: 1行目をヘッダーとし、値はすべて文字列のまま保持する。emptyAsNull のときだけ空文字をNULLにする */
export function csvToSqlSource(
  text: string,
  delimiter: string,
  emptyAsNull: boolean
): { table?: SqlSourceTable; errors: CsvTableError[] } {
  const { table, errors } = parseCsvTable(text, delimiter);
  if (!table) return { errors };
  return {
    table: {
      columns: table.headers,
      rows: table.rows.map((row) => ({
        label: `#${row.record}`,
        values: Object.fromEntries(
          table.headers.map((column, index) => {
            const value = row.cells[index];
            return [column, emptyAsNull && value === "" ? null : value];
          })
        ),
      })),
    },
    errors,
  };
}

/** JSON: オブジェクトの配列。ネストした値や精度を失う数値はエラーにする */
export function jsonToSqlSource(text: string): { table?: SqlSourceTable; errors: JsonSourceError[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { errors: [{ type: "jsonSyntax", message: error instanceof Error ? error.message : String(error) }] };
  }
  if (!Array.isArray(parsed)) return { errors: [{ type: "jsonNotArray" }] };

  const errors: JsonSourceError[] = [];
  const columns: string[] = [];
  const seen = new Set<string>();
  const rows: SqlSourceTable["rows"] = [];

  parsed.forEach((item, index) => {
    const path = `$[${index}]`;
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      errors.push({ type: "jsonNotObject", path });
      return;
    }
    const values: Record<string, SqlValue> = {};
    for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
      const valuePath = `${path}[${JSON.stringify(key)}]`;
      if (value !== null && typeof value === "object") {
        errors.push({ type: "jsonNested", path: valuePath });
      } else if (typeof value === "number" && Number.isInteger(value) && !Number.isSafeInteger(value)) {
        errors.push({ type: "jsonUnsafeNumber", path: valuePath });
      } else {
        values[key] = value as SqlValue;
      }
    }
    rows.push({ label: path, values });
  });

  return errors.length > 0 ? { errors } : { table: { columns, rows }, errors };
}

export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** standard_conforming_strings = on（PostgreSQL 9.1以降の既定）を前提にした文字列リテラル */
export function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function formatSqlValue(value: SqlValue): string {
  if (value === null) return "NULL";
  if (typeof value === "object") return "DEFAULT";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  return quoteLiteral(value);
}

export type MissingKeyMode = "error" | "null" | "default";

export type InsertOptions = {
  schema: string;
  table: string;
  columns: string[];
  missing: MissingKeyMode;
  rowsPerStatement: number;
};

export type InsertError =
  | { type: "tableRequired" }
  | { type: "noColumns" }
  | { type: "nulCharacter"; where: string }
  | { type: "missingKey"; row: string; column: string };

export function buildInsertSql(
  source: SqlSourceTable,
  options: InsertOptions
): { sql?: string; errors: InsertError[]; stats: { rows: number; nulls: number; quotesEscaped: number } } {
  const errors: InsertError[] = [];
  const stats = { rows: source.rows.length, nulls: 0, quotesEscaped: 0 };
  if (options.table.trim() === "") errors.push({ type: "tableRequired" });
  if (options.columns.length === 0) errors.push({ type: "noColumns" });
  for (const name of [options.schema, options.table, ...options.columns]) {
    if (name.includes("\0")) errors.push({ type: "nulCharacter", where: name });
  }

  const tuples: string[] = [];
  for (const row of source.rows) {
    const cells: string[] = [];
    for (const column of options.columns) {
      let value = row.values[column];
      if (value === undefined) {
        if (options.missing === "error") {
          errors.push({ type: "missingKey", row: row.label, column });
          continue;
        }
        value = options.missing === "null" ? null : { default: true };
      }
      if (value === null) stats.nulls += 1;
      if (typeof value === "string") {
        if (value.includes("\0")) errors.push({ type: "nulCharacter", where: `${row.label} ${column}` });
        if (value.includes("'")) stats.quotesEscaped += 1;
      }
      cells.push(formatSqlValue(value));
    }
    tuples.push(`(${cells.join(", ")})`);
  }
  if (errors.length > 0) return { errors, stats };

  const target = options.schema.trim()
    ? `${quoteIdentifier(options.schema)}.${quoteIdentifier(options.table)}`
    : quoteIdentifier(options.table);
  const head = `INSERT INTO ${target} (${options.columns.map(quoteIdentifier).join(", ")}) VALUES`;
  const statements: string[] = [];
  const size = Math.max(1, options.rowsPerStatement);
  for (let i = 0; i < tuples.length; i += size) {
    const chunk = tuples.slice(i, i + size);
    statements.push(chunk.length === 1 ? `${head} ${chunk[0]};` : `${head}\n  ${chunk.join(",\n  ")};`);
  }
  return { sql: statements.join("\n"), errors, stats };
}
