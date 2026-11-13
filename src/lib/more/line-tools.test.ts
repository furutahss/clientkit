import { describe, expect, it } from "vitest";

import { runLineOp, type LineOptions } from "./line-tools";

const o: LineOptions = { ignoreCase: false, trim: false, prefix: "", suffix: "", separator: "", seed: 1, other: "" };
const run = (op: Parameters<typeof runLineOp>[0], text: string, extra: Partial<LineOptions> = {}) => runLineOp(op, text, { ...o, ...extra }).lines;

describe("行の操作", () => {
  it("並べ替え", () => {
    expect(run("sort", "b\na\nc")).toEqual(["a", "b", "c"]);
    expect(run("sort-desc", "b\na\nc")).toEqual(["c", "b", "a"]);
    expect(run("sort-natural", "file10\nfile2\nfile1")).toEqual(["file1", "file2", "file10"]);
    expect(run("sort-number", "10\n2\nx\n1,000")).toEqual(["2", "10", "1,000", "x"]);
    expect(run("sort-length", "ccc\na\nbb")).toEqual(["a", "bb", "ccc"]);
    expect(run("sort", "B\na", { ignoreCase: true })).toEqual(["a", "B"]);
  });

  it("重複の削除・抽出・集計", () => {
    expect(run("unique", "a\nb\na\nc\nb")).toEqual(["a", "b", "c"]);
    expect(run("unique", "A\na", { ignoreCase: true })).toEqual(["A"]);
    expect(run("duplicates", "a\nb\na\nc\nb\na")).toEqual(["a", "b"]);
    expect(run("count", "a\nb\na")).toEqual(["2\ta", "1\tb"]);
  });

  it("整形（連番・接頭辞・結合・空行除去）とシャッフルの再現性", () => {
    expect(run("number", "x\ny", { separator: ") " })).toEqual(["1) x", "2) y"]);
    expect(run("prefix-suffix", "a\nb", { prefix: "'", suffix: "'," })).toEqual(["'a',", "'b',"]);
    expect(run("join", "a\nb\nc", { separator: ", " })).toEqual(["a, b, c"]);
    expect(run("remove-empty", "a\n\n  \nb\n")).toEqual(["a", "b"]);
    expect(run("shuffle", "1\n2\n3\n4\n5", { seed: 7 })).toEqual(run("shuffle", "1\n2\n3\n4\n5", { seed: 7 }));
    expect(run("shuffle", "1\n2\n3\n4\n5", { seed: 7 }).sort()).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("集合演算（和・積・差・対称差）", () => {
    const a = "a\nb\nc", other = "b\nc\nd";
    expect(run("union", a, { other })).toEqual(["a", "b", "c", "d"]);
    expect(run("intersection", a, { other })).toEqual(["b", "c"]);
    expect(run("difference", a, { other })).toEqual(["a"]);
    expect(run("symmetric", a, { other })).toEqual(["a", "d"]);
  });
});
