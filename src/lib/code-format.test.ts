import { describe, expect, it } from "vitest";

import {
  canMinify,
  DEFAULT_FORMAT_OPTIONS,
  DEFAULT_MINIFY_OPTIONS,
  detectLanguage,
  languageFromFileName,
  reductionRate,
  toCssoOptions,
  toErrorLocation,
  toHtmlMinifierOptions,
  toPrettierOptions,
  toTerserOptions,
} from "./code-format";
import { formatCode, type CodeFormatInput } from "./code-format-runner";

describe("オプションの変換", () => {
  it("Prettier のオプション", () => {
    expect(toPrettierOptions("css", "scss", DEFAULT_FORMAT_OPTIONS)).toMatchObject({ parser: "scss", useTabs: false, tabWidth: 2 });
    expect(toPrettierOptions("javascript", "css", { ...DEFAULT_FORMAT_OPTIONS, indent: "tab" })).toMatchObject({
      parser: "babel",
      useTabs: true,
    });
    expect(toPrettierOptions("typescript", "css", { ...DEFAULT_FORMAT_OPTIONS, indent: "4", printWidth: 5 })).toMatchObject({
      parser: "typescript",
      tabWidth: 4,
      printWidth: 20,
    });
    expect(toPrettierOptions("html", "css", { ...DEFAULT_FORMAT_OPTIONS, printWidth: NaN }).printWidth).toBe(80);
  });

  it("Minify のオプション", () => {
    expect(toTerserOptions(DEFAULT_MINIFY_OPTIONS)).toMatchObject({ mangle: true, compress: { drop_console: false }, format: { comments: "some" } });
    expect(toTerserOptions({ ...DEFAULT_MINIFY_OPTIONS, removeComments: false }).format.comments).toBe("all");
    expect(toCssoOptions({ ...DEFAULT_MINIFY_OPTIONS, restructure: false })).toEqual({ restructure: false, comments: "exclamation" });
    const html = toHtmlMinifierOptions(DEFAULT_MINIFY_OPTIONS, toTerserOptions(DEFAULT_MINIFY_OPTIONS));
    expect(html).toMatchObject({ removeAttributeQuotes: false, removeOptionalTags: false, minifyCSS: { inline: ["none"] } });
    expect(html.minifyJS).toMatchObject({ module: false, mangle: true });
    expect(toHtmlMinifierOptions({ ...DEFAULT_MINIFY_OPTIONS, minifyEmbedded: false }, toTerserOptions(DEFAULT_MINIFY_OPTIONS)).minifyJS).toBe(false);
  });

  it("Minify できる言語", () => {
    expect(canMinify("javascript", "css")).toBe(true);
    expect(canMinify("typescript", "css")).toBe(false);
    expect(canMinify("css", "scss")).toBe(false);
    expect(canMinify("html", "css")).toBe(true);
  });
});

describe("detectLanguage", () => {
  it.each([
    ["<!DOCTYPE html><html><body></body></html>", "html", "css"],
    ['<div class="a"><span>x</span></div>', "html", "css"],
    ["body { color: red; }\n.a > b { margin: 0 }", "css", "css"],
    ["$primary: #333;\n.btn { color: $primary; &:hover { color: red; } }", "css", "scss"],
    ["@primary: #333;\n.btn { color: @primary; }", "css", "less"],
    ["const a = 1;\nfunction f() { return a; }", "javascript", "css"],
    ["interface User { name: string }\nconst u: User = { name: 'a' };", "typescript", "css"],
    ["const App = () => <div>hello</div>;", "javascript", "css"],
  ])("%s", (code, language, dialect) => {
    expect(detectLanguage(code)).toEqual({ language, dialect });
  });

  it("判定できない場合は null", () => {
    expect(detectLanguage("")).toBeNull();
    expect(detectLanguage("hello world")).toBeNull();
  });
});

describe("その他", () => {
  it("拡張子から言語を判定する", () => {
    expect(languageFromFileName("index.HTML")).toEqual({ language: "html", dialect: "css" });
    expect(languageFromFileName("a.scss")).toEqual({ language: "css", dialect: "scss" });
    expect(languageFromFileName("App.tsx")).toEqual({ language: "typescript", dialect: "css" });
    expect(languageFromFileName("x.mjs")).toEqual({ language: "javascript", dialect: "css" });
    expect(languageFromFileName("README.md")).toBeNull();
  });

  it("エラーの位置を取り出す", () => {
    expect(toErrorLocation({ message: "Unexpected token (2:5)\n  1 | a\n> 2 | b", loc: { start: { line: 2, column: 5 } } })).toEqual({
      message: "Unexpected token",
      line: 2,
      column: 5,
    });
    expect(toErrorLocation({ message: "Unexpected token: name", line: 3, col: 0 })).toEqual({ message: "Unexpected token: name", line: 3, column: 1 });
    expect(toErrorLocation(new Error("boom"))).toEqual({ message: "boom" });
  });

  it("削減率", () => {
    expect(reductionRate(1000, 250)).toBe(75);
    expect(reductionRate(3, 2)).toBe(33.3);
    expect(reductionRate(0, 0)).toBe(0);
    expect(reductionRate(100, 120)).toBe(-20);
  });
});

