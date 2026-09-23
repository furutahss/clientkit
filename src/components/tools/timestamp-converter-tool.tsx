"use client";

import * as React from "react";
import { Check, Clock, Copy, Plus, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatInTimeZone,
  formatOffset,
  formatRelative,
  getSupportedTimeZones,
  getTimeZoneOffset,
  isValidTimeZone,
  parseLocalDateTime,
  parseTimestampInput,
  toIsoInTimeZone,
  toLocalDateTimeValue,
  zonedTimeToEpoch,
  type TimestampUnit,
} from "@/lib/timestamp";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { formatTemplate } from "@/lib/utils";

type UnitOption = TimestampUnit | "auto";

const DEFAULT_ZONES = ["UTC", "Asia/Tokyo", "America/New_York", "Europe/London"];

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 shrink-0"
      aria-label={label}
      title={label}
      disabled={!value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // クリップボードAPIが利用できない環境では何もしない
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function ValueRow({ label, value, copyLabel }: { label: string; value: string; copyLabel: string }) {
  return (
    <div className="flex items-center gap-2 border-b py-1.5 last:border-b-0">
      <span className="w-36 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-all font-mono text-sm">{value}</span>
      <CopyButton value={value} label={copyLabel} />
    </div>
  );
}

export function TimestampConverterTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.timestampConverter;
  const intlLocale = locale === "ja" ? "ja-JP" : "en-US";

  const [now, setNow] = React.useState<number | null>(null);
  const [localZone, setLocalZone] = React.useState("UTC");
  const [allZones, setAllZones] = React.useState<string[]>([]);
  const [input, setInput] = React.useState("");
  const [unit, setUnit] = React.useState<UnitOption>("auto");
  const [zones, setZones] = React.useState<string[]>(DEFAULT_ZONES);
  const [zoneToAdd, setZoneToAdd] = React.useState("");
  const [zoneError, setZoneError] = React.useState<string | null>(null);
  const [reverseValue, setReverseValue] = React.useState("");
  const [reverseZone, setReverseZone] = React.useState("UTC");

  // 現在時刻・ローカルのタイムゾーンはブラウザでのみ取得する
  React.useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const current = Date.now();
    const timer = window.setTimeout(() => {
      setLocalZone(zone);
      setReverseZone(zone);
      setAllZones(getSupportedTimeZones());
      setZones((prev) => (prev.includes(zone) ? prev : [zone, ...prev]));
      setInput(String(Math.floor(current / 1000)));
      setReverseValue(toLocalDateTimeValue(current, zone));
      setNow(current);
    }, 0);
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  const parsed = React.useMemo(
    () => (input.trim() ? parseTimestampInput(input, unit) : null),
    [input, unit]
  );
  const ms = parsed?.ok ? parsed.ms : null;

  const reverseParts = parseLocalDateTime(reverseValue);
  const reverseZoneValid = isValidTimeZone(reverseZone);
  const reverseMs =
    reverseParts && reverseZoneValid ? zonedTimeToEpoch(reverseParts, reverseZone) : null;

  function handleAddZone() {
    const zone = zoneToAdd.trim();
    if (!zone) return;
    if (!isValidTimeZone(zone)) {
      setZoneError(formatTemplate(dict.invalidZone, { zone }));
      return;
    }
    setZoneError(null);
    setZones((prev) => (prev.includes(zone) ? prev : [...prev, zone]));
    setZoneToAdd("");
  }

  const UNIT_OPTIONS: { value: UnitOption; label: string }[] = [
    { value: "auto", label: dict.unitAuto },
    { value: "s", label: dict.unitSeconds },
    { value: "ms", label: dict.unitMilliseconds },
    { value: "us", label: dict.unitMicroseconds },
    { value: "ns", label: dict.unitNanoseconds },
  ];

  const detectedLabel =
    parsed?.ok && parsed.unit !== "date"
      ? UNIT_OPTIONS.find((option) => option.value === parsed.unit)?.label
      : parsed?.ok
        ? dict.detectedDate
        : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
          {dict.nowLabel}
        </span>
        <span className="flex items-center gap-1 font-mono text-sm tabular-nums">
          {now !== null ? Math.floor(now / 1000) : "-"}
          <CopyButton value={now !== null ? String(Math.floor(now / 1000)) : ""} label={dict.copy} />
        </span>
        <span className="font-mono text-sm text-muted-foreground tabular-nums">
          {now !== null ? toIsoInTimeZone(now, localZone, false) : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <label htmlFor="timestamp-input" className="text-sm font-medium">
            {dict.inputLabel}
          </label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="timestamp-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={dict.inputPlaceholder}
              spellCheck={false}
              className="min-w-0 flex-1 font-mono"
              aria-invalid={parsed && !parsed.ok ? true : undefined}
            />
            <Select value={unit} onValueChange={(value) => setUnit(value as UnitOption)}>
              <SelectTrigger className="w-40" aria-label={dict.unitLabel}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}
            >
              <Clock className="size-4" />
              {dict.useNow}
            </Button>
            {detectedLabel && (
              <span className="text-xs text-muted-foreground">
                {formatTemplate(dict.detected, { unit: detectedLabel })}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{dict.inputHint}</p>
          {parsed && !parsed.ok && (
            <p className="text-sm text-destructive">
              {parsed.error === "out-of-range" ? dict.outOfRange : dict.invalidInput}
            </p>
          )}
        </div>

        <div className="flex flex-col rounded-lg border p-4">
          {ms === null ? (
            <p className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {dict.emptyState}
            </p>
          ) : (
            <>
              <ValueRow label={dict.rowSeconds} value={String(Math.floor(ms / 1000))} copyLabel={dict.copy} />
              <ValueRow label={dict.rowMilliseconds} value={String(ms)} copyLabel={dict.copy} />
              <ValueRow label={dict.rowIsoUtc} value={new Date(ms).toISOString()} copyLabel={dict.copy} />
              <ValueRow
                label={formatTemplate(dict.rowIsoLocal, { zone: localZone })}
                value={toIsoInTimeZone(ms, localZone)}
                copyLabel={dict.copy}
              />
              <ValueRow label={dict.rowRfc} value={new Date(ms).toUTCString()} copyLabel={dict.copy} />
              <ValueRow
                label={dict.rowRelative}
                value={now !== null ? formatRelative(ms, now, intlLocale) : ""}
                copyLabel={dict.copy}
              />
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{dict.zonesHeading}</span>
        {ms === null ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {dict.zonesEmpty}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{dict.colZone}</th>
                  <th className="px-3 py-2 font-medium">{dict.colDateTime}</th>
                  <th className="px-3 py-2 font-medium">{dict.colIso}</th>
                  <th className="px-3 py-2 font-medium">{dict.colOffset}</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone} className="border-t">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {zone}
                      {zone === localZone && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          {dict.localBadge}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatInTimeZone(ms, zone, intlLocale)}</td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {toIsoInTimeZone(ms, zone)}
                        <CopyButton value={toIsoInTimeZone(ms, zone)} label={dict.copy} />
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      UTC{formatOffset(getTimeZoneOffset(ms, zone))}
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setZones((prev) => prev.filter((item) => item !== zone))}
                        aria-label={formatTemplate(dict.removeZone, { zone })}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={zoneToAdd}
            onChange={(e) => setZoneToAdd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddZone();
            }}
            list="timestamp-zone-list"
            placeholder={dict.addZonePlaceholder}
            className="w-64"
            aria-label={dict.addZonePlaceholder}
          />
          <datalist id="timestamp-zone-list">
            {allZones.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
          <Button type="button" variant="outline" size="sm" onClick={handleAddZone} disabled={!zoneToAdd.trim()}>
            <Plus className="size-4" />
            {dict.addZone}
          </Button>
        </div>
        {zoneError && <p className="text-sm text-destructive">{zoneError}</p>}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <span className="text-sm font-medium">{dict.reverseHeading}</span>
        <div className="flex flex-wrap gap-2">
          <Input
            type="datetime-local"
            step={1}
            value={reverseValue}
            onChange={(e) => setReverseValue(e.target.value)}
            className="w-60"
            aria-label={dict.reverseDateTime}
          />
          <Input
            value={reverseZone}
            onChange={(e) => setReverseZone(e.target.value)}
            list="timestamp-zone-list"
            className="w-56"
            aria-label={dict.reverseZone}
          />
        </div>
        {!reverseZoneValid ? (
          <p className="text-sm text-destructive">{formatTemplate(dict.invalidZone, { zone: reverseZone })}</p>
        ) : (
          reverseMs !== null &&
          Math.abs(reverseMs) <= 8.64e15 && (
            <div className="flex flex-col">
              <ValueRow label={dict.rowSeconds} value={String(Math.floor(reverseMs / 1000))} copyLabel={dict.copy} />
              <ValueRow label={dict.rowMilliseconds} value={String(reverseMs)} copyLabel={dict.copy} />
              <ValueRow label={dict.rowIsoUtc} value={new Date(reverseMs).toISOString()} copyLabel={dict.copy} />
            </div>
          )
        )}
      </div>
    </div>
  );
}
