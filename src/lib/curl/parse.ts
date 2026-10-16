/**
 * cURL コマンドを解析し、HTTPリクエストの内容（メソッド・URL・ヘッダー・ボディなど）に変換する。
 */
import { tokenize } from "@/lib/curl/tokenize";

export type FormPart = { name: string; value: string; isFile: boolean; filename?: string; contentType?: string };

export type RequestBody =
  | { kind: "json"; text: string; value: unknown }
  | { kind: "form"; text: string; fields: [string, string][] }
  | { kind: "multipart"; parts: FormPart[] }
  | { kind: "raw"; text: string };

export type CurlWarning = { option: string; reason: "unsupported" | "file" | "missingValue" | "extraUrl" };

export type ParsedCurl = {
  method: string;
  /** クエリ文字列を含むURL */
  url: string;
  headers: [string, string][];
  body: RequestBody | null;
  auth: { user: string; password: string } | null;
  insecure: boolean;
  followRedirects: boolean;
  compressed: boolean;
  warnings: CurlWarning[];
};

export class CurlParseError extends Error {
  constructor(readonly code: "empty" | "notCurl" | "noUrl" | "unterminatedQuote") {
    super(code);
  }
}

/** 値を取るオプション（短い形式 → 正式名） */
const SHORT_WITH_VALUE: Record<string, string> = {
  X: "--request",
  H: "--header",
  d: "--data",
  F: "--form",
  u: "--user",
  b: "--cookie",
  A: "--user-agent",
  e: "--referer",
};
const SHORT_FLAGS: Record<string, string> = { L: "--location", k: "--insecure", G: "--get" };

/** 対応していないが値を取るため、次の引数を読み飛ばすオプション */
const UNSUPPORTED_WITH_VALUE = new Set([
  "-o", "--output", "-m", "--max-time", "--connect-timeout", "-x", "--proxy", "-U", "--proxy-user", "--retry",
  "-w", "--write-out", "--cacert", "--capath", "-E", "--cert", "--key", "--cert-type", "--key-type", "-T",
  "--upload-file", "--resolve", "--limit-rate", "-c", "--cookie-jar", "-D", "--dump-header", "--interface",
  "-r", "--range", "-C", "--continue-at", "-K", "--config", "--max-redirs", "-z", "--time-cond", "--oauth2-bearer",
  "--aws-sigv4", "--json", "-y", "--speed-time", "-Y", "--speed-limit", "--retry-delay", "--retry-max-time",
  "--trace", "--trace-ascii", "--stderr", "--unix-socket", "--abstract-unix-socket", "--dns-servers",
]);

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** --data-urlencode の値を curl と同じ規則でエンコードする */
export function encodeDataUrlencode(value: string): string {
  const eq = value.indexOf("=");
  if (eq === -1) return percentEncode(value);
  const name = value.slice(0, eq);
  return name ? `${name}=${percentEncode(value.slice(eq + 1))}` : percentEncode(value.slice(eq + 1));
}

/** "a=1&b=2" を名前と値の組に分ける（不正な形式なら null） */
export function parseFormBody(text: string): [string, string][] | null {
  if (!text) return [];
  const pairs: [string, string][] = [];
  for (const part of text.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq <= 0) return null;
    try {
      const decode = (s: string) => decodeURIComponent(s.replace(/\+/g, " "));
      pairs.push([decode(part.slice(0, eq)), decode(part.slice(eq + 1))]);
    } catch {
      return null;
    }
  }
  return pairs;
}

/** -F の値の先頭が "..." で囲まれていれば中身を取り出す（curl と同じく \" と \\ をエスケープとして扱う） */
function readQuoted(text: string): [string, string] {
  if (!text.startsWith('"')) {
    const semicolon = text.indexOf(";");
    return semicolon === -1 ? [text, ""] : [text.slice(0, semicolon), text.slice(semicolon)];
  }
  let value = "";
  for (let i = 1; i < text.length; i++) {
    const c = text[i];
    if (c === "\\" && (text[i + 1] === '"' || text[i + 1] === "\\")) {
      value += text[i + 1];
      i += 1;
    } else if (c === '"') {
      return [value, text.slice(i + 1)];
    } else {
      value += c;
    }
  }
  return [value, ""];
}