describe("formatCode（実際のライブラリ）", () => {
  const base: Omit<CodeFormatInput, "code" | "language" | "mode"> = {
    dialect: "css",
    format: DEFAULT_FORMAT_OPTIONS,
    minify: DEFAULT_MINIFY_OPTIONS,
  };

  it("JavaScript・TypeScript を整形する", async () => {
    expect(await formatCode({ ...base, code: "const a={b:1,c:[1,2]}", language: "javascript", mode: "format" })).toBe(
      "const a = { b: 1, c: [1, 2] };\n"
    );
    expect(
      await formatCode({
        ...base,
        code: "const a={b:'x'}",
        language: "javascript",
        mode: "format",
        format: { ...DEFAULT_FORMAT_OPTIONS, singleQuote: true, semi: false },
      })
    ).toBe("const a = { b: 'x' }\n");
    expect(await formatCode({ ...base, code: "let x:number=1", language: "typescript", mode: "format" })).toBe("let x: number = 1;\n");
  });

  it("CSS・SCSS・HTML を整形する", async () => {
    expect(await formatCode({ ...base, code: "a{color:red;margin:0}", language: "css", mode: "format" })).toBe(
      "a {\n  color: red;\n  margin: 0;\n}\n"
    );
    expect(await formatCode({ ...base, code: ".a{&:hover{color:red}}", language: "css", dialect: "scss", mode: "format" })).toBe(
      ".a {\n  &:hover {\n    color: red;\n  }\n}\n"
    );
    const html = await formatCode({ ...base, code: "<div><p>hi</p><style>a{color:red}</style></div>", language: "html", mode: "format" });
    expect(html).toContain("<p>hi</p>");
    expect(html).toContain("color: red;");
  });

  it("JavaScript を Minify する（ライセンスコメントは残す）", async () => {
    const code = "/*! keep me */\n// drop me\nfunction add(first, second) { const total = first + second; console.log(total); return total; }\nexport { add };";
    const out = await formatCode({ ...base, code, language: "javascript", mode: "minify" });
    expect(out).toContain("/*! keep me */");
    expect(out).not.toContain("drop me");
    expect(out).not.toContain("first");
    expect(out).toContain("console.log");
    const noConsole = await formatCode({ ...base, code, language: "javascript", mode: "minify", minify: { ...DEFAULT_MINIFY_OPTIONS, dropConsole: true } });
    expect(noConsole).not.toContain("console.log");
    const noMangle = await formatCode({ ...base, code, language: "javascript", mode: "minify", minify: { ...DEFAULT_MINIFY_OPTIONS, mangle: false } });
    expect(noMangle).toContain("first");
  });

  it("使われていないトップレベルの宣言も残す", async () => {
    const out = await formatCode({ ...base, code: "const a = { b: 1 };\nfunction f(x) { return x * 2; }", language: "javascript", mode: "minify" });
    expect(out).toBe("const a={b:1};function f(n){return 2*n}");
  });

  it("CSS を Minify する", async () => {
    const code = "/* c */\n.a { color: red; }\n.b { color: red; }\n.a { margin: 0px; }";
    expect(await formatCode({ ...base, code, language: "css", mode: "minify" })).toBe(".a,.b{color:red}.a{margin:0}");
    expect(
      await formatCode({ ...base, code, language: "css", mode: "minify", minify: { ...DEFAULT_MINIFY_OPTIONS, restructure: false } })
    ).toBe(".a{color:red}.b{color:red}.a{margin:0}");
  });

  it("HTML を Minify する", async () => {
    // バンドルに含まれる http の代替実装が読み込み時に XMLHttpRequest の機能を確認するため、Node.js 用に最低限の代替を用意する
    globalThis.XMLHttpRequest ??= class {
      responseType = "";
      open() {}
    } as unknown as typeof XMLHttpRequest;
    (globalThis as { location?: unknown }).location ??= { host: "" };
    const code = '<!DOCTYPE html>\n<html>\n  <!-- c -->\n  <body>\n    <input type="checkbox" checked="checked">\n    <p class="x">a</p>\n    <script>const value = 1 + 2; console.log(value);</script>\n  </body>\n</html>';
    const out = await formatCode({ ...base, code, language: "html", mode: "minify" });
    expect(out).toContain("<!doctype html>");
    expect(out).not.toContain("<!-- c -->");
    expect(out).toContain("checked>");
    expect(out).toContain('class="x"');
    expect(out).toContain("console.log(3)");
    const aggressive = await formatCode({
      ...base,
      code,
      language: "html",
      mode: "minify",
      minify: { ...DEFAULT_MINIFY_OPTIONS, removeAttributeQuotes: true, removeOptionalTags: true },
    });
    expect(aggressive).toContain("class=x");
    expect(aggressive).not.toContain("</body>");
  });

  it("構文エラーは行番号付きのエラーになる", async () => {
    const error = await formatCode({ ...base, code: "const a = ;\n", language: "javascript", mode: "format" }).catch((e) => e);
    expect(toErrorLocation(error)).toMatchObject({ line: 1 });
    const terserError = await formatCode({ ...base, code: "let a = 1;\nlet = ;", language: "javascript", mode: "minify" }).catch((e) => e);
    expect(toErrorLocation(terserError)).toMatchObject({ line: 2 });
  });
});
