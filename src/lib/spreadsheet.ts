/**
 * Excel等のスプレッドシートから取り出したセルを、CSV・JSONへ変換するための純粋関数群。
 * ファイルの解析（SheetJS）はWeb Worker側で行い、ここではライブラリに依存しない。
 */

export type SheetCell = {
  /** 値の種類（s: 文字列, n: 数値, b: 真偽値, e: エラー, d: 日付） */
  t: "s" | "n" | "b" | "e" | "d";
  v: string | number | boolean;
  /** 表示形式を適用した文字列 */
  w?: string;
  /** 数式（先頭の = なし） */
  f?: string;
  /** 日付の表示形式が設定された数値セル */
  date?: boolean;
};

export type SheetGrid = (SheetCell | null)[][];

export type SheetMerge = { s: { r: number; c: number }; e: { r: number; c: number } };

export type DateMode = "iso" | "formatted" | "serial";
export type MergeMode = "topLeft" | "fill";

export type TableOptions = {
  /** 開始行（1始まり。Excelの行番号） */
  startRow: number;
  removeEmptyRows: boolean;
  removeEmptyCols: boolean;
  mergeMode: MergeMode;
  dateMode: DateMode;
  /** trueの場合、数式セルは計算結果ではなく数式（=SUM(A1:A3) など）を出力する */
  outputFormulas: boolean;
};

export type TableValue = string | number | boolean | null;

export type CsvOptions = {
  delimiter: string;
  quoteAll: boolean;
  newline: "\r\n" | "\n";
};

const MS_PER_DAY = 86_400_000;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/**
 * Excelのシリアル値をISO 8601形式の文字列に変換する。
 * 1900年基準では、Excelが1900年をうるう年として扱う不具合（シリアル値60 = 1900/2/29）を再現する。
 * 時刻を含まない場合は日付のみ、1未満（時刻のみ）の場合は時刻のみを返す。
 */
export function excelSerialToIso(serial: number, date1904 = false): string {
  // 秒単位に丸めてから日付と時刻に分ける（浮動小数点の誤差で 23:59:59.999 になるのを防ぐ）
  const totalSeconds = Math.round(serial * 86_400);
  const days = Math.floor(totalSeconds / 86_400);
  const seconds = totalSeconds - days * 86_400;
  const msOfDay = seconds * 1000;
  const time = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;

  if (!date1904 && days === 0) return time;

  let date: string;
  if (!date1904 && days === 60) {
    date = "1900-02-29";
  } else {
    // 1900年基準: 1899-12-31 を0日目とし、61日目以降は存在しない2/29の分だけずらす
    const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, days < 60 ? 31 : 30);
    const d = new Date(epoch + days * MS_PER_DAY);
    date = `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  return msOfDay === 0 ? date : `${date}T${time}`;
}

/** セルを出力用の値に変換する */
export function cellToValue(
  cell: SheetCell | null,
  options: Pick<TableOptions, "dateMode" | "outputFormulas">,
  date1904 = false
): TableValue {
  if (!cell) return null;
  if (options.outputFormulas && cell.f) return `=${cell.f}`;
  if (cell.t === "e") return cell.w ?? String(cell.v);
  if (cell.t === "d") return cell.w ?? String(cell.v);
  if (cell.t === "n" && cell.date) {
    if (options.dateMode === "serial") return cell.v as number;
    if (options.dateMode === "formatted") return cell.w ?? String(cell.v);
    return excelSerialToIso(cell.v as number, date1904);
  }
  return cell.v;
}

function isEmpty(value: TableValue): boolean {
  return value === null || value === "";
}

/** 結合セルの範囲のうち、左上以外のセルに左上の値を複製した新しいグリッドを返す */
export function fillMergedCells(grid: SheetGrid, merges: SheetMerge[]): SheetGrid {
  const result = grid.map((row) => row.slice());
  for (const { s, e } of merges) {
    const origin = grid[s.r]?.[s.c] ?? null;
    if (!origin) continue;
    for (let r = s.r; r <= e.r; r++) {
      result[r] ??= [];
      for (let c = s.c; c <= e.c; c++) {
        if (r !== s.r || c !== s.c) result[r][c] = origin;
      }
    }
  }
  return result;
}

/** シートのグリッドを、オプションを適用した2次元配列に変換する */
export function buildTable(
  grid: SheetGrid,
  merges: SheetMerge[],
  options: TableOptions,
  date1904 = false
): TableValue[][] {
  const source = options.mergeMode === "fill" ? fillMergedCells(grid, merges) : grid;
  const start = Math.max(0, Math.floor(options.startRow) - 1);
  const width = source.reduce((max, row) => Math.max(max, row?.length ?? 0), 0);

  let rows: TableValue[][] = [];
  for (let r = start; r < source.length; r++) {
    const row = source[r] ?? [];
    const values: TableValue[] = [];
    for (let c = 0; c < width; c++) values.push(cellToValue(row[c] ?? null, options, date1904));
    rows.push(values);
  }

  if (options.removeEmptyRows) {
    rows = rows.filter((row) => row.some((value) => !isEmpty(value)));
  } else {
    // 末尾の空行は常に除く
    while (rows.length > 0 && rows[rows.length - 1].every(isEmpty)) rows.pop();
  }

  const usedCols: number[] = [];
  for (let c = 0; c < width; c++) {
    if (rows.some((row) => !isEmpty(row[c]))) usedCols.push(c);
  }
  if (options.removeEmptyCols) {
    rows = rows.map((row) => usedCols.map((c) => row[c]));
  } else {
    const lastCol = usedCols.length > 0 ? usedCols[usedCols.length - 1] + 1 : 0;
    rows = rows.map((row) => row.slice(0, lastCol));
  }
  return rows;
}

function valueToText(value: TableValue): string {
  return value === null ? "" : String(value);
}

/** 2次元配列をCSV文字列に変換する（RFC 4180） */
export function tableToCsv(rows: TableValue[][], options: CsvOptions): string {
  const needsQuote = new RegExp(`["\\r\\n${options.delimiter.replace(/[\\^$.*+?()[\]{}|-]/g, "\\$&")}]`);
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = valueToText(value);
          return options.quoteAll || needsQuote.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(options.delimiter)
    )
    .join(options.newline);
}

