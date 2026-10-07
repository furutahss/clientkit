"use client";

import * as React from "react";
import { Download, Eraser, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { downloadBytes } from "@/lib/download";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import type { DiffLine } from "@/lib/text-diff";
import {
  formatCodePoint,
  NO_NORMALIZE_OPTIONS,
  normalizeText,
  PRESETS,
  type Detection,
  type NormalizeOptions,
  type NormalizeStep,
  type PresetId,
} from "@/lib/text-normalize";
import type { TextNormalizeResult } from "@/lib/text-normalize.worker";
import { cn, formatTemplate } from "@/lib/utils";
import { WorkerCancelledError, WorkerClient } from "@/lib/worker-client";

const STORAGE_KEY = "clientkit:text-normalizer:options";
const PRESET_IDS: PresetId[] = ["csv", "database", "proofreading", "invisible"];
/** 本文中の可視化と一覧に表示する上限 */
const MAX_VISUALIZE_CHARS = 30_000;
const MAX_LIST_ITEMS = 300;
const LARGE_TEXT_CHARS = 1_000_000;

const SHORT_NAMES: Record<string, string> = {
  "ZERO WIDTH SPACE": "ZWSP",
  "ZERO WIDTH NON-JOINER": "ZWNJ",
  "ZERO WIDTH JOINER": "ZWJ",
  "WORD JOINER": "WJ",
  "BYTE ORDER MARK": "BOM",
  "NO-BREAK SPACE": "NBSP",
  "NARROW NO-BREAK SPACE": "NNBSP",
  "SOFT HYPHEN": "SHY",
  "LEFT-TO-RIGHT MARK": "LRM",
  "RIGHT-TO-LEFT MARK": "RLM",
  "LEFT-TO-RIGHT OVERRIDE": "LRO",
  "RIGHT-TO-LEFT OVERRIDE": "RLO",
  "LINE SEPARATOR": "LS",
  "PARAGRAPH SEPARATOR": "PS",
  "TAG CHARACTER": "TAG",
};

function shortName(item: Detection): string {
  if (item.kind === "dependent") return item.name;
  if (item.kind === "variationSelector") return item.category === "ivs" ? "IVS" : "VS";
  if (item.category === "control") return "CTRL";
  return SHORT_NAMES[item.name] ?? formatCodePoint(item.codePoint);
}

function createWorker() {
  return new Worker(new URL("../../lib/text-normalize.worker.ts", import.meta.url), { type: "module" });
}

function readOptions(): NormalizeOptions | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...NO_NORMALIZE_OPTIONS, ...(JSON.parse(raw) as Partial<NormalizeOptions>) } : null;
  } catch {
    return null;
  }
}

/** 検出した文字に印を付けて本文を表示する */
function Visualized({ text, detections, label }: { text: string; detections: Detection[]; label: (item: Detection) => string }) {
  const limit = Math.min(text.length, MAX_VISUALIZE_CHARS);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const item of detections) {
    if (item.index >= limit) break;
    if (item.index > cursor) nodes.push(text.slice(cursor, item.index));
    const original = text.slice(item.index, item.index + item.length);
    const visibleChar = item.kind === "dependent";
    nodes.push(
      <mark
        key={item.index}
        title={label(item)}
        className={cn(
          "mx-px rounded-sm px-0.5 font-mono text-[0.7rem]",
          item.kind === "invisible" && "bg-red-600 text-white dark:bg-red-500",
          item.kind === "variationSelector" && "bg-violet-600 text-white dark:bg-violet-500",
          visibleChar && "bg-amber-200 text-amber-950 dark:bg-amber-500/40 dark:text-amber-50"
        )}
      >
        {visibleChar ? original : shortName(item)}
      </mark>
    );
    // 改行の意味を持つ文字は改行して表示する
    if (item.category === "lineSeparator") nodes.push("\n");
    cursor = item.index + item.length;
  }
  if (cursor < limit) nodes.push(text.slice(cursor, limit));
  return <>{nodes}</>;
}

