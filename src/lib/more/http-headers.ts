import type { T } from "./types";

export type Header = { name: string; value: string };
export type Finding = { level: "error" | "warn" | "info" | "ok"; area: string; message: string };

/** HTTPレスポンス／リクエストヘッダーの生テキストを解析する（ステータス行は無視、折り返し行は連結） */
export function parseHeaders(text: string): Header[] {
  const out: Header[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^HTTP\/\d/i.test(line) || /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) /.test(line)) continue;
    if (/^[ \t]/.test(line) && out.length) { out[out.length - 1].value += " " + line.trim(); continue; }
    const i = line.indexOf(":");
    if (i > 0) out.push({ name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() });
  }
  return out;
}

const get = (hs: Header[], n: string) => hs.filter((h) => h.name.toLowerCase() === n);

export function parseCsp(value: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of value.split(";")) {
    const [name, ...src] = part.trim().split(/\s+/);
    if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), src);
  }
  return map;
}

export function parseCacheControl(value: string): Map<string, string | true> {
  const map = new Map<string, string | true>();
  for (const part of value.split(",")) {
    const [k, ...v] = part.trim().split("=");
    if (k) map.set(k.toLowerCase(), v.length ? v.join("=").replace(/^"|"$/g, "") : true);
  }
  return map;
}

export function explainCacheControl(value: string, t: T): string[] {
  const cc = parseCacheControl(value);
  const notes: string[] = [];
  const secs = (n: string) => Number(cc.get(n));
  if (cc.has("no-store")) notes.push(t("no-store: レスポンスをブラウザにもCDNにも保存させません。", "no-store: neither browsers nor CDNs may store the response."));
  if (cc.has("no-cache")) notes.push(t("no-cache: 保存は可能ですが、再利用の前に必ずオリジンへ再検証します。", "no-cache: may be stored, but must be revalidated with the origin before each reuse."));
  if (cc.has("private")) notes.push(t("private: 共有キャッシュ（CDN・プロキシ）には保存させず、ブラウザだけが保存できます。", "private: only the browser may store it, not shared caches (CDNs, proxies)."));
  if (cc.has("public")) notes.push(t("public: CDNなどの共有キャッシュにも保存できます。", "public: shared caches such as CDNs may store it as well."));
  if (cc.has("max-age")) notes.push(t(`max-age=${secs("max-age")}: ブラウザは約${humanSeconds(secs("max-age"), "ja")}の間、再検証なしで再利用できます。`, `max-age=${secs("max-age")}: browsers may reuse it for about ${humanSeconds(secs("max-age"), "en")} without revalidating.`));
  if (cc.has("s-maxage")) notes.push(t(`s-maxage=${secs("s-maxage")}: 共有キャッシュでは max-age の代わりにこの秒数（約${humanSeconds(secs("s-maxage"), "ja")}）を使います。`, `s-maxage=${secs("s-maxage")}: shared caches use this (about ${humanSeconds(secs("s-maxage"), "en")}) instead of max-age.`));
  if (cc.has("immutable")) notes.push(t("immutable: 鮮度の期間中は、再読み込み時も再検証しません（ハッシュ付きファイル名の静的資産向け）。", "immutable: not revalidated even on reload while fresh (for fingerprinted static assets)."));
  if (cc.has("must-revalidate")) notes.push(t("must-revalidate: 期限切れ後は、オリジンへ再検証できない場合に古い内容を使いません。", "must-revalidate: once stale, a cached copy must not be used without successful revalidation."));
  if (cc.has("stale-while-revalidate")) notes.push(t(`stale-while-revalidate=${secs("stale-while-revalidate")}: 期限切れ後も指定秒数の間は古い内容を返しつつ、裏で更新します。`, `stale-while-revalidate=${secs("stale-while-revalidate")}: serves stale content for that many seconds while refreshing in the background.`));
  if (cc.has("stale-if-error")) notes.push(t(`stale-if-error=${secs("stale-if-error")}: オリジンがエラーの間、指定秒数まで古い内容を返せます。`, `stale-if-error=${secs("stale-if-error")}: stale content may be served for that many seconds while the origin errors.`));
  return notes;
}

function humanSeconds(s: number, lang: "ja" | "en"): string {
  if (!Number.isFinite(s)) return "?";
  const units: [number, string, string][] = [[86400, "日", " days"], [3600, "時間", " hours"], [60, "分", " minutes"]];
  for (const [n, ja, en] of units) if (s >= n) return `${Math.round((s / n) * 10) / 10}${lang === "ja" ? ja : en}`;
  return `${s}${lang === "ja" ? "秒" : " seconds"}`;
}

