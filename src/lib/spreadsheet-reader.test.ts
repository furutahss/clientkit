import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { convert, convertAll, load, type OutputOptions } from "./spreadsheet-reader";
import type { TableOptions } from "./spreadsheet";

const table: TableOptions = {
  startRow: 2,
  removeEmptyRows: true,
  removeEmptyCols: false,
  mergeMode: "topLeft",
  dateMode: "iso",
  outputFormulas: false,
};

const csv: OutputOptions = {
  format: "csv",
  hasHeader: true,
  encoding: "utf8",
  delimiter: ",",
  quoteAll: false,
  newline: "\n",
};

function makeWorkbook(bookType: XLSX.BookType): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(
    [
      ["売上レポート"],
      ["日付", "商品", "数量", "単価", "合計"],
      [new Date(2026, 0, 31), "りんご〜", 3, 120],
      [new Date(2026, 1, 1), "みかん, 箱", 2, 300],
      [],
      ["区分A", null, 1, 1],
    ],
    { cellDates: true, dateNF: "yyyy/m/d" }
  );
  ws["E3"] = { t: "n", v: 360, f: "C3*D3" };
  ws["E4"] = { t: "n", v: 600, f: "C4*D4" };
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 1 } },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "売上");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["id", "name"], [1, "絵文字😀"]]), "マスタ");
  const out: Uint8Array = XLSX.write(wb, { bookType, type: "array" });
  return new Uint8Array(out).buffer;
}

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("spreadsheet-reader", () => {
  it.each(["xlsx", "ods", "biff8"] as const)("%s を読み込んでCSVに変換する", (bookType) => {
    const info = load(makeWorkbook(bookType));
    expect(info.map((sheet) => sheet.name)).toEqual(["売上", "マスタ"]);

    const result = convert(0, table, csv, 100);
    expect(result.text).toBe(
      [
        "日付,商品,数量,単価,合計",
        "2026-01-31,りんご〜,3,120,360",
        '2026-02-01,"みかん, 箱",2,300,600',
        "区分A,,1,1,",
        "",
      ].join("\n")
    );
    expect(result.rowCount).toBe(4);
  });

  it("数式・結合セル・日付形式のオプションを反映する", () => {
    load(makeWorkbook("xlsx"));
    const result = convert(
      0,
      { ...table, outputFormulas: true, mergeMode: "fill", dateMode: "serial" },
      { ...csv, format: "jsonArrays" },
      100
    );
    expect(JSON.parse(result.text)).toEqual([
      ["日付", "商品", "数量", "単価", "合計"],
      [46053, "りんご〜", 3, 120, "=C3*D3"],
      [46054, "みかん, 箱", 2, 300, "=C4*D4"],
      ["区分A", "区分A", 1, 1, null],
    ]);
  });

  it("BOM付きUTF-8・Shift_JISで出力する", () => {
    load(makeWorkbook("xlsx"));
    const bom = convert(1, table, { ...csv, encoding: "utf8bom" }, 0);
    expect(Array.from(bom.bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);

    const sjis = convert(1, { ...table, startRow: 1 }, { ...csv, encoding: "sjis" }, 0);
    expect(sjis.unencodable).toBe(1);
    expect(new TextDecoder("shift_jis").decode(sjis.bytes)).toBe("id,name\n1,絵文字?\n");
  });

  it("JSON（オブジェクトの配列）と全シートの一括変換", () => {
    load(makeWorkbook("xlsx"));
    const objects = JSON.parse(convert(1, { ...table, startRow: 1 }, { ...csv, format: "jsonObjects" }, 0).text);
    expect(objects).toEqual([{ id: 1, name: "絵文字😀" }]);

    const files = convertAll(table, csv);
    expect(files.map((file) => file.name)).toEqual(["売上.csv", "マスタ.csv"]);
    expect(decode(files[1].data)).toBe("1,絵文字😀\n");
  });

  it("壊れたファイルは例外になる", () => {
    expect(() => load(new TextEncoder().encode("PK\u0003\u0004broken").buffer)).toThrow();
  });
});
