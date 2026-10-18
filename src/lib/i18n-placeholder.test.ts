import { describe, expect, it } from "vitest";

import { checkTranslations, scanPlaceholders } from "./i18n-placeholder";

describe("プレースホルダー抽出", () => {
  it("名前付きプレースホルダーとエスケープ", () => {
    expect(scanPlaceholders("こんにちは、{name}さん（{ count }件）")).toEqual({ status: "ok", names: ["name", "count"] });
    expect(scanPlaceholders("'{name}' と '{' は文字、don't と '' も文字 {real}")).toEqual({ status: "ok", names: ["real"] });
  });

  it("ICU構文と不正な波括弧を区別する", () => {
    expect(scanPlaceholders("{count, plural, one {# item} other {# items}}")).toEqual({ status: "icu" });
    expect(scanPlaceholders("{gender, select, male {he} other {they}}")).toEqual({ status: "icu" });
    expect(scanPlaceholders("{name")).toEqual({ status: "syntax" });
    expect(scanPlaceholders("a } b")).toEqual({ status: "syntax" });
    expect(scanPlaceholders("{{name}}")).toEqual({ status: "syntax" });
  });
});

describe("翻訳の整合チェック", () => {
  it("順序が違っても名前の集合が同じなら問題なし", () => {
    const report = checkTranslations({ a: "{x} and {y}" }, { a: "{y} と {x}" });
    expect(report).toEqual({ issues: [], checkedStrings: 1 });
  });

  it("不足・余分なキーと変数の過不足をパス付きで返す", () => {
    const base = { home: { greeting: "こんにちは、{name}さん", count: "{n}件" }, only: "x" };
    const target = { home: { greeting: "Hello", count: "{num} items", "extra.key": "y" } };
    expect(checkTranslations(base, target).issues).toEqual([
      { kind: "placeholders", path: "$.home.greeting", missing: ["name"], extra: [] },
      { kind: "placeholders", path: "$.home.count", missing: ["n"], extra: ["num"] },
      { kind: "extraKey", path: '$.home["extra.key"]' },
      { kind: "missingKey", path: "$.only" },
    ]);
  });

  it("型の不一致・文字列以外・ICU構文を区別する", () => {
    const report = checkTranslations(
      { a: "text", b: 1, c: { d: "x" }, e: "{n, plural, other {#}}", f: ["{x}"] },
      { a: 2, b: 3, c: "flat", e: "{n, plural, other {#}}", f: ["{y}"] }
    );
    expect(report.issues).toEqual([
      { kind: "typeMismatch", path: "$.a", baseType: "string", targetType: "number" },
      { kind: "nonString", path: "$.b", type: "number" },
      { kind: "typeMismatch", path: "$.c", baseType: "object", targetType: "string" },
      { kind: "unsupported", path: "$.e", side: "base" },
      { kind: "placeholders", path: "$.f[0]", missing: ["x"], extra: ["y"] },
    ]);
  });
});
