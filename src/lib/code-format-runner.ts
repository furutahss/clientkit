/**
 * 整形・Minify の本体。言語とモードに応じて必要なライブラリだけを動的に読み込む。
 * Web Worker（code-format.worker.ts）から呼び出す。
 */
import {
  toCssoOptions,
  toHtmlMinifierOptions,
  toPrettierOptions,
  toTerserOptions,
  type CodeLanguage,
  type CssDialect,
  type FormatMode,
  type FormatOptions,
  type MinifyOptions,
} from "@/lib/code-format";

export type CodeFormatInput = {
  code: string;
  language: CodeLanguage;
  dialect: CssDialect;
  mode: FormatMode;
  format: FormatOptions;
  minify: MinifyOptions;
};

async function prettierPlugins(language: CodeLanguage) {
  if (language === "html") {
    // HTML内の <style>・<script> も整形するため、CSS・JSのプラグインも読み込む
    const [html, postcss, babel, estree] = await Promise.all([
      import("prettier/plugins/html"),
      import("prettier/plugins/postcss"),
      import("prettier/plugins/babel"),
      import("prettier/plugins/estree"),
    ]);
    return [html, postcss, babel, estree];
  }
  if (language === "css") return [await import("prettier/plugins/postcss")];
  if (language === "typescript") {
    const [typescript, estree] = await Promise.all([import("prettier/plugins/typescript"), import("prettier/plugins/estree")]);
    return [typescript, estree];
  }
  const [babel, estree] = await Promise.all([import("prettier/plugins/babel"), import("prettier/plugins/estree")]);
  return [babel, estree];
}

export async function formatCode(request: CodeFormatInput): Promise<string> {
  if (request.mode === "format") {
    const [{ format }, plugins] = await Promise.all([import("prettier/standalone"), prettierPlugins(request.language)]);
    return format(request.code, { ...toPrettierOptions(request.language, request.dialect, request.format), plugins });
  }
  const terserOptions = toTerserOptions(request.minify);
  if (request.language === "javascript") {
    const { minify } = await import("terser");
    const result = await minify(request.code, terserOptions);
    return result.code ?? "";
  }
  if (request.language === "css") {
    const { minify } = await import("csso/dist/csso.esm");
    return minify(request.code, toCssoOptions(request.minify)).css;
  }
  if (request.language === "html") {
    const { minify } = await import("html-minifier-terser/dist/htmlminifier.esm.bundle");
    return minify(request.code, toHtmlMinifierOptions(request.minify, terserOptions));
  }
  throw new Error("unsupported");
}
