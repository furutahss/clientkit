import { splitUrl, type ParsedCurl } from "@/lib/curl/parse";
import { headersForCode, quote } from "@/lib/curl/shared";

/** JSONの値をPythonのリテラル（True / False / None）に変換する */
export function toPythonLiteral(value: unknown, depth = 0): string {
  const pad = "    ".repeat(depth + 1);
  const end = "    ".repeat(depth);
  if (value === null) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return quote(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((v) => `${pad}${toPythonLiteral(v, depth + 1)},`).join("\n")}\n${end}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return `{\n${entries.map(([k, v]) => `${pad}${quote(k)}: ${toPythonLiteral(v, depth + 1)},`).join("\n")}\n${end}}`;
}

/** 名前と値の組を、重複がなければ辞書、あればタプルのリストにする */
function pairsLiteral(pairs: [string, string][]): string {
  const unique = new Set(pairs.map(([key]) => key)).size === pairs.length;
  if (unique) return `{\n${pairs.map(([k, v]) => `    ${quote(k)}: ${quote(v)},`).join("\n")}\n}`;
  return `[\n${pairs.map(([k, v]) => `    (${quote(k)}, ${quote(v)}),`).join("\n")}\n]`;
}

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

/** Python（requests）のコードを生成する */
export function generatePython(request: ParsedCurl): string {
  const { base, query } = splitUrl(request.url);
  const lines = ["import requests", "", `url = ${quote(query.length > 0 ? base : request.url)}`];
  const args = ["url"];

  if (query.length > 0) {
    lines.push(`params = ${pairsLiteral(query)}`);
    args.push("params=params");
  }
  // requests のヘッダーは辞書のため、同じ名前のヘッダーはカンマ区切りでまとめる
  const merged = new Map<string, [string, string]>();
  for (const [name, value] of headersForCode(request)) {
    const existing = merged.get(name.toLowerCase());
    merged.set(name.toLowerCase(), existing ? [existing[0], `${existing[1]}, ${value}`] : [name, value]);
  }
  const headers = [...merged.values()];
  if (headers.length > 0) {
    lines.push(`headers = ${pairsLiteral(headers)}`);
    args.push("headers=headers");
  }

  const body = request.body;
  if (body?.kind === "json") {
    lines.push(`json_data = ${toPythonLiteral(body.value)}`);
    args.push("json=json_data");
  } else if (body?.kind === "form") {
    lines.push(`data = ${pairsLiteral(body.fields)}`);
    args.push("data=data");
  } else if (body?.kind === "multipart") {
    const fields = body.parts.filter((p) => !p.isFile);
    const files = body.parts.filter((p) => p.isFile);
    if (fields.length > 0) {
      lines.push(`data = ${pairsLiteral(fields.map((p) => [p.name, p.value]))}`);
      args.push("data=data");
    }
    if (files.length > 0) {
      lines.push(`files = {\n${files.map((p) => `    ${quote(p.name)}: open(${quote(p.value)}, "rb"),`).join("\n")}\n}`);
      args.push("files=files");
    }
  } else if (body?.kind === "raw") {
    lines.push(`data = ${quote(body.text)}`);
    args.push("data=data.encode()");
  }
  if (request.auth) args.push(`auth=(${quote(request.auth.user)}, ${quote(request.auth.password)})`);
  if (request.insecure) args.push("verify=False");

  const call = METHODS.has(request.method)
    ? `requests.${request.method.toLowerCase()}(${args.join(", ")})`
    : `requests.request(${quote(request.method)}, ${args.join(", ")})`;
  lines.push("", `response = ${call}`, "print(response.status_code)", "print(response.text)");
  return lines.join("\n");
}
