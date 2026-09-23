/** Unixタイムスタンプと日時文字列の相互変換・タイムゾーン変換ユーティリティ */

export type TimestampUnit = "s" | "ms" | "us" | "ns";

export type ParsedTimestamp =
  | { ok: true; ms: number; unit: TimestampUnit | "date" }
  | { ok: false; error: "invalid" | "out-of-range" };

/** Dateで扱える範囲（±8.64e15ミリ秒） */
const MAX_MS = 8.64e15;

/**
 * 数値の桁数から単位を推定する。
 * 11桁以下は秒、12〜14桁はミリ秒、15〜17桁はマイクロ秒、18桁以上はナノ秒とみなす。
 */
export function detectUnit(digits: string): TimestampUnit {
  const length = digits.replace(/^[-+]/, "").split(".")[0].replace(/^0+(?=\d)/, "").length;
  if (length <= 11) return "s";
  if (length <= 14) return "ms";
  if (length <= 17) return "us";
  return "ns";
}

const UNIT_DIVISOR: Record<TimestampUnit, number> = {
  s: 1 / 1000,
  ms: 1,
  us: 1000,
  ns: 1_000_000,
};

/** タイムスタンプ（数値）または日時文字列を解析する */
export function parseTimestampInput(
  input: string,
  unit: TimestampUnit | "auto"
): ParsedTimestamp {
  const value = input.trim();
  if (!value) return { ok: false, error: "invalid" };

  if (/^[-+]?\d+(\.\d+)?$/.test(value)) {
    const resolved = unit === "auto" ? detectUnit(value) : unit;
    let ms: number;
    if (resolved === "ns" || resolved === "us") {
      // 大きな整数は Number の精度を超えるため BigInt で割る
      const [integer] = value.split(".");
      ms = Number(BigInt(integer) / BigInt(UNIT_DIVISOR[resolved]));
    } else {
      ms = Number(value) / UNIT_DIVISOR[resolved];
    }
    if (!Number.isFinite(ms) || Math.abs(ms) > MAX_MS) {
      return { ok: false, error: "out-of-range" };
    }
    return { ok: true, ms: Math.trunc(ms), unit: resolved };
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return { ok: false, error: "invalid" };
  return { ok: true, ms: parsed, unit: "date" };
}

/** タイムゾーンごとのフォーマッター（生成コストが高いため使い回す） */
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function getOffsetFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** 指定したタイムゾーンでのUTCからのオフセット（分） */
export function getTimeZoneOffset(ms: number, timeZone: string): number {
  const parts = getOffsetFormatter(timeZone).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  const truncated = Math.floor(ms / 1000) * 1000;
  return Math.round((asUtc - truncated) / 60000);
}

export function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/** 指定したタイムゾーンでのISO 8601形式（オフセット付き）の文字列 */
export function toIsoInTimeZone(ms: number, timeZone: string, withMillis = true): string {
  const offset = getTimeZoneOffset(ms, timeZone);
  const shifted = new Date(ms + offset * 60000);
  const year = shifted.getUTCFullYear();
  const yearText =
    year >= 0 && year <= 9999 ? pad(year, 4) : `${year < 0 ? "-" : "+"}${pad(Math.abs(year), 6)}`;
  const base = `${yearText}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
  const millis = withMillis ? `.${pad(shifted.getUTCMilliseconds(), 3)}` : "";
  return `${base}${millis}${offset === 0 && timeZone === "UTC" ? "Z" : formatOffset(offset)}`;
}

/** 指定したタイムゾーンでの人が読みやすい日時表記 */
export function formatInTimeZone(ms: number, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
}

/**
 * タイムゾーン上の壁時計時刻（年月日時分秒）をUnixミリ秒に変換する。
 * 夏時間の切り替えで存在しない・重複する時刻は、切り替え前のオフセットを優先する。
 */
export function zonedTimeToEpoch(
  parts: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  timeZone: string
): number {
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let guess = asUtc - getTimeZoneOffset(asUtc, timeZone) * 60000;
  // オフセットが推定値の前後で変わる場合に備えて2回補正する
  for (let i = 0; i < 2; i += 1) {
    const corrected = asUtc - getTimeZoneOffset(guess, timeZone) * 60000;
    if (corrected === guess) break;
    guess = corrected;
  }
  return guess;
}

/** "2026-01-02T03:04:05" 形式（datetime-local）の文字列を分解する */
export function parseLocalDateTime(
  value: string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } | null {
  const match = /^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
}

/** 指定タイムゾーンの壁時計時刻を datetime-local 形式で返す */
export function toLocalDateTimeValue(ms: number, timeZone: string): string {
  return toIsoInTimeZone(ms, timeZone, false).slice(0, 19);
}

/** 現在時刻との差を「3時間前」「2日後」などの表現にする */
export function formatRelative(ms: number, now: number, locale: string): string {
  const diffSeconds = Math.round((ms - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds || unit === "second") {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return "";
}

export function getSupportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  const zones = intl.supportedValuesOf?.("timeZone") ?? [];
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
