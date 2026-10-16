/**
 * 生成するコードに含まれる機密情報（認証ヘッダー・Cookie・APIキーらしき値）をプレースホルダに置き換える。
 */
import { splitUrl, type ParsedCurl } from "@/lib/curl/parse";

const SECRET_HEADER = /^(authorization|proxy-authorization|cookie|x-api-key|api-key|apikey|x-auth-token|x-access-token|x-csrf-token|x-xsrf-token)$|token|secret|session|signature|password/i;
const SECRET_QUERY = /^(api[_-]?key|apikey|key|token|access[_-]?token|refresh[_-]?token|id[_-]?token|auth|secret|client[_-]?secret|password|passwd|signature|sig|session|sessionid|code)$/i;

function maskHeaderValue(name: string, value: string): string {
  const lower = name.toLowerCase();
  if (lower === "cookie") {
    return value
      .split(/;\s*/)
      .filter(Boolean)
      .map((pair) => `${pair.split("=")[0]}=<COOKIE>`)
      .join("; ");
  }
  const scheme = value.match(/^(Bearer|Basic|Token|Digest|Bot|JWT)\s+/i);
  return scheme ? `${scheme[1]} <TOKEN>` : "<TOKEN>";
}

/** 機密情報らしきヘッダーか */
export function isSecretHeader(name: string): boolean {
  return SECRET_HEADER.test(name);
}

/** 機密情報らしきクエリパラメータか */
export function isSecretQuery(name: string): boolean {
  return SECRET_QUERY.test(name);
}

export function maskRequest(request: ParsedCurl): ParsedCurl {
  const { base, query } = splitUrl(request.url);
  const hashIndex = request.url.indexOf("#");
  const hash = hashIndex === -1 ? "" : request.url.slice(hashIndex);
  const url =
    query.length > 0 && query.some(([key]) => isSecretQuery(key))
      ? `${base}?${query
          .map(([key, value]) => `${encodeURIComponent(key)}=${isSecretQuery(key) ? "<TOKEN>" : encodeURIComponent(value)}`)
          .join("&")}${hash}`
      : request.url;
  return {
    ...request,
    url,
    headers: request.headers.map(([name, value]) => [name, isSecretHeader(name) ? maskHeaderValue(name, value) : value]),
    auth: request.auth ? { user: "<USER>", password: request.auth.password ? "<PASSWORD>" : "" } : null,
  };
}
