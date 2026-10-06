/** コード生成で共通して使う補助関数 */
import { getHeader, type ParsedCurl } from "@/lib/curl/parse";

/** 多くの言語でそのまま使える、ダブルクォートの文字列リテラル */
export const quote = (value: string): string => JSON.stringify(value);

/** 文字列リテラルの各行に字下げを付ける */
export function indent(text: string, spaces: string): string {
  return text
    .split("\n")
    .map((line, index) => (index === 0 ? line : spaces + line))
    .join("\n");
}

/** ボディの種類に合わせて自動で付くため、生成コードで個別に設定しないヘッダー */
export function headersForCode(request: ParsedCurl): [string, string][] {
  return request.headers.filter(([name]) => {
    const lower = name.toLowerCase();
    if (lower === "content-length") return false;
    // multipart の境界（boundary）は各言語のライブラリが自動で設定する
    if (lower === "content-type" && request.body?.kind === "multipart") return false;
    return true;
  });
}

/** JSONボディのContent-Type（指定がなければ application/json） */
export function contentType(request: ParsedCurl, fallback: string): string {
  return getHeader(request.headers, "content-type") ?? fallback;
}

export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

/** ブラウザの fetch・XMLHttpRequest では設定できない（無視される）ヘッダー */
const FORBIDDEN_BROWSER_HEADERS = new Set(["cookie", "user-agent", "referer", "host", "origin", "connection", "accept-encoding"]);

export function browserForbiddenHeaderNote(request: ParsedCurl): string | null {
  const names = request.headers.map(([name]) => name).filter((name) => FORBIDDEN_BROWSER_HEADERS.has(name.toLowerCase()));
  return names.length > 0 ? `// Note: browsers ignore ${names.join(", ")} (they are sent when run in Node.js).` : null;
}
