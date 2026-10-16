// 型定義を同梱していないブラウザ向けバンドルの、このプロジェクトで使う部分だけの型
declare module "csso/dist/csso.esm" {
  export function minify(
    css: string,
    options?: { restructure?: boolean; comments?: boolean | "exclamation" | "first-exclamation" }
  ): { css: string };
}

declare module "html-minifier-terser/dist/htmlminifier.esm.bundle" {
  export function minify(html: string, options?: Record<string, unknown>): Promise<string>;
}
