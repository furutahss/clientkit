import { describe, expect, it } from "vitest";

import { checkPaths, parseGitignore } from "./gitignore";

function check(rules: string, paths: string[]) {
  return checkPaths(parseGitignore(rules), paths).map((result) =>
    result.status === "invalidPath" ? "invalid" : `${result.ignored ? "ignored" : "kept"}:${result.rule?.line ?? "-"}`
  );
}

describe(".gitignore判定", () => {
  it("ワイルドカードと後続の否定ルールによる上書き", () => {
    const rules = "*.log\n!important.log\n";
    expect(check(rules, ["debug.log", "logs/app.log", "important.log", "a.txt"])).toEqual([
      "ignored:1",
      "ignored:1",
      "kept:2",
      "kept:-",
    ]);
  });

  it("後のルールが優先される", () => {
    expect(check("!keep.txt\n*.txt\n", ["keep.txt"])).toEqual(["ignored:2"]);
  });

  it("ディレクトリ指定（末尾の/）はディレクトリとその中だけに一致する", () => {
    expect(check("build/\n", ["build/", "build", "build/app.js", "src/build/x.js"])).toEqual([
      "ignored:1",
      "kept:-",
      "ignored:1",
      "ignored:1",
    ]);
  });

  it("親ディレクトリが除外されると、中のファイルは否定ルールで戻せない", () => {
    const [result] = checkPaths(parseGitignore("dist/\n!dist/keep.json\n"), ["dist/keep.json"]);
    expect(result).toMatchObject({ ignored: true, excludedParent: "dist", rule: { line: 1 }, ineffectiveNegation: { line: 2 } });
  });

  it("/** で中身だけを除外すれば否定ルールで戻せる", () => {
    expect(check("dist/**\n!dist/keep.json\n", ["dist/keep.json", "dist/a.js", "dist/"])).toEqual([
      "kept:2",
      "ignored:1",
      "kept:-",
    ]);
  });

  it("先頭や途中に / があるルールは .gitignore の場所から一致する", () => {
    expect(check("/config.yml\ndocs/*.md\n", ["config.yml", "sub/config.yml", "docs/a.md", "docs/x/a.md", "x/docs/a.md"])).toEqual([
      "ignored:1",
      "kept:-",
      "ignored:2",
      "kept:-",
      "kept:-",
    ]);
  });

  it("** は0個以上のディレクトリに一致する", () => {
    expect(check("**/tmp\na/**/b.txt\n", ["tmp", "x/y/tmp", "a/b.txt", "a/x/y/b.txt"])).toEqual([
      "ignored:1",
      "ignored:1",
      "ignored:2",
      "ignored:2",
    ]);
  });

  it("? と文字クラス", () => {
    expect(check("file?.txt\nlog[0-9].txt\n[!a]b\n", ["file1.txt", "file10.txt", "log5.txt", "logx.txt", "cb", "ab"])).toEqual([
      "ignored:1",
      "kept:-",
      "ignored:2",
      "kept:-",
      "ignored:3",
      "kept:-",
    ]);
  });

  it("コメント・空行・エスケープ", () => {
    const rules = "# comment\n\n\\#hash\n\\!bang\nspace\\ \ntrail   \nstar\\*\n";
    expect(check(rules, ["# comment", "#hash", "!bang", "space ", "trail", "star*", "starx"])).toEqual([
      "kept:-",
      "ignored:3",
      "ignored:4",
      "ignored:5",
      "ignored:6",
      "ignored:7",
      "kept:-",
    ]);
  });

  it("相対パスとして解釈できない入力", () => {
    expect(check("*", ["../x", "a//b", "./ok", "/"])).toEqual(["invalid", "invalid", "ignored:1", "invalid"]);
  });
});
