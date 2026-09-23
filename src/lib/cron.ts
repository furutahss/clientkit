/**
 * cron式の解析と、次回以降の実行日時の計算。
 * 標準的な5フィールド（分 時 日 月 曜日）と、先頭に秒を加えた6フィールド形式に対応する。
 */

import { getTimeZoneOffset, zonedTimeToEpoch } from "@/lib/timestamp";

export type CronFieldName = "second" | "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

type FieldSpec = { min: number; max: number; names?: Record<string, number> };

const MONTH_NAMES: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const DAY_NAMES: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

const FIELD_SPECS: Record<CronFieldName, FieldSpec> = {
  second: { min: 0, max: 59 },
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12, names: MONTH_NAMES },
  // 0と7はどちらも日曜日を表す
  dayOfWeek: { min: 0, max: 7, names: DAY_NAMES },
};

const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

export type CronField = {
  name: CronFieldName;
  source: string;
  values: number[];
  /** "*" や "?" のように全範囲を表すか */
  isWildcard: boolean;
};

export type CronErrorCode = "empty" | "field-count" | "invalid" | "out-of-range" | "unsupported";

export type CronParseResult =
  | {
      ok: true;
      /** マクロを展開し、スペースを正規化した式 */
      expression: string;
      hasSeconds: boolean;
      fields: CronField[];
    }
  | { ok: false; error: CronErrorCode; field?: CronFieldName; token?: string };

class CronFieldError extends Error {
  constructor(
    public code: CronErrorCode,
    public token: string
  ) {
    super(code);
  }
}

function parseValue(token: string, spec: FieldSpec): number {
  const upper = token.toUpperCase();
  if (spec.names && upper in spec.names) return spec.names[upper];
  if (!/^\d+$/.test(token)) throw new CronFieldError("invalid", token);
  const value = Number(token);
  if (value < spec.min || value > spec.max) throw new CronFieldError("out-of-range", token);
  return value;
}

function parseField(name: CronFieldName, source: string): CronField {
  const spec = FIELD_SPECS[name];
  // L・W・#（最終日・直近の平日・第n曜日）は拡張構文のため非対応（月・曜日の名前は除いて判定）
  const withoutNames = spec.names
    ? source.replace(/[A-Z]{3}/gi, (word) => (word.toUpperCase() in spec.names! ? "" : word))
    : source;
  if (/[LW#]/i.test(withoutNames)) throw new CronFieldError("unsupported", source);

  const values = new Set<number>();
  let isWildcard = false;

  for (const part of source.split(",")) {
    if (!part) throw new CronFieldError("invalid", source);
    const [rangePart, stepPart, ...rest] = part.split("/");
    if (rest.length > 0) throw new CronFieldError("invalid", part);

    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || Number(stepPart) === 0) {
        throw new CronFieldError("invalid", part);
      }
      step = Number(stepPart);
    }

    let start: number;
    let end: number;
    if (rangePart === "*" || rangePart === "?") {
      start = spec.min;
      end = name === "dayOfWeek" ? 6 : spec.max;
      if (stepPart === undefined) isWildcard = true;
    } else if (rangePart.includes("-")) {
      const [from, to, ...extra] = rangePart.split("-");
      if (extra.length > 0 || !from || !to) throw new CronFieldError("invalid", part);
      start = parseValue(from, spec);
      end = parseValue(to, spec);
      if (start > end) throw new CronFieldError("out-of-range", part);
    } else {
      start = parseValue(rangePart, spec);
      // "5/15" は5から最大値まで15刻みを表す
      end = stepPart !== undefined ? spec.max : start;
    }

    for (let value = start; value <= end; value += step) {
      values.add(name === "dayOfWeek" && value === 7 ? 0 : value);
    }
  }

  return {
    name,
    source,
    values: Array.from(values).sort((a, b) => a - b),
    isWildcard,
  };
}