export function analyzeHeaders(headers: Header[], t: T): Finding[] {
  const f: Finding[] = [];
  const add = (level: Finding["level"], area: string, ja: string, en: string) => f.push({ level, area, message: t(ja, en) });
  const one = (n: string) => get(headers, n)[0]?.value;

  // セキュリティヘッダー
  const hsts = one("strict-transport-security");
  if (!hsts) add("warn", "HSTS", "Strict-Transport-Security がありません。HTTPS配信なら設定を検討してください。", "Strict-Transport-Security is missing. Consider it for HTTPS sites.");
  else {
    const age = Number(/max-age=(\d+)/i.exec(hsts)?.[1] ?? NaN);
    if (!(age >= 15552000)) add("warn", "HSTS", "max-age が180日（15552000秒）未満、または未指定です。", "max-age is under 180 days (15552000 seconds) or missing.");
    else add("ok", "HSTS", `max-age=${age} が設定されています。`, `max-age=${age} is set.`);
    if (/preload/i.test(hsts) && !/includeSubDomains/i.test(hsts)) add("warn", "HSTS", "preload には includeSubDomains が必要です。", "preload requires includeSubDomains.");
  }
  const csp = one("content-security-policy");
  const cspMap = csp ? parseCsp(csp) : null;
  if (!cspMap) add("warn", "CSP", "Content-Security-Policy がありません。XSSの被害を抑えるため設定を検討してください。", "Content-Security-Policy is missing. Consider one to limit the impact of XSS.");
  else {
    for (const [dir, src] of cspMap) {
      if (src.includes("'unsafe-inline'") && (dir === "script-src" || dir === "default-src" || dir === "script-src-elem")) add("warn", "CSP", `${dir} に 'unsafe-inline' があり、インラインスクリプトのXSSを防げません（nonce/hashを使用）。`, `${dir} contains 'unsafe-inline', which does not stop inline-script XSS (use a nonce or hash).`);
      if (src.includes("'unsafe-eval'")) add("warn", "CSP", `${dir} に 'unsafe-eval' があります。`, `${dir} contains 'unsafe-eval'.`);
      if (src.some((s) => s === "*" || s === "http:" || s === "https:") && (dir === "script-src" || dir === "default-src" || dir === "object-src")) add("warn", "CSP", `${dir} が広すぎます（${src.filter((s) => ["*", "http:", "https:"].includes(s)).join(" ")}）。`, `${dir} is too broad (${src.filter((s) => ["*", "http:", "https:"].includes(s)).join(" ")}).`);
      if (src.includes("data:") && dir === "script-src") add("warn", "CSP", "script-src に data: があります。", "script-src allows data:.");
    }
    if (!cspMap.has("default-src") && !cspMap.has("script-src")) add("warn", "CSP", "default-src も script-src もありません。", "Neither default-src nor script-src is set.");
    if (!cspMap.has("frame-ancestors")) add("info", "CSP", "frame-ancestors がありません（クリックジャッキング対策は X-Frame-Options でも可能）。", "frame-ancestors is not set (X-Frame-Options can also protect against clickjacking).");
    if (!cspMap.has("object-src") && !cspMap.has("default-src")) add("info", "CSP", "object-src がありません（'none' を推奨）。", "object-src is not set ('none' is recommended).");
    if (!cspMap.has("base-uri")) add("info", "CSP", "base-uri がありません（'self' または 'none' を推奨）。", "base-uri is not set ('self' or 'none' is recommended).");
  }
  if ((one("x-content-type-options") ?? "").toLowerCase() !== "nosniff") add("warn", "X-Content-Type-Options", "nosniff が設定されていません。", "nosniff is not set.");
  if (!one("x-frame-options") && !cspMap?.has("frame-ancestors")) add("warn", "X-Frame-Options", "X-Frame-Options も CSP frame-ancestors もなく、他サイトのiframeに埋め込まれる可能性があります。", "Neither X-Frame-Options nor CSP frame-ancestors is set, so other sites may embed this page in an iframe.");
  if (!one("referrer-policy")) add("info", "Referrer-Policy", "Referrer-Policy がありません（strict-origin-when-cross-origin が一般的な既定）。", "Referrer-Policy is missing (strict-origin-when-cross-origin is the usual default).");
  if (!one("permissions-policy")) add("info", "Permissions-Policy", "Permissions-Policy がありません。不要な機能（camera, geolocation 等）を無効化できます。", "Permissions-Policy is missing. You can disable unneeded features such as camera and geolocation.");
  if (one("server")?.match(/\d+\.\d+/)) add("info", "Server", "Server ヘッダーにバージョン情報が含まれています。", "The Server header exposes version information.");
  if (one("x-powered-by")) add("info", "X-Powered-By", "X-Powered-By が公開されています。不要なら削除を検討してください。", "X-Powered-By is exposed. Consider removing it.");

  // CORS
  const acao = one("access-control-allow-origin");
  const credentials = (one("access-control-allow-credentials") ?? "").toLowerCase() === "true";
  if (acao !== undefined) {
    if (acao === "*" && credentials) add("error", "CORS", "Access-Control-Allow-Origin: * と Allow-Credentials: true の組み合わせはブラウザに拒否されます。", "Access-Control-Allow-Origin: * combined with Allow-Credentials: true is rejected by browsers.");
    if (acao === "null") add("warn", "CORS", "Allow-Origin: null はサンドボックス化されたiframeなどからのアクセスを許可してしまいます。", "Allow-Origin: null also allows sandboxed iframes and similar contexts.");
    if (acao !== "*" && !/\borigin\b/i.test(one("vary") ?? "")) add("warn", "CORS", "特定のオリジンを返しているのに Vary: Origin がなく、キャッシュが別オリジンに誤って使われる恐れがあります。", "A specific origin is returned without Vary: Origin, so caches may serve it to the wrong origin.");
    if (credentials && (one("access-control-allow-headers") ?? "").trim() === "*") add("warn", "CORS", "資格情報ありの場合、Allow-Headers: * はワイルドカードではなく文字列として扱われます。", "With credentials, Allow-Headers: * is treated literally, not as a wildcard.");
    if (credentials && (one("access-control-allow-methods") ?? "").trim() === "*") add("warn", "CORS", "資格情報ありの場合、Allow-Methods: * はワイルドカードになりません。", "With credentials, Allow-Methods: * is not a wildcard.");
    if (acao !== "*" && acao !== "null" && !/^https?:\/\/[^/\s]+$/i.test(acao)) add("error", "CORS", "Allow-Origin は *、null、または末尾スラッシュなしの単一オリジン（https://example.com）でなければなりません。", "Allow-Origin must be *, null, or a single origin without a trailing slash (https://example.com).");
    if (one("access-control-allow-methods") === undefined && !credentials) add("info", "CORS", "Allow-Methods がありません。プリフライト（OPTIONS）への応答なら必要です。", "Allow-Methods is missing. It is required in preflight (OPTIONS) responses.");
    if (acao !== "*" && acao !== "null" && !f.some((x) => x.area === "CORS" && x.level !== "ok")) add("ok", "CORS", `Allow-Origin は ${acao} です。`, `Allow-Origin is ${acao}.`);
  } else add("info", "CORS", "Access-Control-Allow-Origin がありません（同一オリジンのみ、またはCORS不要のレスポンスです）。", "Access-Control-Allow-Origin is absent (same-origin only, or CORS is not needed).");

  // Cache-Control
  const cc = one("cache-control");
  if (cc) {
    const m = parseCacheControl(cc);
    if (m.has("no-store") && (m.has("max-age") || m.has("public"))) add("warn", "Cache-Control", "no-store と max-age/public が併記されています。no-store が優先されます。", "no-store appears together with max-age/public. no-store wins.");
    if (m.has("public") && m.has("private")) add("error", "Cache-Control", "public と private が同時に指定されています。", "public and private are both specified.");
    if (m.has("immutable") && !m.has("max-age")) add("warn", "Cache-Control", "immutable は max-age と併用しないと効果がありません。", "immutable has no effect without max-age.");
    if (!f.some((x) => x.area === "Cache-Control")) add("ok", "Cache-Control", "矛盾する指定は見つかりませんでした。", "No conflicting directives found.");
  } else add("info", "Cache-Control", "Cache-Control がありません。Last-Modified などからの推定（ヒューリスティック）キャッシュになります。", "Cache-Control is missing. Caches fall back to heuristic freshness (e.g. from Last-Modified).");

  // Cookie
  for (const h of get(headers, "set-cookie")) {
    const [pair, ...attrs] = h.value.split(";").map((s) => s.trim());
    const name = pair.split("=")[0];
    const a = new Map(attrs.map((s) => { const [k, ...v] = s.split("="); return [k.toLowerCase(), v.join("=")] as const; }));
    const label = `Cookie ${name}`;
    const sameSite = a.get("samesite")?.toLowerCase();
    if (!a.has("secure")) add("warn", label, "Secure 属性がありません（HTTPでも送信されます）。", "No Secure attribute (the cookie may be sent over HTTP).");
    if (!a.has("httponly")) add("info", label, "HttpOnly 属性がありません（JavaScriptから読み取れます）。", "No HttpOnly attribute (readable from JavaScript).");
    if (!sameSite) add("info", label, "SameSite 属性がありません（ブラウザの既定は Lax）。", "No SameSite attribute (browsers default to Lax).");
    if (sameSite === "none" && !a.has("secure")) add("error", label, "SameSite=None には Secure が必須です。", "SameSite=None requires Secure.");
    if (name.startsWith("__Host-") && (!a.has("secure") || a.get("path") !== "/" || a.has("domain"))) add("error", label, "__Host- プレフィックスには Secure・Path=/・Domain なし が必要です。", "The __Host- prefix requires Secure, Path=/, and no Domain.");
    if (name.startsWith("__Secure-") && !a.has("secure")) add("error", label, "__Secure- プレフィックスには Secure が必要です。", "The __Secure- prefix requires Secure.");
    const maxAge = Number(a.get("max-age"));
    if (maxAge > 400 * 86400) add("warn", label, "有効期限が400日を超えています（Chromeは400日に短縮します）。", "Lifetime exceeds 400 days (Chrome caps it at 400 days).");
    if (new TextEncoder().encode(h.value).length > 4096) add("error", label, "Cookieが4096バイトを超えています。", "The cookie exceeds 4096 bytes.");
  }
  return f;
}
