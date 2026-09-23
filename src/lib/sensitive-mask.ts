/**
 * ログ・HAR・JSONに含まれる機密情報（Cookie・認証ヘッダー・トークン・
 * メールアドレス・IPアドレスなど）を検出して伏せ字に置き換える。
 */

export type MaskCategory =
  | "cookie"
  | "authorization"
  | "token"
  | "email"
  | "ip"
  | "custom";

export const MASK_CATEGORIES: MaskCategory[] = [
  "cookie",
  "authorization",
  "token",
  "email",
  "ip",
  "custom",
];

export type MaskStyle = "label" | "asterisk";

export type MaskOptions = {
  categories: Set<MaskCategory>;
  style: MaskStyle;
  /** 任意に伏せたい文字列（完全一致） */
  customTerms: string[];
};

export type MaskResult = {
  output: string;
  counts: Record<MaskCategory, number>;
  /** 入力をJSON（HARを含む）として解析して処理したか */
  format: "har" | "json" | "text";
};

const LABELS: Record<MaskCategory, string> = {
  cookie: "COOKIE",
  authorization: "AUTH",
  token: "TOKEN",
  email: "EMAIL",
  ip: "IP",
  custom: "MASKED",
};

const SENSITIVE_HEADER_CATEGORY: Record<string, MaskCategory> = {
  cookie: "cookie",
  "set-cookie": "cookie",
  authorization: "authorization",
  "proxy-authorization": "authorization",
  "x-api-key": "token",
  "x-auth-token": "token",
  "x-csrf-token": "token",
  "x-xsrf-token": "token",
  "x-amz-security-token": "token",
};

/** 値を伏せるべきパラメーター名・JSONキー名 */
const SENSITIVE_KEY_PATTERN =
  /^(?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|auth[_-]?token|api[_-]?key|apikey|secret|client[_-]?secret|password|passwd|pwd|session(?:[_-]?id)?|sessid|sid|signature|sig|x-amz-signature|private[_-]?key|credential)$/i;

const SENSITIVE_KEY_SOURCE =
  "access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|api[_-]?key|apikey|client[_-]?secret|secret|password|passwd|pwd|session[_-]?id|sessid|x-amz-signature|signature|private[_-]?key|token";

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;

/** よく使われるサービスのAPIキー形式 */
const API_KEY_PATTERN =
  /\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|glpat-[A-Za-z0-9_-]{20,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|rk_(?:live|test)_[A-Za-z0-9]{16,})\b/g;

const BEARER_PATTERN = /\b(Bearer|Basic|Digest|Token)\s+([A-Za-z0-9\-._~+/=]{8,})/g;

const KEY_VALUE_PATTERN = new RegExp(
  `(^|[^A-Za-z0-9_])(${SENSITIVE_KEY_SOURCE})(["']?\\s*[:=]\\s*["']?)([^\\s"'&,;}\\]<>]+)`,
  "gi"
);

const HEADER_LINE_PATTERN =
  /^(\s*(?:[<>]\s*)?)(set-cookie|cookie|authorization|proxy-authorization|x-api-key|x-auth-token|x-csrf-token|x-xsrf-token|x-amz-security-token)(\s*:\s*)(.+)$/gim;

const EMAIL_PATTERN =
  /[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}/g;

const IPV4_PATTERN =
  /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\d.])/g;

