export type HarHeader = { name: string; value: string };

export type HarCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string | null;
  httpOnly?: boolean;
  secure?: boolean;
};

export type HarQueryParam = { name: string; value: string };

export type HarPostDataParam = { name: string; value?: string; fileName?: string };

export type HarPostData = {
  mimeType: string;
  text?: string;
  params: HarPostDataParam[];
};

export type ResourceCategory =
  | "document"
  | "js"
  | "css"
  | "image"
  | "font"
  | "api"
  | "media"
  | "other";

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  "document",
  "js",
  "css",
  "image",
  "font",
  "api",
  "media",
  "other",
];

export type HarEntryTimings = {
  blocked: number;
  dns: number;
  connect: number;
  ssl: number;
  send: number;
  wait: number;
  receive: number;
};

export type ParsedHarEntry = {
  id: string;
  index: number;
  url: string;
  method: string;
  status: number;
  statusText: string;
  httpVersion: string;
  startedDateTime: string;
  time: number;
  timings: HarEntryTimings;
  ttfb: number;
  downloadTime: number;
  requestHeaders: HarHeader[];
  responseHeaders: HarHeader[];
  requestCookies: HarCookie[];
  responseCookies: HarCookie[];
  queryString: HarQueryParam[];
  postData: HarPostData | null;
  mimeType: string;
  category: ResourceCategory;
  contentSize: number;
  transferSize: number;
  compression: number;
  isHttps: boolean;
  isError: boolean;
  serverIPAddress?: string;
};

export type ParsedHar = {
  entries: ParsedHarEntry[];
  creator?: { name: string; version: string };
  pages: { id: string; title: string }[];
};

export type HarParseErrorCode = "invalid-json" | "invalid-structure" | "empty";

export type HarParseResult =
  | { ok: true; data: ParsedHar }
  | { ok: false; error: HarParseErrorCode };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeHeaders(raw: unknown): HarHeader[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((h) => ({ name: asString(h.name), value: asString(h.value) }))
    .filter((h) => h.name);
}

function normalizeCookies(raw: unknown): HarCookie[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((c) => ({
      name: asString(c.name),
      value: asString(c.value),
      domain: typeof c.domain === "string" ? c.domain : undefined,
      path: typeof c.path === "string" ? c.path : undefined,
      expires: typeof c.expires === "string" ? c.expires : null,
      httpOnly: Boolean(c.httpOnly),
      secure: Boolean(c.secure),
    }))
    .filter((c) => c.name);
}

function normalizeQuery(raw: unknown): HarQueryParam[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((q) => ({ name: asString(q.name), value: asString(q.value) }));
}

function normalizeParams(raw: unknown): HarPostDataParam[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((p) => ({
    name: asString(p.name),
    value: typeof p.value === "string" ? p.value : undefined,
    fileName: typeof p.fileName === "string" ? p.fileName : undefined,
  }));
}

export function getHeaderValue(headers: HarHeader[], name: string): string | undefined {
  const lower = name.toLowerCase();
  return headers.find((h) => h.name.toLowerCase() === lower)?.value;
}

function buildTimings(raw: unknown): HarEntryTimings {
  const t = asRecord(raw);
  const norm = (v: unknown) => {
    const n = asNumber(v, -1);
    return n < 0 ? 0 : n;
  };
  return {
    blocked: norm(t.blocked),
    dns: norm(t.dns),
    connect: norm(t.connect),
    ssl: norm(t.ssl),
    send: norm(t.send),
    wait: norm(t.wait),
    receive: norm(t.receive),
  };
}

