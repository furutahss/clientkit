/**
 * HTML・CSS・JavaScript・TypeScript の整形・Minify ツールで使う純粋関数群。
 * 画面の設定を各ライブラリ（Prettier・terser・csso・html-minifier-terser）のオプションに変換する。
 * ライブラリ自体は Web Worker（code-format.worker.ts）で動的に読み込む。
 */

export type CodeLanguage = "html" | "css" | "javascript" | "typescript";
export type CssDialect = "css" | "scss" | "less";
export type FormatMode = "format" | "minify";

export type FormatOptions = {
  indent: "2" | "4" | "tab";
  printWidth: number;
  singleQuote: boolean;
  semi: boolean;
  trailingComma: "all" | "es5" | "none";
  htmlWhitespace: "css" | "strict" | "ignore";
  /** HTMLの属性を1行に1つずつ折り返す */
  attributePerLine: boolean;
};

export type MinifyOptions = {
  removeComments: boolean;
  /** JS: 変数名の短縮 */
  mangle: boolean;
  /** JS: console.* の削除（危険） */
  dropConsole: boolean;
  /** CSS: 重複・不要なプロパティの最適化（ルールの統合を含む） */
  restructure: boolean;
  /** HTML: 属性値の引用符を省略（危険） */
  removeAttributeQuotes: boolean;
  /** HTML: 省略可能な閉じタグの削除（危険） */
  removeOptionalTags: boolean;
  /** HTML: 埋め込みの CSS・JS も Minify する */
  minifyEmbedded: boolean;
};

export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  indent: "2",
  printWidth: 80,
  singleQuote: false,
  semi: true,
  trailingComma: "all",
  htmlWhitespace: "css",
  attributePerLine: false,
};

/** 安全な最適化は既定でオン、動作が変わる可能性があるものは既定でオフ */
export const DEFAULT_MINIFY_OPTIONS: MinifyOptions = {
  removeComments: true,
  mangle: true,
  dropConsole: false,
  restructure: true,
  removeAttributeQuotes: false,
  removeOptionalTags: false,
  minifyEmbedded: true,
};

/** Prettier のパーサー名 */
export function prettierParser(language: CodeLanguage, dialect: CssDialect): string {
  if (language === "css") return dialect;
  if (language === "javascript") return "babel";
  return language;
}

/** Prettier に渡すオプション */
export function toPrettierOptions(language: CodeLanguage, dialect: CssDialect, options: FormatOptions) {
  return {
    parser: prettierParser(language, dialect),
    useTabs: options.indent === "tab",
    tabWidth: options.indent === "4" ? 4 : 2,
    printWidth: Math.min(320, Math.max(20, Math.round(options.printWidth) || 80)),
    singleQuote: options.singleQuote,
    semi: options.semi,
    trailingComma: options.trailingComma,
    htmlWhitespaceSensitivity: options.htmlWhitespace,
    singleAttributePerLine: options.attributePerLine,
  };
}

/** terser に渡すオプション */
export function toTerserOptions(options: MinifyOptions) {
  return {
    compress: { drop_console: options.dropConsole, passes: 2 },
    mangle: options.mangle,
    // /*! ... */ や @license を含むライセンスコメントは常に残す
    format: { comments: options.removeComments ? ("some" as const) : ("all" as const) },
    // module: true だと使われていないトップレベルの宣言が削除されるため、貼り付けたコード片が消えないようにスクリプトとして扱う
    module: false,
  };
}

/** csso に渡すオプション */
export function toCssoOptions(options: MinifyOptions) {
  return {
    restructure: options.restructure,
    // "exclamation" は /*! ... */ のコメントだけを残す
    comments: options.removeComments ? ("exclamation" as const) : true,
  };
}

/** html-minifier-terser に渡すオプション */
export function toHtmlMinifierOptions(options: MinifyOptions, terser: ReturnType<typeof toTerserOptions>) {
  return {
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments: options.removeComments,
    collapseBooleanAttributes: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    decodeEntities: false,
    removeAttributeQuotes: options.removeAttributeQuotes,
    removeOptionalTags: options.removeOptionalTags,
    // clean-css が @import 先を取得しないよう、インライン展開を無効にする（外部への通信を防ぐ）
    minifyCSS: options.minifyEmbedded ? { inline: ["none"] } : false,
    minifyJS: options.minifyEmbedded ? terser : false,
  };
}