export function parseCron(input: string): CronParseResult {
  let expression = input.trim().replace(/\s+/g, " ");
  if (!expression) return { ok: false, error: "empty" };
  const macro = MACROS[expression.toLowerCase()];
  if (macro) expression = macro;
  if (expression.startsWith("@")) {
    return { ok: false, error: "unsupported", token: expression };
  }

  const parts = expression.split(" ");
  if (parts.length !== 5 && parts.length !== 6) {
    return { ok: false, error: "field-count" };
  }
  const hasSeconds = parts.length === 6;
  const names: CronFieldName[] = hasSeconds
    ? ["second", "minute", "hour", "dayOfMonth", "month", "dayOfWeek"]
    : ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"];

  const fields: CronField[] = [];
  for (let i = 0; i < names.length; i += 1) {
    try {
      fields.push(parseField(names[i], parts[i]));
    } catch (error) {
      if (error instanceof CronFieldError) {
        return { ok: false, error: error.code, field: names[i], token: error.token };
      }
      throw error;
    }
  }

  return { ok: true, expression, hasSeconds, fields };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 次回実行日時を探索する最大日数（うるう年の2月29日なども見つけられるよう約28年分） */
const MAX_SEARCH_DAYS = 366 * 28;

/**
 * 指定した時刻より後の実行日時（Unixミリ秒）を最大 count 件返す。
 * 夏時間の切り替えで存在しない時刻はスキップする。
 */
export function getNextRuns(
  parsed: Extract<CronParseResult, { ok: true }>,
  fromMs: number,
  count: number,
  timeZone: string
): number[] {
  const byName = Object.fromEntries(parsed.fields.map((field) => [field.name, field])) as Record<
    CronFieldName,
    CronField | undefined
  >;
  const seconds = byName.second?.values ?? [0];
  const minutes = byName.minute!.values;
  const hours = byName.hour!.values;
  const dom = byName.dayOfMonth!;
  const months = new Set(byName.month!.values);
  const dow = byName.dayOfWeek!;
  const domSet = new Set(dom.values);
  const dowSet = new Set(dow.values);

  // 日と曜日の両方が指定されている場合は、どちらかに一致すれば実行する（標準的なcronの挙動）
  function dayMatches(year: number, month: number, day: number): boolean {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (dom.isWildcard && dow.isWildcard) return true;
    if (dom.isWildcard) return dowSet.has(weekday);
    if (dow.isWildcard) return domSet.has(day);
    return domSet.has(day) || dowSet.has(weekday);
  }

  const results: number[] = [];
  const startLocal = new Date(fromMs + getTimeZoneOffset(fromMs, timeZone) * 60000);
  let year = startLocal.getUTCFullYear();
  let month = startLocal.getUTCMonth() + 1;
  let day = startLocal.getUTCDate();

  const startHour = startLocal.getUTCHours();
  const startMinute = startLocal.getUTCMinutes();

  for (let i = 0; i < MAX_SEARCH_DAYS && results.length < count; i += 1) {
    if (months.has(month) && dayMatches(year, month, day)) {
      for (const hour of hours) {
        // 探索開始日は開始時刻より前の時間帯を飛ばす（夏時間のずれを考慮して1時間の余裕を持たせる）
        if (i === 0 && hour < startHour - 1) continue;
        for (const minute of minutes) {
          if (i === 0 && hour === startHour && minute < startMinute) continue;
          for (const second of seconds) {
            const epoch = zonedTimeToEpoch({ year, month, day, hour, minute, second }, timeZone);
            if (epoch <= fromMs) continue;
            // 夏時間の開始で存在しない時刻は、変換後の壁時計時刻がずれるためスキップする
            const wall = new Date(epoch + getTimeZoneOffset(epoch, timeZone) * 60000);
            if (wall.getUTCHours() !== hour || wall.getUTCMinutes() !== minute) continue;
            if (results.length > 0 && results[results.length - 1] >= epoch) continue;
            results.push(epoch);
            if (results.length >= count) return results;
          }
        }
      }
    }
    day += 1;
    if (day > daysInMonth(year, month)) {
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }
  return results;
}