const IPV6_PATTERN =
  /(?<![0-9A-Fa-f:])(?:(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,7}:(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){0,5})?|::(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){0,6}))(?![0-9A-Fa-f:])/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class Masker {
  counts: Record<MaskCategory, number> = {
    cookie: 0,
    authorization: 0,
    token: 0,
    email: 0,
    ip: 0,
    custom: 0,
  };
  private ids = new Map<string, string>();
  private nextIndex: Record<MaskCategory, number> = {
    cookie: 1,
    authorization: 1,
    token: 1,
    email: 1,
    ip: 1,
    custom: 1,
  };
  private customPattern: RegExp | null;

  constructor(private options: MaskOptions) {
    const terms = options.customTerms
      .map((term) => term.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    this.customPattern =
      options.categories.has("custom") && terms.length > 0
        ? new RegExp(terms.map(escapeRegExp).join("|"), "g")
        : null;
  }

  enabled(category: MaskCategory): boolean {
    return this.options.categories.has(category);
  }

  /** 値を伏せ字に置き換える（同じ値には同じ番号を振る） */
  mask(category: MaskCategory, value: string): string {
    if (!value) return value;
    this.counts[category] += 1;
    if (this.options.style === "asterisk") return "****";
    const key = `${category}\u0000${value}`;
    let id = this.ids.get(key);
    if (!id) {
      id = `[${LABELS[category]}_${this.nextIndex[category]++}]`;
      this.ids.set(key, id);
    }
    return id;
  }

  /** Cookieヘッダーの値を、名前は残して値だけ伏せる */
  maskCookieHeader(value: string, isSetCookie: boolean): string {
    if (isSetCookie) {
      const [first, ...attributes] = value.split(";");
      return [this.maskCookiePair(first), ...attributes].join(";");
    }
    return value
      .split(";")
      .map((pair) => this.maskCookiePair(pair))
      .join(";");
  }

  private maskCookiePair(pair: string): string {
    const index = pair.indexOf("=");
    if (index === -1) return pair.trim() ? this.mask("cookie", pair.trim()) : pair;
    return `${pair.slice(0, index + 1)}${this.mask("cookie", pair.slice(index + 1).trim())}`;
  }

  maskAuthorization(value: string): string {
    const match = /^(\s*)(Bearer|Basic|Digest|Token|Negotiate|AWS4-HMAC-SHA256)(\s+)([\s\S]+)$/i.exec(value);
    if (match) return `${match[1]}${match[2]}${match[3]}${this.mask("authorization", match[4].trim())}`;
    return this.mask("authorization", value.trim());
  }

  maskHeaderValue(name: string, value: string): string {
    const category = SENSITIVE_HEADER_CATEGORY[name.toLowerCase()];
    if (!category || !this.enabled(category)) return value;
    if (category === "cookie") {
      return this.maskCookieHeader(value, name.toLowerCase() === "set-cookie");
    }
    if (category === "authorization") return this.maskAuthorization(value);
    return this.mask(category, value);
  }

  /** 自由形式のテキストに対してパターンによる検出・置換を行う */
  maskText(text: string): string {
    let result = text;

    if (this.customPattern) {
      result = result.replace(this.customPattern, (match) => this.mask("custom", match));
    }

    result = result.replace(
      HEADER_LINE_PATTERN,
      (match, prefix: string, name: string, separator: string, value: string) => {
        const masked = this.maskHeaderValue(name, value);
        return masked === value ? match : `${prefix}${name}${separator}${masked}`;
      }
    );

    if (this.enabled("authorization")) {
      result = result.replace(
        BEARER_PATTERN,
        (match, scheme: string, credential: string) =>
          credential.startsWith("[") ? match : `${scheme} ${this.mask("authorization", credential)}`
      );
    }

    if (this.enabled("token")) {
      result = result.replace(JWT_PATTERN, (match) => this.mask("token", match));
      result = result.replace(API_KEY_PATTERN, (match) => this.mask("token", match));
      result = result.replace(
        KEY_VALUE_PATTERN,
        (match, before: string, key: string, separator: string, value: string) =>
          value.startsWith("[") || value === "****"
            ? match
            : `${before}${key}${separator}${this.mask("token", value)}`
      );
    }

    if (this.enabled("email")) {
      result = result.replace(EMAIL_PATTERN, (match) => this.mask("email", match));
    }

    if (this.enabled("ip")) {
      result = result.replace(IPV4_PATTERN, (match) => this.mask("ip", match));
      result = result.replace(IPV6_PATTERN, (match) =>
        // "::" 単体や時刻表記などの誤検出を避けるため、16進の区切りが2つ以上あるものに限る
        (match.match(/[0-9A-Fa-f]+/g)?.length ?? 0) >= 2 ? this.mask("ip", match) : match
      );
    }

    return result;
  }
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function isNameValueArray(value: JsonValue): value is { name: string; value: string }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof item.name === "string"
    )
  );
}

function maskJsonValue(value: JsonValue, masker: Masker, parentKey: string | null): JsonValue {
  if (typeof value === "string") {
    if (parentKey && SENSITIVE_KEY_PATTERN.test(parentKey) && masker.enabled("token")) {
      return masker.mask("token", value);
    }
    if (parentKey && SENSITIVE_HEADER_CATEGORY[parentKey.toLowerCase()]) {
      return masker.maskHeaderValue(parentKey, value);
    }
    return masker.maskText(value);
  }
  if (Array.isArray(value)) {
    // HARの headers / cookies / queryString / params は {name, value} の配列
    if (parentKey && isNameValueArray(value)) {
      const key = parentKey.toLowerCase();
      return value.map((item) => {
        const copy: { [key: string]: JsonValue } = { ...item };
        if (typeof item.value === "string") {
          if (key === "headers") {
            const masked = masker.maskHeaderValue(item.name, item.value);
            copy.value = masked !== item.value ? masked : masker.maskText(item.value);
          } else if (key === "cookies") {
            copy.value = masker.enabled("cookie")
              ? masker.mask("cookie", item.value)
              : masker.maskText(item.value);
          } else if (SENSITIVE_KEY_PATTERN.test(item.name) && masker.enabled("token")) {
            copy.value = masker.mask("token", item.value);
          } else {
            copy.value = masker.maskText(item.value);
          }
        }
        for (const [childKey, childValue] of Object.entries(item)) {
          if (childKey !== "name" && childKey !== "value") {
            copy[childKey] = maskJsonValue(childValue as JsonValue, masker, childKey);
          }
        }
        return copy;
      });
    }
    return value.map((item) => maskJsonValue(item, masker, parentKey));
  }
  if (value !== null && typeof value === "object") {
    const output: { [key: string]: JsonValue } = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = maskJsonValue(child, masker, key);
    }
    return output;
  }
  return value;
}

function isHar(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    "log" in value &&
    typeof (value as { log: unknown }).log === "object" &&
    Array.isArray((value as { log: { entries?: unknown } }).log?.entries)
  );
}

/** テキスト（HAR・JSONの場合は構造を解析して）に含まれる機密情報を伏せ字にする */
export function maskSensitiveData(input: string, options: MaskOptions): MaskResult {
  const masker = new Masker(options);
  const trimmed = input.trimStart();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let parsed: JsonValue | undefined;
    try {
      parsed = JSON.parse(input) as JsonValue;
    } catch {
      parsed = undefined;
    }
    if (parsed !== undefined) {
      const masked = maskJsonValue(parsed, masker, null);
      return {
        output: JSON.stringify(masked, null, 2),
        counts: masker.counts,
        format: isHar(parsed) ? "har" : "json",
      };
    }
  }

  return { output: masker.maskText(input), counts: masker.counts, format: "text" };
}
