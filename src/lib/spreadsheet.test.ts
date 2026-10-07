import { describe, expect, it } from "vitest";

import {
  buildTable,
  cellToValue,
  encodeWithTable,
  excelSerialToIso,
  fillMergedCells,
  makeHeaderKeys,
  sheetFileName,
  tableToCsv,
  tableToObjects,
  type SheetCell,
  type SheetGrid,
  type TableOptions,
} from "./spreadsheet";

const s = (v: string): SheetCell => ({ t: "s", v });
const n = (v: number, extra: Partial<SheetCell> = {}): SheetCell => ({ t: "n", v, ...extra });

const baseOptions: TableOptions = {
  startRow: 1,
  removeEmptyRows: false,
  removeEmptyCols: false,
  mergeMode: "topLeft",
  dateMode: "iso",
  outputFormulas: false,
};

describe("excelSerialToIso", () => {
  it("1900年基準の日付を変換する", () => {
    expect(excelSerialToIso(1)).toBe("1900-01-01");
    expect(excelSerialToIso(59)).toBe("1900-02-28");
    expect(excelSerialToIso(60)).toBe("1900-02-29");
    expect(excelSerialToIso(61)).toBe("1900-03-01");
    expect(excelSerialToIso(45000)).toBe("2023-03-15");
    expect(excelSerialToIso(46023)).toBe("2026-01-01");
  });

  it("時刻を含む値と時刻のみの値を変換する", () => {
    expect(excelSerialToIso(45000.5)).toBe("2023-03-15T12:00:00");
    expect(excelSerialToIso(0.75)).toBe("18:00:00");
    // 浮動小数点の誤差で 23:59:59.999 にならないこと
    expect(excelSerialToIso(45000 + 1 / 3)).toBe("2023-03-15T08:00:00");
    expect(excelSerialToIso(44999.99999999)).toBe("2023-03-15");
  });

  it("1904年基準に対応する", () => {
    expect(excelSerialToIso(0, true)).toBe("1904-01-01");
    expect(excelSerialToIso(43538, true)).toBe("2023-03-15");
  });
});

describe("cellToValue", () => {
  const date = n(45000, { date: true, w: "2023/3/15" });

  it("日付セルを指定の形式で出力する", () => {
    expect(cellToValue(date, { dateMode: "iso", outputFormulas: false })).toBe("2023-03-15");
    expect(cellToValue(date, { dateMode: "formatted", outputFormulas: false })).toBe("2023/3/15");
    expect(cellToValue(date, { dateMode: "serial", outputFormulas: false })).toBe(45000);
  });

  it("数式セルは既定で計算結果、オプションで数式を出力する", () => {
    const cell = n(6, { f: "SUM(A1:A3)" });
    expect(cellToValue(cell, { dateMode: "iso", outputFormulas: false })).toBe(6);
    expect(cellToValue(cell, { dateMode: "iso", outputFormulas: true })).toBe("=SUM(A1:A3)");
  });

  it("エラーセルは表示文字列を出力する", () => {
    expect(cellToValue({ t: "e", v: 7, w: "#DIV/0!" }, { dateMode: "iso", outputFormulas: false })).toBe("#DIV/0!");
  });
});

describe("fillMergedCells / buildTable", () => {
  const grid: SheetGrid = [
    [s("区分"), null, s("値")],
    [s("A"), s("x"), n(1)],
    [null, s("y"), n(2)],
  ];
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
  ];

  it("結合セルを展開する", () => {
    const filled = fillMergedCells(grid, merges);
    expect(filled[0][1]).toEqual(s("区分"));
    expect(filled[2][0]).toEqual(s("A"));
    expect(grid[2][0]).toBeNull();
  });

  it("結合セルの扱いを切り替えられる", () => {
    expect(buildTable(grid, merges, baseOptions)[2]).toEqual([null, "y", 2]);
    expect(buildTable(grid, merges, { ...baseOptions, mergeMode: "fill" })[2]).toEqual(["A", "y", 2]);
  });

  it("開始行・空行・空列を処理する", () => {
    const sparse: SheetGrid = [
      [s("title")],
      [null, s("a"), null, s("b")],
      [],
      [null, n(1), null, n(2)],
      [],
    ];
    expect(buildTable(sparse, [], { ...baseOptions, startRow: 2 })).toEqual([
      [null, "a", null, "b"],
      [null, null, null, null],
      [null, 1, null, 2],
    ]);
    expect(
      buildTable(sparse, [], { ...baseOptions, startRow: 2, removeEmptyRows: true, removeEmptyCols: true })
    ).toEqual([
      ["a", "b"],
      [1, 2],
    ]);
  });
});

describe("tableToCsv", () => {
  it("必要な場合だけ引用符で囲む", () => {
    const rows = [
      ["a,b", 'say "hi"', "line\nbreak", "plain", null, 1.5, true],
    ];
    expect(tableToCsv(rows, { delimiter: ",", quoteAll: false, newline: "\n" })).toBe(
      '"a,b","say ""hi""","line\nbreak",plain,,1.5,true'
    );
  });

  it("区切り文字・改行コード・全引用に対応する", () => {
    const rows = [
      ["a", "b;c"],
      ["1", "2"],
    ];
    expect(tableToCsv(rows, { delimiter: ";", quoteAll: false, newline: "\r\n" })).toBe('a;"b;c"\r\n1;2');
    expect(tableToCsv(rows, { delimiter: "\t", quoteAll: true, newline: "\n" })).toBe('"a"\t"b;c"\n"1"\t"2"');
  });
});

describe("JSON変換", () => {
  it("空や重複した列名を補う", () => {
    expect(makeHeaderKeys(["名前", "", "名前", null], 5)).toEqual(["名前", "column2", "名前_2", "column4", "column5"]);
  });

  it("オブジェクトの配列に変換する", () => {
    expect(
      tableToObjects([
        ["name", "age"],
        ["田中", 30],
        ["鈴木"],
      ])
    ).toEqual([
      { name: "田中", age: 30 },
      { name: "鈴木", age: null },
    ]);
    expect(tableToObjects([["a", 1]], false)).toEqual([{ column1: "a", column2: 1 }]);
  });
});

describe("その他", () => {
  it("文字コード表でエンコードし、表にない文字を数える", () => {
    const table = { a: 0x61, "?": 0x3f, 日: 0x93fa, "～": 0x8160 };
    const result = encodeWithTable("a日😀〜?", table);
    expect(Array.from(result.bytes)).toEqual([0x61, 0x93, 0xfa, 0x3f, 0x81, 0x60, 0x3f]);
    expect(result.unencodable).toBe(1);
  });

  it("シート名をファイル名に変換する", () => {
    expect(sheetFileName("売上/2026:Q1", "csv")).toBe("売上_2026_Q1.csv");
    expect(sheetFileName("  ", "csv")).toBe("sheet.csv");
  });
});