/** 1行目をヘッダーとして、空や重複のない列名の配列を作る */
export function makeHeaderKeys(headerRow: TableValue[], width: number): string[] {
  const used = new Set<string>();
  const keys: string[] = [];
  for (let c = 0; c < width; c++) {
    const base = valueToText(headerRow[c] ?? null).trim() || `column${c + 1}`;
    let key = base;
    for (let n = 2; used.has(key); n++) key = `${base}_${n}`;
    used.add(key);
    keys.push(key);
  }
  return keys;
}

/** オブジェクトの配列に変換する（hasHeaderがfalseの場合、キーは column1, column2, ...） */
export function tableToObjects(rows: TableValue[][], hasHeader = true): Record<string, TableValue>[] {
  if (rows.length === 0) return [];
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const keys = makeHeaderKeys(hasHeader ? rows[0] : [], width);
  return rows.slice(hasHeader ? 1 : 0).map((row) => Object.fromEntries(keys.map((key, c) => [key, row[c] ?? null])));
}

/** CP932にない文字のうち、見た目が同じ文字に置き換えられるもの（主にmacOSで入力される文字） */
const CP932_FALLBACK: Record<string, string> = {
  "\u301C": "\uFF5E", // 〜 → ～
  "\u2212": "\uFF0D", // − → －
  "\u2016": "\u2225", // ‖ → ∥
  "\u2014": "\u2015", // — → ―
  "\u00A2": "\uFFE0", // ¢ → ￠
  "\u00A3": "\uFFE1", // £ → ￡
  "\u00AC": "\uFFE2", // ¬ → ￢
};

/**
 * 文字コード表（文字 → コード）を使って文字列をエンコードする。
 * 表にない文字は「?」に置き換え、その数を返す。Shift_JIS（CP932）出力に使う。
 */
export function encodeWithTable(
  text: string,
  table: Record<string, number>
): { bytes: Uint8Array; unencodable: number } {
  const bytes: number[] = [];
  let unencodable = 0;
  for (const char of text) {
    let code = table[char] ?? table[CP932_FALLBACK[char] ?? ""];
    if (code === undefined) {
      unencodable += 1;
      code = 0x3f;
    }
    if (code > 0xff) bytes.push(code >> 8);
    bytes.push(code & 0xff);
  }
  return { bytes: Uint8Array.from(bytes), unencodable };
}

/** シート名をファイル名として使えるように整える */
export function sheetFileName(sheetName: string, extension: string): string {
  const safe = sheetName.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim() || "sheet";
  return `${safe}.${extension}`;
}