const LINE_CLASS: Record<DiffLine["type"], string> = {
  equal: "",
  removed: "bg-red-50 dark:bg-red-500/10",
  added: "bg-emerald-50 dark:bg-emerald-500/10",
};
const MARK_CLASS: Record<DiffLine["type"], string> = {
  equal: "",
  removed: "rounded-sm bg-red-200 text-red-950 dark:bg-red-500/40 dark:text-red-50",
  added: "rounded-sm bg-emerald-200 text-emerald-950 dark:bg-emerald-500/40 dark:text-emerald-50",
};

export function TextNormalizerTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.textNormalizer, [locale]);

  const [input, setInput] = React.useState("");
  const [options, setOptions] = React.useState<NormalizeOptions>(PRESETS.proofreading);
  const [result, setResult] = React.useState<TextNormalizeResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  const clientRef = React.useRef<WorkerClient | null>(null);
  const seq = React.useRef(0);

  React.useEffect(() => {
    Promise.resolve().then(() => {
      const saved = readOptions();
      if (saved) setOptions(saved);
      setRestored(true);
    });
    const pending = takePendingToolFile("text-normalizer");
    if (pending) pending.text().then(setInput);
    return () => clientRef.current?.cancel();
  }, []);

  React.useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
      // 保存できない環境では何もしない
    }
  }, [options, restored]);

  React.useEffect(() => {
    const current = ++seq.current;
    if (!input) return;
    const timer = window.setTimeout(() => {
      clientRef.current?.cancel();
      clientRef.current ??= new WorkerClient(createWorker);
      setBusy(true);
      clientRef.current
        .request<TextNormalizeResult>({ text: input, options })
        .then((next) => {
          if (current === seq.current) setResult(next);
        })
        .catch((e) => {
          if (!(e instanceof WorkerCancelledError) && current === seq.current) setResult(null);
        })
        .finally(() => {
          if (current === seq.current) setBusy(false);
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input, options]);

  const activeResult = input ? result : null;
  const output = activeResult?.output ?? "";
  const update = (patch: Partial<NormalizeOptions>) => setOptions((prev) => ({ ...prev, ...patch }));
  const presetActive = (id: PresetId) => JSON.stringify(PRESETS[id]) === JSON.stringify(options);
  const describe = (item: Detection) =>
    `${formatCodePoint(item.codePoint)} ${item.kind === "dependent" ? dict.kinds.dependent : item.name}`;
  const invisibleCount = activeResult?.detections.filter((item) => item.kind === "invisible").length ?? 0;
  const countEntries = Object.entries(activeResult?.counts ?? {}) as [NormalizeStep, number][];

  const checkbox = (key: keyof NormalizeOptions, label: string, hint?: string) => (
    <div className="flex items-start gap-2">
      <Checkbox
        id={`normalize-${key}`}
        checked={options[key] === true}
        onCheckedChange={(checked) => update({ [key]: checked === true } as Partial<NormalizeOptions>)}
        className="mt-0.5"
      />
      <label htmlFor={`normalize-${key}`} className="text-sm">
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </label>
    </div>
  );
  const select = <K extends keyof NormalizeOptions>(key: K, label: string, choices: [NormalizeOptions[K] & string, string][]) => (
    <div className="flex flex-col gap-1.5">
      <label id={`normalize-${key}-label`} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Select value={options[key] as string} onValueChange={(value) => update({ [key]: value } as Partial<NormalizeOptions>)}>
        <SelectTrigger className="w-full" aria-labelledby={`normalize-${key}-label`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map(([value, text]) => (
            <SelectItem key={value} value={value}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium" id="normalize-presets">
          {dict.presetsLabel}
        </span>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="normalize-presets">
          {PRESET_IDS.map((id) => (
            <Button
              key={id}
              type="button"
              variant={presetActive(id) ? "default" : "outline"}
              size="sm"
              aria-pressed={presetActive(id)}
              onClick={() => setOptions(PRESETS[id])}
            >
              {dict.presets[id]}
            </Button>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setOptions(NO_NORMALIZE_OPTIONS)}>
            {dict.allOff}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-md border p-3 sm:grid-cols-2 xl:grid-cols-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{dict.groups.chars}</legend>
          {checkbox("fullwidthAlnum", dict.options.fullwidthAlnum)}
          {checkbox("halfwidthKana", dict.options.halfwidthKana)}
          {checkbox("combineDakuten", dict.options.combineDakuten)}
          {checkbox("dependentChars", dict.options.dependentChars, dict.options.dependentCharsHint)}
          {checkbox("itaiji", dict.options.itaiji, dict.options.itaijiHint)}
          {select("unicode", dict.options.unicode, [
            ["none", dict.choices.none],
            ["nfc", "NFC"],
            ["nfkc", dict.choices.nfkc],
          ])}
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{dict.groups.symbols}</legend>
          {select("symbols", dict.options.symbols, [
            ["none", dict.choices.none],
            ["half", dict.choices.half],
            ["full", dict.choices.full],
          ])}
          {select("dashes", dict.options.dashes, [
            ["none", dict.choices.none],
            ["-", "- (U+002D)"],
            ["－", "－ (U+FF0D)"],
            ["—", "— (U+2014)"],
          ])}
          <p className="text-xs text-muted-foreground">{dict.options.dashesHint}</p>
          {select("tildes", dict.options.tildes, [
            ["none", dict.choices.none],
            ["〜", "〜 (U+301C)"],
            ["～", "～ (U+FF5E)"],
            ["~", "~ (U+007E)"],
          ])}
          {select("punctuation", dict.options.punctuation, [
            ["none", dict.choices.none],
            ["、。", "、。"],
            ["，．", "，．"],
            [",.", ",."],
          ])}
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{dict.groups.spaces}</legend>
          {checkbox("fullwidthSpace", dict.options.fullwidthSpace)}
          {checkbox("collapseSpaces", dict.options.collapseSpaces)}
          {checkbox("trimLines", dict.options.trimLines)}
          {select("blankLines", dict.options.blankLines, [
            ["keep", dict.choices.keep],
            ["collapse", dict.choices.collapse],
            ["remove", dict.choices.remove],
          ])}
          {select("newline", dict.options.newline, [
            ["keep", dict.choices.keep],
            ["lf", "LF"],
            ["crlf", "CRLF"],
            ["cr", "CR"],
          ])}
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{dict.groups.invisible}</legend>
          {checkbox("removeInvisible", dict.options.removeInvisible, dict.options.removeInvisibleHint)}
        </fieldset>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="normalize-input" className="text-sm font-medium">
            {dict.inputLabel}
          </label>
          <Textarea
            id="normalize-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const file = e.dataTransfer.files?.[0];
              if (!file) return;
              e.preventDefault();
              file.text().then(setInput);
            }}
            placeholder={dict.inputPlaceholder}
            spellCheck={false}
            className="min-h-72 text-sm"
          />
          {input.length >= LARGE_TEXT_CHARS && <p className="text-xs text-amber-600 dark:text-amber-400">{dict.largeText}</p>}
          <ToolActions onClear={() => setInput("")} clearDisabled={!input} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="normalize-output" className="text-sm font-medium">
              {dict.outputLabel}
            </label>
            {busy && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                {dict.processing}
              </span>
            )}
          </div>
          <Textarea
            id="normalize-output"
            value={output}
            readOnly
            spellCheck={false}
            placeholder={dict.outputPlaceholder}
            className="min-h-72 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <ToolActions getCopyText={() => output} copyDisabled={!output} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!output}
              onClick={() => downloadBytes(new TextEncoder().encode(output), "normalized.txt", "text/plain")}
            >
              <Download className="size-4" />
              {dict.download}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!output || output === input} onClick={() => setInput(output)}>
              {dict.applyToInput}
            </Button>
          </div>
        </div>
      </div>

      {activeResult && (
        <div className="flex flex-col gap-2" role="status">
          <span className="text-sm font-medium">{dict.summaryHeading}</span>
          {countEntries.length > 0 ? (
            <ul className="flex flex-wrap gap-2 text-xs">
              {countEntries.map(([step, count]) => (
                <li key={step} className="rounded-full border px-2.5 py-1">
                  {dict.steps[step]}: <span className="font-medium tabular-nums">{count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{dict.noChanges}</p>
          )}
        </div>
      )}

      {activeResult && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">
              {formatTemplate(dict.detectionHeading, { count: activeResult.detectionTotal.toLocaleString() })}
            </span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={invisibleCount === 0}
              onClick={() => setInput(normalizeText(input, { ...NO_NORMALIZE_OPTIONS, removeInvisible: true }).text)}
            >
              <Eraser className="size-4" />
              {formatTemplate(dict.removeInvisibleNow, { count: invisibleCount })}
            </Button>
          </div>
          {activeResult.detectionTotal > 0 ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="max-h-80 overflow-auto rounded-md border p-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
                <Visualized text={input} detections={activeResult.detections} label={describe} />
                {input.length > MAX_VISUALIZE_CHARS && (
                  <p className="mt-2 text-xs text-muted-foreground">{formatTemplate(dict.visualizeTruncated, { count: MAX_VISUALIZE_CHARS.toLocaleString() })}</p>
                )}
              </div>
              <div className="max-h-80 overflow-auto rounded-md border">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">{dict.columns.position}</th>
                      <th className="px-2 py-1.5 text-left font-medium">{dict.columns.code}</th>
                      <th className="px-2 py-1.5 text-left font-medium">{dict.columns.kind}</th>
                      <th className="px-2 py-1.5 text-left font-medium">{dict.columns.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeResult.detections.slice(0, MAX_LIST_ITEMS).map((item) => (
                      <tr key={item.index} className="odd:bg-muted/30">
                        <td className="px-2 py-1 tabular-nums">{formatTemplate(dict.positionValue, { line: item.line, column: item.column })}</td>
                        <td className="px-2 py-1 font-mono">{formatCodePoint(item.codePoint)}</td>
                        <td className="px-2 py-1">{dict.kinds[item.kind]}</td>
                        <td className="px-2 py-1 font-mono">{item.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {activeResult.detectionTotal > MAX_LIST_ITEMS && (
                  <p className="p-2 text-xs text-muted-foreground">{formatTemplate(dict.listTruncated, { count: MAX_LIST_ITEMS })}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{dict.noDetections}</p>
          )}
        </div>
      )}

      {activeResult?.diff && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{dict.diffHeading}</span>
          <div className="max-h-[32rem] overflow-auto rounded-md border">
            <table className="w-full border-collapse font-mono text-xs">
              <tbody>
                {activeResult.diff.map((item, index) =>
                  "skipped" in item ? (
                    <tr key={`s${index}`}>
                      <td colSpan={3} className="border-y bg-muted/40 px-3 py-1 text-center text-xs text-muted-foreground">
                        {formatTemplate(dict.skippedLines, { count: item.skipped })}
                      </td>
                    </tr>
                  ) : (
                    <tr key={index} className={LINE_CLASS[item.type]}>
                      <td className="w-10 px-2 py-0.5 text-right text-muted-foreground select-none">{item.oldNumber ?? ""}</td>
                      <td className="w-10 px-2 py-0.5 text-right text-muted-foreground select-none">{item.newNumber ?? ""}</td>
                      <td className="px-2 py-0.5 break-all whitespace-pre-wrap">
                        <span className="mr-2 text-muted-foreground select-none">{item.type === "added" ? "+" : item.type === "removed" ? "-" : " "}</span>
                        {item.segments
                          ? item.segments.map((segment, i) =>
                              segment.changed ? (
                                <mark key={i} className={MARK_CLASS[item.type]}>
                                  {segment.text}
                                </mark>
                              ) : (
                                <span key={i}>{segment.text}</span>
                              )
                            )
                          : item.text || " "}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          {activeResult.diffTruncated && <p className="text-xs text-muted-foreground">{dict.diffTruncated}</p>}
        </div>
      )}
    </div>
  );
}