function categorize(mimeType: string, url: string, resourceType: string): ResourceCategory {
  const mt = mimeType.toLowerCase();
  const rt = resourceType.toLowerCase();
  let path = url.toLowerCase();
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    // 相対URLなど、URLとして解釈できない場合は元の文字列をそのまま使う
  }

  if (mt.includes("html")) return "document";
  if (mt.includes("javascript") || mt.includes("ecmascript") || /\.m?js$/.test(path)) return "js";
  if (mt.includes("css") || path.endsWith(".css")) return "css";
  if (mt.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|ico|bmp|avif)$/.test(path)) return "image";
  if (mt.includes("font") || /\.(woff2?|ttf|otf|eot)$/.test(path)) return "font";
  if (
    mt.startsWith("video/") ||
    mt.startsWith("audio/") ||
    /\.(mp4|webm|mov|mp3|wav|ogg|m4a)$/.test(path)
  ) {
    return "media";
  }
  if (rt === "xhr" || rt === "fetch" || mt.includes("json") || mt.includes("graphql")) return "api";
  return "other";
}

function buildEntry(raw: unknown, index: number): ParsedHarEntry {
  const entry = asRecord(raw);
  const request = asRecord(entry.request);
  const response = asRecord(entry.response);
  const content = asRecord(response.content);
  const timings = buildTimings(entry.timings);

  const url = asString(request.url);
  const method = asString(request.method, "GET").toUpperCase();
  const status = asNumber(response.status, 0);
  const statusText = asString(response.statusText);
  const httpVersion = asString(response.httpVersion) || asString(request.httpVersion);
  const startedDateTime = asString(entry.startedDateTime);

  const timingsSum =
    timings.blocked +
    timings.dns +
    timings.connect +
    timings.ssl +
    timings.send +
    timings.wait +
    timings.receive;
  const time = asNumber(entry.time, timingsSum) || timingsSum;

  const requestHeaders = normalizeHeaders(request.headers);
  const responseHeaders = normalizeHeaders(response.headers);
  const requestCookies = normalizeCookies(request.cookies);
  const responseCookies = normalizeCookies(response.cookies);
  const queryString = normalizeQuery(request.queryString);

  const rawPostData = request.postData;
  const postData: HarPostData | null = isRecord(rawPostData)
    ? {
        mimeType: asString(rawPostData.mimeType),
        text: typeof rawPostData.text === "string" ? rawPostData.text : undefined,
        params: normalizeParams(rawPostData.params),
      }
    : null;

  const mimeType =
    asString(content.mimeType) || getHeaderValue(responseHeaders, "content-type") || "application/octet-stream";
  const resourceType = asString(entry._resourceType);
  const category = categorize(mimeType, url, resourceType);

  const rawContentSize = asNumber(content.size, -1);
  const bodySize = asNumber(response.bodySize, -1);
  const contentSize = rawContentSize >= 0 ? rawContentSize : bodySize >= 0 ? bodySize : 0;

  const headersSize = asNumber(response.headersSize, -1);
  const transferSize = (headersSize > 0 ? headersSize : 0) + (bodySize > 0 ? bodySize : contentSize);

  const compression = asNumber(content.compression, 0);

  return {
    id: `entry-${index}`,
    index,
    url,
    method,
    status,
    statusText,
    httpVersion,
    startedDateTime,
    time,
    timings,
    ttfb: timings.blocked + timings.dns + timings.connect + timings.ssl + timings.send + timings.wait,
    downloadTime: timings.receive,
    requestHeaders,
    responseHeaders,
    requestCookies,
    responseCookies,
    queryString,
    postData,
    mimeType,
    category,
    contentSize,
    transferSize,
    compression,
    isHttps: url.toLowerCase().startsWith("https://"),
    isError: status >= 400,
    serverIPAddress: typeof entry.serverIPAddress === "string" ? entry.serverIPAddress : undefined,
  };
}

/** HARのJSONテキストをパースし、正規化されたエントリー一覧を返す */
export function parseHarText(text: string): HarParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid-json" };
  }
  return parseHar(json);
}