function parseFormPart(value: string, isString: boolean): FormPart | null {
  const eq = value.indexOf("=");
  if (eq <= 0) return null;
  const name = value.slice(0, eq);
  const content = value.slice(eq + 1);
  if (isString) return { name, value: content, isFile: false };
  const isFile = /^[@<]/.test(content);
  const [main, rest] = readQuoted(isFile ? content.slice(1) : content);
  const part: FormPart = { name, value: main, isFile };
  // ;type=...;filename=... の指定を取り出す（ファイル以外では値の一部として扱う）
  if (!isFile) return rest ? { ...part, value: main + rest } : part;
  for (const param of rest.split(";").filter(Boolean)) {
    const eqIndex = param.indexOf("=");
    const key = param.slice(0, eqIndex).trim();
    const [paramValue] = readQuoted(param.slice(eqIndex + 1));
    if (key === "type") part.contentType = paramValue;
    if (key === "filename") part.filename = paramValue;
  }
  return part;
}

export function getHeader(headers: [string, string][], name: string): string | undefined {
  return headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

/** cURL コマンドを解析する */
export function parseCurl(input: string): ParsedCurl {
  if (!input.trim()) throw new CurlParseError("empty");
  let tokens: string[];
  try {
    tokens = tokenize(input.trim().replace(/^\$\s+/, ""));
  } catch {
    throw new CurlParseError("unterminatedQuote");
  }
  if (!/^curl(\.exe)?$/i.test(tokens[0] ?? "")) throw new CurlParseError("notCurl");

  let method: string | null = null;
  let url: string | null = null;
  const headers: [string, string][] = [];
  const data: string[] = [];
  const parts: FormPart[] = [];
  const cookies: string[] = [];
  const warnings: CurlWarning[] = [];
  let auth: ParsedCurl["auth"] = null;
  let insecure = false;
  let followRedirects = false;
  let compressed = false;
  let get = false;
  let binaryData = false;

  // -sSL のようにまとめた短いオプション、-XPOST のように値を続けたものを展開する
  const args: string[] = [];
  for (const token of tokens.slice(1)) {
    const match = token.match(/^-([A-Za-z])(.+)$/);
    if (match && !token.startsWith("--")) {
      if (SHORT_WITH_VALUE[match[1]] || match[1] in { o: 1, m: 1, x: 1, w: 1, T: 1, c: 1, D: 1, r: 1, E: 1 }) {
        args.push(`-${match[1]}`, match[2]);
        continue;
      }
      if ([...token.slice(1)].every((c) => /[A-Za-z#]/.test(c))) {
        args.push(...[...token.slice(1)].map((c) => `-${c}`));
        continue;
      }
    }
    args.push(token);
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const short = /^-[A-Za-z]$/.test(arg) ? arg[1] : null;
    const option = short ? (SHORT_WITH_VALUE[short] ?? SHORT_FLAGS[short] ?? arg) : arg;
    const takesValue =
      (short !== null && short in SHORT_WITH_VALUE) ||
      ["--request", "--header", "--data", "--data-raw", "--data-binary", "--data-ascii", "--data-urlencode", "--form",
        "--form-string", "--user", "--cookie", "--user-agent", "--referer", "--url"].includes(option);
    const next = () => {
      const value = args[i + 1];
      if (value === undefined) {
        warnings.push({ option: arg, reason: "missingValue" });
        return null;
      }
      i += 1;
      return value;
    };

    if (!arg.startsWith("-") || arg === "-") {
      if (url === null) url = arg;
      else warnings.push({ option: arg, reason: "extraUrl" });
      continue;
    }
    if (takesValue) {
      const value = next();
      if (value === null) continue;
      switch (option) {
        case "--request":
          method = value.toUpperCase();
          break;
        case "--header": {
          const colon = value.indexOf(":");
          if (colon > 0) headers.push([value.slice(0, colon).trim(), value.slice(colon + 1).trim()]);
          else if (value.endsWith(";")) headers.push([value.slice(0, -1).trim(), ""]);
          break;
        }
        case "--data":
        case "--data-ascii":
        case "--data-binary":
        case "--data-raw":
          if (option !== "--data-raw" && value.startsWith("@")) warnings.push({ option: `${arg} ${value}`, reason: "file" });
          if (option === "--data-binary") binaryData = true;
          // -d・--data-ascii は curl と同じく改行を取り除く
          data.push(option === "--data" || option === "--data-ascii" ? value.replace(/[\r\n]/g, "") : value);
          break;
        case "--data-urlencode":
          if (/^[^=]*@/.test(value)) warnings.push({ option: `${arg} ${value}`, reason: "file" });
          data.push(encodeDataUrlencode(value));
          break;
        case "--form":
        case "--form-string": {
          const part = parseFormPart(value, option === "--form-string");
          if (part) parts.push(part);
          break;
        }
        case "--user": {
          const colon = value.indexOf(":");
          auth = colon === -1 ? { user: value, password: "" } : { user: value.slice(0, colon), password: value.slice(colon + 1) };
          break;
        }
        case "--cookie":
          if (value.includes("=")) cookies.push(value);
          else warnings.push({ option: `${arg} ${value}`, reason: "file" });
          break;
        case "--user-agent":
          headers.push(["User-Agent", value]);
          break;
        case "--referer":
          headers.push(["Referer", value]);
          break;
        case "--url":
          if (url === null) url = value;
          else warnings.push({ option: value, reason: "extraUrl" });
          break;
      }
      continue;
    }
    if (option === "--location" || option === "--location-trusted") followRedirects = true;
    else if (option === "--insecure") insecure = true;
    else if (option === "--compressed") compressed = true;
    else if (option === "--get") get = true;
    else if (UNSUPPORTED_WITH_VALUE.has(arg)) {
      const value = args[i + 1];
      if (value !== undefined) i += 1;
      warnings.push({ option: value === undefined ? arg : `${arg} ${value}`, reason: "unsupported" });
    } else warnings.push({ option: arg, reason: "unsupported" });
  }

  if (!url) throw new CurlParseError("noUrl");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = `http://${url}`;

  if (cookies.length > 0) {
    const existing = headers.findIndex(([key]) => key.toLowerCase() === "cookie");
    const value = cookies.join("; ");
    if (existing === -1) headers.push(["Cookie", value]);
    else headers[existing] = [headers[existing][0], `${headers[existing][1]}; ${value}`];
  }

  let body: RequestBody | null = null;
  const dataText = data.join("&");
  if (get && data.length > 0) {
    url += (url.includes("?") ? "&" : "?") + dataText;
  } else if (parts.length > 0) {
    body = { kind: "multipart", parts };
  } else if (data.length > 0) {
    const contentType = getHeader(headers, "content-type")?.toLowerCase() ?? "";
    let json: unknown = undefined;
    if (contentType.includes("json") || (!contentType && /^\s*[[{]/.test(dataText))) {
      try {
        json = JSON.parse(dataText);
      } catch {
        json = undefined;
      }
    }
    const fields = json === undefined && !binaryData && (!contentType || contentType.includes("x-www-form-urlencoded"))
      ? parseFormBody(dataText)
      : null;
    if (json !== undefined) body = { kind: "json", text: dataText, value: json };
    else if (fields) body = { kind: "form", text: dataText, fields };
    else body = { kind: "raw", text: dataText };
  }

  return {
    method: method ?? (get ? "GET" : body ? "POST" : "GET"),
    url,
    headers,
    body,
    auth,
    insecure,
    followRedirects,
    compressed,
    warnings,
  };
}

/** URL をクエリ文字列を除いた部分と、クエリの組に分ける */
export function splitUrl(url: string): { base: string; query: [string, string][] } {
  const hash = url.indexOf("#");
  const withoutHash = hash === -1 ? url : url.slice(0, hash);
  const q = withoutHash.indexOf("?");
  if (q === -1) return { base: withoutHash, query: [] };
  const query: [string, string][] = withoutHash
    .slice(q + 1)
    .split("&")
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=");
      const decode = (s: string) => {
        try {
          return decodeURIComponent(s.replace(/\+/g, " "));
        } catch {
          return s;
        }
      };
      return eq === -1 ? [decode(part), ""] : [decode(part.slice(0, eq)), decode(part.slice(eq + 1))];
    });
  return { base: withoutHash.slice(0, q), query };
}
