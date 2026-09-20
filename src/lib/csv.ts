export type CsvParseResult = {
  headers: string[];
  rows: string[][];
};

/** RFC4180準拠の簡易CSVパーサー（引用符・エスケープ・改行を含むフィールドに対応） */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function csvRowsToTable(
  rows: string[][],
  hasHeader: boolean
): CsvParseResult {
  if (rows.length === 0) return { headers: [], rows: [] };

  if (hasHeader) {
    const [headerRow, ...body] = rows;
    const headers = headerRow.map(
      (value, index) => value.trim() || `列${index + 1}`
    );
    return { headers, rows: body };
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  const headers = Array.from(
    { length: columnCount },
    (_, index) => `列${index + 1}`
  );
  return { headers, rows };
}

export function csvRowsToJson(
  rows: string[][],
  hasHeader: boolean
): unknown {
  if (rows.length === 0) return [];

  if (hasHeader) {
    const { headers, rows: body } = csvRowsToTable(rows, true);
    return body.map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((key, index) => {
        record[key] = row[index] ?? "";
      });
      return record;
    });
  }

  return rows;
}

export function toCsvField(value: unknown, delimiter: string): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** JSON値（オブジェクト配列 / 配列の配列 / 単一オブジェクト）をCSV文字列に変換する */
export function jsonValueToCsv(value: unknown, delimiter: string): string {
  const data = Array.isArray(value) ? value : [value];
  if (data.length === 0) return "";

  const isArrayOfObjects = data.every(
    (item) => item !== null && typeof item === "object" && !Array.isArray(item)
  );

  if (isArrayOfObjects) {
    const headers = Array.from(
      new Set(
        (data as Record<string, unknown>[]).flatMap((item) =>
          Object.keys(item)
        )
      )
    );
    const lines = [headers.map((h) => toCsvField(h, delimiter)).join(delimiter)];
    for (const item of data as Record<string, unknown>[]) {
      lines.push(
        headers.map((h) => toCsvField(item[h], delimiter)).join(delimiter)
      );
    }
    return lines.join("\r\n");
  }

  const isArrayOfArrays = data.every((item) => Array.isArray(item));
  if (isArrayOfArrays) {
    return (data as unknown[][])
      .map((row) => row.map((v) => toCsvField(v, delimiter)).join(delimiter))
      .join("\r\n");
  }

  // プリミティブ値の配列は1列のCSVとして扱う
  return data.map((v) => toCsvField(v, delimiter)).join("\r\n");
}

/** ヘッダー行とデータ行からCSV文字列を組み立てる */
export function tableToCsvText(
  headers: string[],
  rows: string[][],
  delimiter: string
): string {
  const lines = [headers.map((h) => toCsvField(h, delimiter)).join(delimiter)];
  for (const row of rows) {
    lines.push(row.map((v) => toCsvField(v, delimiter)).join(delimiter));
  }
  return lines.join("\r\n");
}
