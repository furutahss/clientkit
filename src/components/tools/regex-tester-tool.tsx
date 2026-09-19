"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import {
  buildHighlightSegments,
  getRegexMatches,
} from "@/lib/regex-match";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";

type FlagKey = "g" | "i" | "m" | "s" | "u";

export function RegexTesterTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.regexTester;

  const FLAG_OPTIONS: { key: FlagKey; label: string; description: string }[] = [
    { key: "g", label: "g", description: dict.flagG },
    { key: "i", label: "i", description: dict.flagI },
    { key: "m", label: "m", description: dict.flagM },
    { key: "s", label: "s", description: dict.flagS },
    { key: "u", label: "u", description: dict.flagU },
  ];

  const PRESETS: { label: string; pattern: string; flags: FlagKey[] }[] = [
    {
      label: dict.presetEmail,
      pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
      flags: ["g"],
    },
    {
      label: dict.presetUrl,
      pattern: "https?:\\/\\/[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+",
      flags: ["g"],
    },
    {
      label: dict.presetPhone,
      pattern: "0\\d{1,4}-\\d{1,4}-\\d{4}",
      flags: ["g"],
    },
    {
      label: dict.presetPostal,
      pattern: "\\d{3}-\\d{4}",
      flags: ["g"],
    },
    {
      label: dict.presetIpv4,
      pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",
      flags: ["g"],
    },
  ];

  const [pattern, setPattern] = React.useState("");
  const [flags, setFlags] = React.useState<Record<FlagKey, boolean>>({
    g: true,
    i: false,
    m: false,
    s: false,
    u: false,
  });
  const [text, setText] = React.useState("");

  const flagsString = FLAG_OPTIONS.filter((f) => flags[f.key])
    .map((f) => f.key)
    .join("");

  const { matches, error } = React.useMemo(
    () => getRegexMatches(pattern, flagsString, text),
    [pattern, flagsString, text]
  );

  const segments = React.useMemo(
    () => buildHighlightSegments(text, matches),
    [text, matches]
  );

  function toggleFlag(key: FlagKey) {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setPattern(preset.pattern);
    setFlags({
      g: preset.flags.includes("g"),
      i: preset.flags.includes("i"),
      m: preset.flags.includes("m"),
      s: preset.flags.includes("s"),
      u: preset.flags.includes("u"),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-1 rounded-md border bg-background px-3 py-1.5 font-mono text-sm">
            <span className="text-muted-foreground">/</span>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={dict.patternPlaceholder}
              spellCheck={false}
              className="flex-1 bg-transparent outline-none"
              aria-label={dict.patternAriaLabel}
            />
            <span className="text-muted-foreground">/{flagsString}</span>
          </div>
          <Select
            onValueChange={(value) => {
              const preset = PRESETS.find((p) => p.label === value);
              if (preset) applyPreset(preset);
            }}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder={dict.presetSelectPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((preset) => (
                <SelectItem key={preset.label} value={preset.label}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          {FLAG_OPTIONS.map((flag) => (
            <button
              key={flag.key}
              type="button"
              onClick={() => toggleFlag(flag.key)}
              title={flag.description}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                flags[flag.key]
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="font-mono">{flag.label}</span>
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{dict.targetTextLabel}</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={dict.sampleText}
            spellCheck={false}
            className="min-h-64 font-mono text-sm"
          />
          <ToolActions onClear={() => setText("")} clearDisabled={!text} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{dict.highlightLabel}</label>
          <div className="min-h-64 overflow-auto rounded-md border bg-background px-3 py-2 font-mono text-sm whitespace-pre-wrap">
            {text ? (
              segments.map((segment, index) =>
                segment.isMatch ? (
                  <mark
                    key={index}
                    className="rounded bg-yellow-200 text-yellow-950 dark:bg-yellow-500/40 dark:text-yellow-50"
                  >
                    {segment.text}
                  </mark>
                ) : (
                  <span key={index}>{segment.text}</span>
                )
              )
            ) : (
              <span className="text-muted-foreground">{dict.highlightEmpty}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {formatTemplate(dict.matchListLabel, { count: matches.length })}
          </label>
          <ToolActions
            getCopyText={() => matches.map((m) => m.match).join("\n")}
            copyDisabled={matches.length === 0}
          />
        </div>

        {matches.length > 0 ? (
          <div className="max-h-80 overflow-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="border-b px-3 py-2 text-left font-medium">
                    {dict.tableHeaderIndex}
                  </th>
                  <th className="border-b px-3 py-2 text-left font-medium">
                    {dict.tableHeaderPosition}
                  </th>
                  <th className="border-b px-3 py-2 text-left font-medium">
                    {dict.tableHeaderMatch}
                  </th>
                  <th className="border-b px-3 py-2 text-left font-medium">
                    {dict.tableHeaderGroups}
                  </th>
                </tr>
              </thead>
              <tbody>
                {matches.slice(0, 500).map((m, index) => {
                  const namedEntries = Object.entries(m.namedGroups);
                  const groupLabels = [
                    ...m.groups.map((g, i) => `$${i + 1}: ${g || dict.emptyGroup}`),
                    ...namedEntries.map(([key, value]) => `${key}: ${value || dict.emptyGroup}`),
                  ];
                  return (
                    <tr key={index} className="odd:bg-muted/30">
                      <td className="border-b px-3 py-1.5 align-top">{index + 1}</td>
                      <td className="border-b px-3 py-1.5 align-top tabular-nums">
                        {m.index}
                      </td>
                      <td className="border-b px-3 py-1.5 align-top font-mono break-all">
                        {m.match || dict.emptyMatch}
                      </td>
                      <td className="border-b px-3 py-1.5 align-top text-muted-foreground">
                        {groupLabels.length > 0 ? groupLabels.join(" / ") : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            {dict.noMatches}
          </p>
        )}
      </div>
    </div>
  );
}