export function parseHar(json: unknown): HarParseResult {
  if (!isRecord(json)) return { ok: false, error: "invalid-structure" };

  const log = json.log;
  if (!isRecord(log)) return { ok: false, error: "invalid-structure" };

  const entriesRaw = log.entries;
  if (!Array.isArray(entriesRaw)) return { ok: false, error: "invalid-structure" };
  if (entriesRaw.length === 0) return { ok: false, error: "empty" };

  const entries = entriesRaw.map((raw, index) => buildEntry(raw, index));

  const creatorRaw = log.creator;
  const creator = isRecord(creatorRaw)
    ? { name: asString(creatorRaw.name), version: asString(creatorRaw.version) }
    : undefined;

  const pagesRaw = log.pages;
  const pages = Array.isArray(pagesRaw)
    ? pagesRaw
        .filter(isRecord)
        .map((p) => ({ id: asString(p.id), title: asString(p.title) || asString(p.id) }))
    : [];

  return { ok: true, data: { entries, creator, pages } };
}

// --- 解析・診断 -----------------------------------------------------------

export const SECURITY_HEADER_NAMES = [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
] as const;

export type SecurityHeaderName = (typeof SECURITY_HEADER_NAMES)[number];

export type SecurityHeaderCheck = {
  name: SecurityHeaderName;
  present: boolean;
  value?: string;
};

export type SecurityAnalysis = {
  target: ParsedHarEntry | null;
  checks: SecurityHeaderCheck[];
  insecureRequests: ParsedHarEntry[];
};

function analyzeSecurityHeaders(entries: ParsedHarEntry[]): SecurityAnalysis {
  const target = entries.find((e) => e.category === "document") ?? entries[0] ?? null;
  const checks: SecurityHeaderCheck[] = SECURITY_HEADER_NAMES.map((name) => {
    const value = target ? getHeaderValue(target.responseHeaders, name) : undefined;
    return { name, present: Boolean(value), value };
  });
  const insecureRequests = entries.filter((e) => !e.isHttps);
  return { target, checks, insecureRequests };
}

const UNCOMPRESSED_THRESHOLD_BYTES = 10 * 1024;
const LARGE_RESOURCE_THRESHOLD_BYTES = 500 * 1024;
const SLOW_REQUEST_THRESHOLD_MS = 1000;
const COMPRESSIBLE_CATEGORIES: ResourceCategory[] = ["document", "js", "css", "api"];

export type ResourceIssueType = "uncompressed" | "large";

export type ResourceIssue = {
  entry: ParsedHarEntry;
  type: ResourceIssueType;
};

function findResourceIssues(entries: ParsedHarEntry[]): ResourceIssue[] {
  const issues: ResourceIssue[] = [];
  for (const entry of entries) {
    const encoding = getHeaderValue(entry.responseHeaders, "content-encoding");
    const isCompressed = Boolean(encoding) && /gzip|br|deflate|zstd/i.test(encoding ?? "");

    if (
      COMPRESSIBLE_CATEGORIES.includes(entry.category) &&
      entry.contentSize >= UNCOMPRESSED_THRESHOLD_BYTES &&
      !isCompressed
    ) {
      issues.push({ entry, type: "uncompressed" });
    }
    if (entry.contentSize >= LARGE_RESOURCE_THRESHOLD_BYTES) {
      issues.push({ entry, type: "large" });
    }
  }
  return issues;
}

export type ResourceBreakdownItem = {
  category: ResourceCategory;
  count: number;
  size: number;
};

function computeResourceBreakdown(entries: ParsedHarEntry[]): ResourceBreakdownItem[] {
  const map = new Map<ResourceCategory, ResourceBreakdownItem>();
  for (const category of RESOURCE_CATEGORIES) {
    map.set(category, { category, count: 0, size: 0 });
  }
  for (const entry of entries) {
    const item = map.get(entry.category);
    if (item) {
      item.count += 1;
      item.size += entry.contentSize;
    }
  }
  return RESOURCE_CATEGORIES.map((category) => map.get(category)!);
}

