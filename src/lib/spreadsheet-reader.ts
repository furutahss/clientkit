/**
 * SheetJSでExcel・ODSファイルを解析し、CSV・JSONに変換する処理。
 * Web Worker（spreadsheet.worker.ts）から呼び出され、解析結果のブックはWorker内に保持する。
 */
import * as XLSX from "xlsx";
import * as cpexcel from "xlsx/dist/cpexcel.full.mjs";

import {
  buildTable,
  encodeWithTable,
  sheetFileName,
  tableToCsv,
  tableToObjects,
  type CsvOptions,
  type SheetCell,
  type SheetGrid,
  type SheetMerge,
  type TableOptions,
  type TableValue,
} from "@/lib/spreadsheet";

export type OutputFormat = "csv" | "jsonObjects" | "jsonArrays";
export type CsvEncoding = "utf8" | "utf8bom" | "sjis";

export type OutputOptions = CsvOptions & {
  format: OutputFormat;
  hasHeader: boolean;
  encoding: CsvEncoding;
};

export type SheetInfo = { name: string; rows: number; cols: number };

export type SpreadsheetRequest =
  | { id: number; type: "load"; data: ArrayBuffer }
  | { id: number; type: "convert"; sheet: number; table: TableOptions; output: OutputOptions; previewRows: number }
  | { id: number; type: "convertAll"; table: TableOptions; output: OutputOptions };

export type ConvertResult = {
  preview: TableValue[][];
  rowCount: number;
  text: string;
  bytes: Uint8Array;
  unencodable: number;
};

XLSX.set_cptable(cpexcel);


export type ParsedSheet = { name: string; grid: SheetGrid; merges: SheetMerge[] };
let sheets: ParsedSheet[] = [];
let date1904 = false;

function toGrid(sheet: XLSX.WorkSheet): SheetGrid {
  const data = (sheet["!data"] ?? []) as (XLSX.CellObject[] | undefined)[];
  const grid: SheetGrid = [];
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) {
      grid.push([]);
      continue;
    }
    const cells: (SheetCell | null)[] = [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell || cell.t === "z" || cell.v === undefined) {
        cells.push(null);
        continue;
      }
      const isDate = cell.t === "n" && typeof cell.z === "string" && XLSX.SSF.is_date(cell.z);
      cells.push({
        t: cell.t,
        v: cell.v instanceof Date ? cell.v.toISOString() : cell.v,
        w: cell.w,
        f: cell.f,
        date: isDate || undefined,
      });
    }
    grid.push(cells);
  }
  return grid;
}

export function load(data: ArrayBuffer): SheetInfo[] {
  const workbook = XLSX.read(data, { type: "array", dense: true, cellFormula: true, cellNF: true, cellDates: false });
  date1904 = !!workbook.Workbook?.WBProps?.date1904;
  sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    return { name, grid: toGrid(sheet), merges: (sheet["!merges"] ?? []) as SheetMerge[] };
  });
  return sheets.map(({ name, grid }) => ({
    name,
    rows: grid.length,
    cols: grid.reduce((max, row) => Math.max(max, row.length), 0),
  }));
}

function encode(text: string, output: OutputOptions): { bytes: Uint8Array; unencodable: number } {
  if (output.format === "csv" && output.encoding === "sjis") {
    return encodeWithTable(text, cpexcel.cptable[932].enc);
  }
  const prefix = output.format === "csv" && output.encoding === "utf8bom" ? "\uFEFF" : "";
  return { bytes: new TextEncoder().encode(prefix + text), unencodable: 0 };
}

function convertSheet(sheet: ParsedSheet, table: TableOptions, output: OutputOptions, previewRows: number): ConvertResult {
  const rows = buildTable(sheet.grid, sheet.merges, table, date1904);
  let text: string;
  if (output.format === "csv") {
    text = tableToCsv(rows, output) + (rows.length > 0 ? output.newline : "");
  } else if (output.format === "jsonObjects") {
    text = JSON.stringify(tableToObjects(rows, output.hasHeader), null, 2);
  } else {
    text = JSON.stringify(rows, null, 2);
  }
  return { preview: rows.slice(0, previewRows), rowCount: rows.length, text, ...encode(text, output) };
}

/** 読み込み済みのシートを変換する */
export function convert(index: number, table: TableOptions, output: OutputOptions, previewRows: number): ConvertResult {
  return convertSheet(sheets[index], table, output, previewRows);
}

/** 読み込み済みのすべてのシートを変換し、ファイル名とバイト列の一覧を返す */
export function convertAll(table: TableOptions, output: OutputOptions): { name: string; data: Uint8Array }[] {
  const extension = output.format === "csv" ? "csv" : "json";
  return sheets.map((sheet) => ({
    name: sheetFileName(sheet.name, extension),
    data: convertSheet(sheet, table, output, 0).bytes,
  }));
}
