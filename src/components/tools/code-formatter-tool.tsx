"use client";

import * as React from "react";
import { AlertTriangle, Download, FileCode, Loader2, ShieldCheck, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import {
  canMinify,
  DEFAULT_FORMAT_OPTIONS,
  DEFAULT_MINIFY_OPTIONS,
  detectLanguage,
  languageFromFileName,
  reductionRate,
  type CodeLanguage,
  type CssDialect,
  type ErrorLocation,
  type FormatMode,
  type FormatOptions,
  type MinifyOptions,
} from "@/lib/code-format";
import type { CodeFormatResult } from "@/lib/code-format.worker";
import { downloadBytes } from "@/lib/download";
import { formatBytes } from "@/lib/format-bytes";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";
import { WorkerCancelledError, WorkerClient, WorkerTaskError } from "@/lib/worker-client";

const LANGUAGES: { id: CodeLanguage; label: string }[] = [
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
];
const EXTENSIONS: Record<CodeLanguage, string> = { html: "html", css: "css", javascript: "js", typescript: "ts" };
const ACCEPT = ".html,.htm,.vue,.svelte,.css,.scss,.less,.js,.mjs,.cjs,.jsx,.ts,.mts,.cts,.tsx";
const LARGE_INPUT_BYTES = 2 * 1024 * 1024;

function createWorker() {
  return new Worker(new URL("../../lib/code-format.worker.ts", import.meta.url), { type: "module" });
}

export function CodeFormatterTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.codeFormatter, [locale]);

  const [code, setCode] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [language, setLanguage] = React.useState<CodeLanguage>("html");
  const [dialect, setDialect] = React.useState<CssDialect>("css");
  const [mode, setMode] = React.useState<FormatMode>("format");
  const [format, setFormat] = React.useState<FormatOptions>(DEFAULT_FORMAT_OPTIONS);
  const [minify, setMinify] = React.useState<MinifyOptions>(DEFAULT_MINIFY_OPTIONS);
  const [result, setResult] = React.useState<CodeFormatResult | null>(null);
  const [error, setError] = React.useState<ErrorLocation | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [detectMessage, setDetectMessage] = React.useState<string | null>(null);

  const clientRef = React.useRef<WorkerClient | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const seq = React.useRef(0);
  const runningRef = React.useRef(false);

  const minifyAvailable = canMinify(language, dialect);
  const effectiveMode: FormatMode = minifyAvailable ? mode : "format";

  React.useEffect(() => () => clientRef.current?.cancel(), []);

  const loadFile = React.useCallback(async (file: File) => {
    const detected = languageFromFileName(file.name);
    if (detected) {
      setLanguage(detected.language);
      setDialect(detected.dialect);
    }
    setFileName(file.name);
    setCode(await file.text());
  }, []);

  React.useEffect(() => {
    const pending = takePendingToolFile("code-formatter");
    if (pending) Promise.resolve().then(() => loadFile(pending));
  }, [loadFile]);

  // 入力・設定が変わったら、少し待ってから Worker で処理する（実行中の処理は中断する）
  React.useEffect(() => {
    const current = ++seq.current;
    if (!code.trim()) return;
    const timer = window.setTimeout(() => {
      // 前の処理が終わっていなければ Worker ごと中断する（終わっていれば読み込み済みのライブラリを再利用する）
      if (runningRef.current) clientRef.current?.cancel();
      clientRef.current ??= new WorkerClient(createWorker);
      runningRef.current = true;
      setBusy(true);
      clientRef.current
        .request<CodeFormatResult>({ code, language, dialect, mode: effectiveMode, format, minify })
        .then((next) => {
          if (current !== seq.current) return;
          setResult(next);
          setError(null);
        })
        .catch((e) => {
          if (current !== seq.current || e instanceof WorkerCancelledError) return;
          setResult(null);
          try {
            setError(e instanceof WorkerTaskError ? (JSON.parse(e.code) as ErrorLocation) : { message: String(e) });
          } catch {
            setError({ message: dict.unknownError });
          }
        })
        .finally(() => {
          if (current !== seq.current) return;
          runningRef.current = false;
          setBusy(false);
        });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [code, language, dialect, effectiveMode, format, minify, dict]);

  function handleDetect() {
    const detected = detectLanguage(code);
    if (!detected) {
      setDetectMessage(dict.detectFailed);
      return;
    }
    setLanguage(detected.language);
    setDialect(detected.dialect);
    const label = detected.language === "css" && detected.dialect !== "css" ? detected.dialect.toUpperCase() : LANGUAGES.find((l) => l.id === detected.language)!.label;
    setDetectMessage(formatTemplate(dict.detected, { language: label }));
  }

  const output = code.trim() ? (result?.output ?? "") : "";
  const showStats = !!code.trim() && !!result;
  const inputBytes = new Blob([code]).size;
  const updateFormat = (patch: Partial<FormatOptions>) => setFormat((prev) => ({ ...prev, ...patch }));
  const updateMinify = (patch: Partial<MinifyOptions>) => setMinify((prev) => ({ ...prev, ...patch }));

  const checkbox = (id: string, checked: boolean, onChange: (value: boolean) => void, label: string, hint?: string, danger = false) => (
    <div className="flex items-start gap-2">
      <Checkbox id={`code-${id}`} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <label htmlFor={`code-${id}`} className="text-sm">
        {label}
        {hint && (
          <span className={cn("block text-xs", danger ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
            {danger && <AlertTriangle className="mr-1 inline size-3" aria-hidden="true" />}
            {hint}
          </span>
        )}
      </label>
    </div>
  );

  const select = <T extends string>(id: string, label: string, value: T, onChange: (value: T) => void, options: [T, string][]) => (
    <div className="flex flex-col gap-1.5">
      <label id={`code-${id}-label`} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger className="w-full" aria-labelledby={`code-${id}-label`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const isJs = language === "javascript" || language === "typescript";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label={dict.languageLabel} className="inline-flex w-fit flex-wrap rounded-md border p-1">
          {LANGUAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={language === item.id}
              onClick={() => setLanguage(item.id)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                language === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {language === "css" && (
          <div className="w-32">
            <Select value={dialect} onValueChange={(value) => setDialect(value as CssDialect)}>
              <SelectTrigger className="w-full" aria-label={dict.dialectLabel}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="css">CSS</SelectItem>
                <SelectItem value="scss">SCSS</SelectItem>
                <SelectItem value="less">Less</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="inline-flex w-fit rounded-md border p-1" role="radiogroup" aria-label={dict.modeLabel}>
          {(["format", "minify"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={effectiveMode === item}
              disabled={item === "minify" && !minifyAvailable}
              onClick={() => setMode(item)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                effectiveMode === item ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item === "format" ? dict.modeFormat : dict.modeMinify}
            </button>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleDetect} disabled={!code.trim()}>
          <Wand2 className="size-4" />
          {dict.detect}
        </Button>
        {detectMessage && (
          <span className="text-xs text-muted-foreground" role="status">
            {detectMessage}
          </span>
        )}
      </div>
      {!minifyAvailable && <p className="text-xs text-muted-foreground">{dict.minifyUnavailable}</p>}

      <div className="grid grid-cols-2 gap-3 rounded-md border p-3 sm:grid-cols-3 lg:grid-cols-4">
        {effectiveMode === "format" ? (
          <>
            {select("indent", dict.indent, format.indent, (indent) => updateFormat({ indent }), [
              ["2", dict.indent2],
              ["4", dict.indent4],
              ["tab", dict.indentTab],
            ])}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="code-print-width" className="text-xs text-muted-foreground">
                {dict.printWidth}
              </label>
              <Input
                id="code-print-width"
                type="number"
                min={20}
                max={320}
                value={format.printWidth}
                onChange={(e) => updateFormat({ printWidth: Number(e.target.value) })}
              />
            </div>
            {isJs && (
              <>
                {select("quote", dict.quote, format.singleQuote ? "single" : "double", (value) => updateFormat({ singleQuote: value === "single" }), [
                  ["double", dict.quoteDouble],
                  ["single", dict.quoteSingle],
                ])}
                {select("trailing-comma", dict.trailingComma, format.trailingComma, (trailingComma) => updateFormat({ trailingComma }), [
                  ["all", dict.trailingAll],
                  ["es5", dict.trailingEs5],
                  ["none", dict.trailingNone],
                ])}
                {checkbox("semi", format.semi, (semi) => updateFormat({ semi }), dict.semi)}
              </>
            )}
            {language === "html" && (
              <>
                {select("whitespace", dict.htmlWhitespace, format.htmlWhitespace, (htmlWhitespace) => updateFormat({ htmlWhitespace }), [
                  ["css", dict.whitespaceCss],
                  ["strict", dict.whitespaceStrict],
                  ["ignore", dict.whitespaceIgnore],
                ])}
                {checkbox("attr-per-line", format.attributePerLine, (attributePerLine) => updateFormat({ attributePerLine }), dict.attributePerLine)}
              </>
            )}
          </>
        ) : (
          <>
            {checkbox("comments", minify.removeComments, (removeComments) => updateMinify({ removeComments }), dict.removeComments, dict.removeCommentsHint)}
            {language === "javascript" && (
              <>
                {checkbox("mangle", minify.mangle, (mangle) => updateMinify({ mangle }), dict.mangle)}
                {checkbox("console", minify.dropConsole, (dropConsole) => updateMinify({ dropConsole }), dict.dropConsole, dict.dropConsoleHint, true)}
              </>
            )}
            {language === "css" &&
              checkbox("restructure", minify.restructure, (restructure) => updateMinify({ restructure }), dict.restructure, dict.restructureHint)}
            {language === "html" && (
              <>
                {checkbox("embedded", minify.minifyEmbedded, (minifyEmbedded) => updateMinify({ minifyEmbedded }), dict.minifyEmbedded)}
                {checkbox(
                  "attr-quotes",
                  minify.removeAttributeQuotes,
                  (removeAttributeQuotes) => updateMinify({ removeAttributeQuotes }),
                  dict.removeAttributeQuotes,
                  dict.dangerHint,
                  true
                )}
                {checkbox(
                  "optional-tags",
                  minify.removeOptionalTags,
                  (removeOptionalTags) => updateMinify({ removeOptionalTags }),
                  dict.removeOptionalTags,
                  dict.dangerHint,
                  true
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="code-input" className="text-sm font-medium">
              {dict.inputLabel}
              {fileName && <span className="ml-2 text-xs font-normal text-muted-foreground">{fileName}</span>}
            </label>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void loadFile(file);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
              <FileCode className="size-4" />
              {dict.chooseFile}
            </Button>
          </div>
          <Textarea
            id="code-input"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setDetectMessage(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={(e) => {
              const file = e.dataTransfer.files?.[0];
              setIsDragActive(false);
              if (!file) return;
              e.preventDefault();
              void loadFile(file);
            }}
            placeholder={dict.inputPlaceholder}
            spellCheck={false}
            wrap="off"
            className={cn("min-h-96 font-mono text-xs", isDragActive && "border-primary bg-primary/5")}
          />
          {inputBytes >= LARGE_INPUT_BYTES && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{formatTemplate(dict.largeInput, { size: formatBytes(inputBytes) })}</p>
          )}
          <ToolActions
            onClear={() => {
              setCode("");
              setFileName(null);
              setResult(null);
              setError(null);
            }}
            clearDisabled={!code}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="code-output" className="text-sm font-medium">
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
            id="code-output"
            value={output}
            readOnly
            spellCheck={false}
            wrap="off"
            placeholder={dict.outputPlaceholder}
            className="min-h-96 font-mono text-xs"
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error.line
                ? formatTemplate(dict.errorAt, { line: error.line, column: error.column ?? 1, message: error.message })
                : formatTemplate(dict.error, { message: error.message })}
            </p>
          )}
          {showStats && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatTemplate(dict.stats, {
                before: formatBytes(result.inputBytes),
                after: formatBytes(result.outputBytes),
                rate: reductionRate(result.inputBytes, result.outputBytes),
                gzipBefore: formatBytes(result.inputGzip),
                gzipAfter: formatBytes(result.outputGzip),
                gzipRate: reductionRate(result.inputGzip, result.outputGzip),
              })}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <ToolActions getCopyText={() => output} copyDisabled={!output} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!output}
              onClick={() => {
                const ext = language === "css" ? dialect : EXTENSIONS[language];
                const base = (fileName ?? "code").replace(/\.[^.]+$/, "");
                downloadBytes(new TextEncoder().encode(output), `${base}${effectiveMode === "minify" ? ".min" : ""}.${ext}`, "text/plain");
              }}
            >
              <Download className="size-4" />
              {dict.download}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
