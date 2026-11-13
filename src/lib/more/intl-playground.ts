/** Intl API を複数ロケールで一度に試す */
export type IntlKind = "number" | "currency" | "percent" | "compact" | "date" | "time" | "datetime" | "relative" | "list" | "plural" | "unit";

export type IntlParams = { kind: IntlKind; value: string; currency: string; timeZone: string; dateStyle: string; unit: string; listStyle: string };

export function formatAcross(p: IntlParams, locales: string[]): { locale: string; result: string }[] {
  return locales.map((locale) => {
    try {
      const num = Number(p.value);
      switch (p.kind) {
        case "number": return { locale, result: new Intl.NumberFormat(locale).format(num) };
        case "currency": return { locale, result: new Intl.NumberFormat(locale, { style: "currency", currency: p.currency }).format(num) };
        case "percent": return { locale, result: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(num) };
        case "compact": return { locale, result: new Intl.NumberFormat(locale, { notation: "compact" }).format(num) };
        case "unit": return { locale, result: new Intl.NumberFormat(locale, { style: "unit", unit: p.unit, unitDisplay: "long" }).format(num) };
        case "date": case "time": case "datetime": {
          const d = new Date(p.value);
          if (Number.isNaN(d.getTime())) throw new RangeError("Invalid date");
          const style = p.dateStyle as "short" | "medium" | "long" | "full";
          const opts: Intl.DateTimeFormatOptions = p.kind === "date" ? { dateStyle: style } : p.kind === "time" ? { timeStyle: style } : { dateStyle: style, timeStyle: style === "full" ? "long" : "short" };
          return { locale, result: new Intl.DateTimeFormat(locale, { ...opts, timeZone: p.timeZone || undefined }).format(d) };
        }
        case "relative": {
          const units: Intl.RelativeTimeFormatUnit[] = ["second", "minute", "hour", "day", "week", "month", "year"];
          const unit = units.includes(p.unit as Intl.RelativeTimeFormatUnit) ? (p.unit as Intl.RelativeTimeFormatUnit) : "day";
          return { locale, result: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(num, unit) };
        }
        case "list": return { locale, result: new Intl.ListFormat(locale, { style: p.listStyle as "long" | "short" | "narrow", type: "conjunction" }).format(p.value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)) };
        case "plural": return { locale, result: `${new Intl.PluralRules(locale).select(num)} / ${new Intl.PluralRules(locale, { type: "ordinal" }).select(num)} (ordinal)` };
      }
    } catch (e) { return { locale, result: `(${(e as Error).message})` }; }
  });
}