/** Minify に対応している言語か（TypeScript・SCSS・Less は整形のみ） */
export function canMinify(language: CodeLanguage, dialect: CssDialect): boolean {
  if (language === "typescript") return false;
  if (language === "css") return dialect === "css";
  return true;
}

/** 入力内容から言語を推定する */
export function detectLanguage(code: string): { language: CodeLanguage; dialect: CssDialect } | null {
  const text = code.trim();
  if (!text) return null;
  if (/^<(!doctype|html|head|body|div|span|p|a|section|template|!--|[a-z][\w-]*[\s>/])/i.test(text) && /<\/?[a-z][\w-]*/i.test(text)) {
    return { language: "html", dialect: "css" };
  }
  const tsHints = /\b(interface\s+\w+|type\s+\w+\s*=|enum\s+\w+|implements\s+\w+|as\s+const\b|:\s*(string|number|boolean|any|unknown|void|never)\b|<\w+>\s*\(|\bpublic\s+|\bprivate\s+|\breadonly\s+)/;
  const jsHints = /\b(function|const|let|var|return|import|export|class|=>|if\s*\(|for\s*\(|console\.)\b|=>/;
  const cssBlock = /(^|[}\s])[@.#:&\w\-[\]="'*>+~,\s()]+\{[^{}]*:[^{}]*\}/;
  const scssHints = /(^|\n)\s*\$[\w-]+\s*:|@mixin\b|@include\b|@use\b|@extend\b|&[:.\-_\w]/;
  const lessHints = /(^|\n)\s*@[\w-]+\s*:\s*[^;]+;|\.[\w-]+\(\s*\)\s*;/;
  if (cssBlock.test(text) && !/\b(function|const|let|var|return)\b|=>/.test(text)) {
    if (scssHints.test(text)) return { language: "css", dialect: "scss" };
    if (lessHints.test(text)) return { language: "css", dialect: "less" };
    return { language: "css", dialect: "css" };
  }
  if (tsHints.test(text)) return { language: "typescript", dialect: "css" };
  if (jsHints.test(text)) return { language: "javascript", dialect: "css" };
  return null;
}

export type ErrorLocation = { message: string; line?: number; column?: number };

/** 各ライブラリの例外から、行番号・列番号付きのエラー情報を取り出す */
export function toErrorLocation(error: unknown): ErrorLocation {
  if (!error || typeof error !== "object") return { message: String(error) };
  const e = error as {
    message?: unknown;
    loc?: { start?: { line?: number; column?: number } };
    line?: number;
    col?: number;
    column?: number;
  };
  const rawMessage = typeof e.message === "string" ? e.message : String(error);
  // Prettier はメッセージにコードの抜粋（行番号付き）を含めるため、1行目だけを使う
  const message = rawMessage.split("\n")[0].replace(/\s*\(\d+:\d+\)\s*$/, "");
  if (e.loc?.start?.line) return { message, line: e.loc.start.line, column: e.loc.start.column };
  if (typeof e.line === "number") return { message, line: e.line, column: (e.col ?? e.column ?? 0) + 1 };
  return { message };
}

/** 削減率（%、小数第1位まで） */
export function reductionRate(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 1000) / 10;
}

/** ファイル名の拡張子から言語を判定する */
export function languageFromFileName(name: string): { language: CodeLanguage; dialect: CssDialect } | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["html", "htm", "xhtml", "vue", "svelte"].includes(ext)) return { language: "html", dialect: "css" };
  if (ext === "css" || ext === "scss" || ext === "less") return { language: "css", dialect: ext };
  if (["js", "mjs", "cjs", "jsx"].includes(ext)) return { language: "javascript", dialect: "css" };
  if (["ts", "mts", "cts", "tsx"].includes(ext)) return { language: "typescript", dialect: "css" };
  return null;
}
