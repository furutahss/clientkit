"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToolActions } from "@/components/tools/tool-actions";
import { getNextRuns, parseCron, type CronFieldName } from "@/lib/cron";
import {
  formatInTimeZone,
  formatRelative,
  getSupportedTimeZones,
  isValidTimeZone,
  toIsoInTimeZone,
} from "@/lib/timestamp";
import { useLazyModule } from "@/lib/lazy-module";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";

const RUN_COUNTS = [5, 10, 20, 50] as const;

const PRESETS = [
  "* * * * *",
  "*/5 * * * *",
  "0 * * * *",
  "0 9 * * *",
  "0 9 * * 1-5",
  "30 18 * * 5",
  "0 0 1 * *",
  "0 3 * * SUN",
];

/** 説明文の生成に使うcronstrueは、日本語ロケールとあわせて動的に読み込む */
async function loadCronstrue() {
  const { default: cronstrue } = await import("cronstrue");
  // @ts-expect-error -- ロケールファイルには型定義がなく、登録のための副作用だけを利用する
  await import("cronstrue/locales/ja");
  return cronstrue;
}

function formatValues(values: number[]): string {
  const parts: string[] = [];
  let index = 0;
  while (index < values.length) {
    let end = index;
    while (end + 1 < values.length && values[end + 1] === values[end] + 1) end += 1;
    parts.push(end - index >= 2 ? `${values[index]}-${values[end]}` : values.slice(index, end + 1).join(","));
    index = end + 1;
  }
  return parts.join(",");
}

export function CronExplainerTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.cronExplainer;
  const intlLocale = locale === "ja" ? "ja-JP" : "en-US";

  const [expression, setExpression] = React.useState("0 9 * * 1-5");
  const [timeZone, setTimeZone] = React.useState("UTC");
  const [allZones, setAllZones] = React.useState<string[]>([]);
  const [runCount, setRunCount] = React.useState<number>(10);
  const [now, setNow] = React.useState<number | null>(null);

  // 現在時刻とローカルのタイムゾーンはブラウザでのみ取得する
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      setAllZones(getSupportedTimeZones());
      setNow(Date.now());
    }, 0);
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  const { module: cronstrue } = useLazyModule(loadCronstrue);
  const deferredExpression = React.useDeferredValue(expression);
  const parsed = React.useMemo(() => parseCron(deferredExpression), [deferredExpression]);
  const zoneValid = isValidTimeZone(timeZone);

  const description = React.useMemo(() => {
    if (!parsed.ok || !cronstrue) return null;
    try {
      return cronstrue.toString(parsed.expression, {
        locale,
        use24HourTimeFormat: true,
        throwExceptionOnParseError: true,
      });
    } catch {
      return null;
    }
  }, [parsed, locale, cronstrue]);

  const runs = React.useMemo(() => {
    if (!parsed.ok || now === null || !zoneValid) return [];
    return getNextRuns(parsed, now, runCount, timeZone);
  }, [parsed, now, runCount, timeZone, zoneValid]);

  function errorMessage(): string | null {
    if (parsed.ok || parsed.error === "empty") return null;
    const field = parsed.field ? dict.fields[parsed.field] : "";
    switch (parsed.error) {
      case "field-count":
        return dict.errorFieldCount;
      case "out-of-range":
        return formatTemplate(dict.errorOutOfRange, { field, token: parsed.token ?? "" });
      case "unsupported":
        return formatTemplate(dict.errorUnsupported, { token: parsed.token ?? "" });
      default:
        return formatTemplate(dict.errorInvalid, { field, token: parsed.token ?? "" });
    }
  }

  const error = errorMessage();
  const fieldNames: CronFieldName[] = parsed.ok
    ? parsed.fields.map((field) => field.name)
    : ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="cron-expression" className="text-sm font-medium">
          {dict.inputLabel}
        </label>
        <Input
          id="cron-expression"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          placeholder={dict.inputPlaceholder}
          spellCheck={false}
          className="h-12 font-mono text-lg"
          aria-invalid={error ? true : undefined}
        />
        <p className="font-mono text-xs text-muted-foreground">
          {fieldNames.map((name) => dict.fields[name]).join("  ")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setExpression(preset)}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-xs transition-colors hover:bg-accent",
                expression === preset && "border-primary bg-primary/5"
              )}
            >
              {preset}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{dict.inputHint}</p>
        <ToolActions onClear={() => setExpression("")} clearDisabled={!expression} />
      </div>

      {!parsed.ok ? (
        error ? (
          <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{error}</p>
        ) : (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {dict.emptyState}
          </p>
        )
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <span className="text-sm font-medium text-muted-foreground">{dict.descriptionHeading}</span>
            <p className="text-lg font-semibold">{description ?? (cronstrue ? dict.descriptionUnavailable : dict.calculating)}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <tbody>
                  {parsed.fields.map((field) => (
                    <tr key={field.name} className="border-t">
                      <th scope="row" className="w-28 py-1.5 pr-3 font-medium">
                        {dict.fields[field.name]}
                      </th>
                      <td className="w-32 py-1.5 pr-3 font-mono">{field.source}</td>
                      <td className="py-1.5 font-mono text-xs text-muted-foreground">
                        {field.isWildcard ? dict.every : formatValues(field.values)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!parsed.fields.find((f) => f.name === "dayOfMonth")?.isWildcard &&
              !parsed.fields.find((f) => f.name === "dayOfWeek")?.isWildcard && (
                <p className="text-xs text-muted-foreground">{dict.orNote}</p>
              )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{dict.nextRunsHeading}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  list="cron-zone-list"
                  className="h-8 w-52"
                  aria-label={dict.timeZoneLabel}
                />
                <datalist id="cron-zone-list">
                  {allZones.map((zone) => (
                    <option key={zone} value={zone} />
                  ))}
                </datalist>
                <Select value={String(runCount)} onValueChange={(value) => setRunCount(Number(value))}>
                  <SelectTrigger className="h-8 w-28" aria-label={dict.runCountLabel}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RUN_COUNTS.map((count) => (
                      <SelectItem key={count} value={String(count)}>
                        {formatTemplate(dict.runCountOption, { count })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!zoneValid ? (
              <p className="text-sm text-destructive">{formatTemplate(dict.invalidZone, { zone: timeZone })}</p>
            ) : runs.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {now === null ? dict.calculating : dict.noRuns}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">{dict.colDateTime}</th>
                      <th className="px-3 py-2 font-medium">{dict.colIso}</th>
                      <th className="px-3 py-2 font-medium">{dict.colRelative}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run, index) => (
                      <tr key={run} className="border-t">
                        <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{index + 1}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{formatInTimeZone(run, timeZone, intlLocale)}</td>
                        <td className="px-3 py-1.5 font-mono text-xs whitespace-nowrap">{toIsoInTimeZone(run, timeZone, false)}</td>
                        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                          {now !== null ? formatRelative(run, now, intlLocale) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {zoneValid && runs.length > 0 && (
              <ToolActions
                getCopyText={() => runs.map((run) => toIsoInTimeZone(run, timeZone, false)).join("\n")}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
