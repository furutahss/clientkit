import { describe, expect, it } from "vitest";

import { formatMarkdownTable, gridFromRows, gridToDelimited, parseDelimited, parseMarkdownTable } from "./markdown-table";

describe("Markdown表", () => {
  it("CSVから整形されたMarkdown表を作る（全角は2幅、|はエスケープ）", () => {
    const g = gridFromRows(parseDelimited('名前,メモ\n"Alice, A",a|b\n太郎,x'));
    expect(formatMarkdownTable(g)).toBe(["| 名前     | メモ |", "| -------- | ---- |", "| Alice, A | a\\|b |", "| 太郎     | x    |"].join("\n"));
  });

  it("配置を指定・保持する", () => {
    const g = gridFromRows(parseDelimited("a,b\n1,2"));
    expect(formatMarkdownTable(g, "right")).toBe("|   a |   b |\n| --: | --: |\n|   1 |   2 |");
    expect(parseMarkdownTable("| a | b |\n|:--|--:|\n| 1 | 2 |")?.align).toEqual(["left", "right"]);
    expect(formatMarkdownTable(parseMarkdownTable("| a | b |\n|:-:|---|\n| 1 | 2 |")!)).toContain(":-:");
  });

  it("Markdown表をCSV・TSVに戻す", () => {
    const g = parseMarkdownTable("| a | b |\n| --- | --- |\n| x \\| y | \"q\" |")!;
    expect(gridToDelimited(g, ",")).toBe('a,b\nx | y,"""q"""');
    expect(gridToDelimited(g, "\t")).toBe('a\tb\nx | y\t"""q"""');
    expect(parseMarkdownTable("not a table")).toBeNull();
  });

  it("TSVや引用符内の改行・セミコロン区切りを解析する", () => {
    expect(parseDelimited("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseDelimited('a;b\n"x\ny";2')).toEqual([["a", "b"], ["x\ny", "2"]]);
  });

  it("Excelからのコピー（引用符付きのセル内改行、末尾のCRLF）とMarkdown→Excelの往復", () => {
    const excel = '項目\t備考\r\n"1行目\n2行目"\tA, B\r\n';
    const md = formatMarkdownTable(gridFromRows(parseDelimited(excel)));
    expect(md).toBe(["| 項目           | 備考 |", "| -------------- | ---- |", "| 1行目<br>2行目 | A, B |"].join("\n"));
    expect(gridToDelimited(parseMarkdownTable(md)!, "\t")).toBe('項目\t備考\n"1行目\n2行目"\tA, B');
  });
});
