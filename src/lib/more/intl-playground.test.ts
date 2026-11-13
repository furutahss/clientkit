import { describe, expect, it } from "vitest";

import { formatAcross, type IntlParams } from "./intl-playground";

const base: IntlParams = { kind: "number", value: "1234567.891", currency: "USD", timeZone: "UTC", dateStyle: "medium", unit: "day", listStyle: "long" };
const at = (p: Partial<IntlParams>, locales = ["en-US", "de-DE"]) => Object.fromEntries(formatAcross({ ...base, ...p }, locales).map((r) => [r.locale, r.result]));

describe("Intlプレイグラウンド", () => {
  it("数値・通貨・パーセントをロケール別に整形する", () => {
    expect(at({})).toEqual({ "en-US": "1,234,567.891", "de-DE": "1.234.567,891" });
    expect(at({ kind: "currency", value: "1234.5" })["en-US"]).toBe("$1,234.50");
    expect(at({ kind: "percent", value: "0.256" })["en-US"]).toBe("25.6%");
    expect(at({ kind: "compact", value: "1234567" })["en-US"]).toBe("1.2M");
  });

  it("日時・相対時間・リスト・複数形", () => {
    expect(at({ kind: "date", value: "2026-01-05T00:00:00Z", dateStyle: "long" })["en-US"]).toBe("January 5, 2026");
    expect(at({ kind: "relative", value: "-1", unit: "day" })["en-US"]).toBe("yesterday");
    expect(at({ kind: "list", value: "a, b, c" })["en-US"]).toBe("a, b, and c");
    expect(at({ kind: "plural", value: "1" })["en-US"]).toBe("one / one (ordinal)");
  });

  it("不正な値や未対応のロケールはエラー文字列にする", () => {
    expect(at({ kind: "date", value: "nope" })["en-US"]).toMatch(/Invalid date/);
    expect(at({ kind: "currency", currency: "??" })["en-US"]).toMatch(/^\(/);
  });
});