function computeTotalDuration(entries: ParsedHarEntry[]): number {
  if (entries.length === 0) return 0;
  const starts = entries.map((e) => Date.parse(e.startedDateTime)).filter((n) => !Number.isNaN(n));
  const ends = entries
    .map((e) => {
      const start = Date.parse(e.startedDateTime);
      return Number.isNaN(start) ? NaN : start + e.time;
    })
    .filter((n) => !Number.isNaN(n));
  if (starts.length === 0 || ends.length === 0) {
    return entries.reduce((sum, e) => sum + e.time, 0);
  }
  return Math.max(...ends) - Math.min(...starts);
}

export type HealthScoreBreakdown = {
  errorCount4xx: number;
  errorCount5xx: number;
  slowRequestCount: number;
  missingSecurityHeaderCount: number;
  insecureRequestCount: number;
  resourceIssueCount: number;
};

export type HarAnalysis = {
  totalRequests: number;
  totalSize: number;
  totalTime: number;
  errorEntries: ParsedHarEntry[];
  slowEntries: ParsedHarEntry[];
  resourceIssues: ResourceIssue[];
  security: SecurityAnalysis;
  breakdown: ResourceBreakdownItem[];
  healthScore: number;
  healthBreakdown: HealthScoreBreakdown;
};

/** パース済みのHARエントリー一覧から、ダッシュボード表示用の解析結果をまとめて算出する */
export function analyzeHar(entries: ParsedHarEntry[]): HarAnalysis {
  const totalRequests = entries.length;
  const totalSize = entries.reduce((sum, e) => sum + e.contentSize, 0);
  const totalTime = computeTotalDuration(entries);

  const errorEntries = entries.filter((e) => e.isError).sort((a, b) => b.status - a.status);
  const slowEntries = [...entries].sort((a, b) => b.time - a.time).slice(0, 5);
  const resourceIssues = findResourceIssues(entries);
  const security = analyzeSecurityHeaders(entries);
  const breakdown = computeResourceBreakdown(entries);

  const errorCount5xx = entries.filter((e) => e.status >= 500).length;
  const errorCount4xx = errorEntries.length - errorCount5xx;
  const slowRequestCount = entries.filter((e) => e.time >= SLOW_REQUEST_THRESHOLD_MS).length;
  const missingSecurityHeaderCount = security.checks.filter((c) => !c.present).length;

  let score = 100;
  score -= Math.min(errorCount5xx * 8, 32);
  score -= Math.min(errorCount4xx * 4, 20);
  score -= Math.min(slowRequestCount * 3, 15);
  score -= Math.min(missingSecurityHeaderCount * 3, 15);
  score -= security.insecureRequests.length > 0 ? 10 : 0;
  score -= Math.min(resourceIssues.length * 2, 10);
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    totalRequests,
    totalSize,
    totalTime,
    errorEntries,
    slowEntries,
    resourceIssues,
    security,
    breakdown,
    healthScore: score,
    healthBreakdown: {
      errorCount4xx,
      errorCount5xx,
      slowRequestCount,
      missingSecurityHeaderCount,
      insecureRequestCount: security.insecureRequests.length,
      resourceIssueCount: resourceIssues.length,
    },
  };
}

export type StatusFilter = "all" | "2xx" | "3xx" | "4xx" | "5xx";
export type CategoryFilter = "all" | ResourceCategory;

export type EntryFilter = {
  search: string;
  status: StatusFilter;
  category: CategoryFilter;
};

export function filterEntries(entries: ParsedHarEntry[], filter: EntryFilter): ParsedHarEntry[] {
  const search = filter.search.trim().toLowerCase();
  return entries.filter((e) => {
    if (search && !e.url.toLowerCase().includes(search)) return false;
    if (filter.status !== "all") {
      const bucket = `${Math.floor(e.status / 100)}xx`;
      if (bucket !== filter.status) return false;
    }
    if (filter.category !== "all" && e.category !== filter.category) return false;
    return true;
  });
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "-";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
