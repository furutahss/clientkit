"use client";

import * as React from "react";
import { AlertTriangle, ArrowLeftRight, Download, FileUp, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import {
  convertData,
  detectFormatFromFileName,
  loadFormatLibraries,
  type DataFormat,
} from "@/lib/data-format";
import { downloadBytes } from "@/lib/download";
import { useLazyModule } from "@/lib/lazy-module";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

const FORMATS: DataFormat[] = ["json", "yaml", "toml"];

const FORMAT_LABELS: Record<DataFormat, string> = {
  json: "JSON",
  yaml: "YAML",
  toml: "TOML",
};

const MIME_TYPES: Record<DataFormat, string> = {
  json: "application/json",
  yaml: "application/yaml",
  toml: "application/toml",
};

function FormatSwitch({
  value,
  onChange,
  label,
}: {
  value: DataFormat;
  onChange: (value: DataFormat) => void;
  label: string;
}) {
  return (
    <div className="inline-flex w-fit rounded-md border p-1" role="group" aria-label={label}>
      {FORMATS.map((format) => (
        <button
          key={format}
          type="button"
          onClick={() => onChange(format)}
          aria-pressed={value === format}
          className={cn(
            "rounded-sm px-3 py-1 text-sm font-medium transition-colors",
            value === format
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {FORMAT_LABELS[format]}
        </button>
      ))}
    </div>
  );
}

export function DataFormatConverterTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.dataFormatConverter;

  const [input, setInput] = React.useState("");
  const [from, setFrom] = React.useState<DataFormat>("yaml");
  const [to, setTo] = React.useState<DataFormat>("json");
  const [indent, setIndent] = React.useState(2);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { module: libraries, error: libraryError } = useLazyModule(loadFormatLibraries);
  const deferredInput = React.useDeferredValue(input);

  const loadFile = React.useCallback(
    (file: File) => {
      setFileError(null);
      file
        .text()
        .then((text) => {
          const detected = detectFormatFromFileName(file.name);
          if (detected) {
            setFrom(detected);
            setTo((prev) => (prev === detected ? (detected === "json" ? "yaml" : "json") : prev));
          }
          setFileName(file.name);
          setInput(text);
        })
        .catch(() => setFileError(dict.fileReadError));
    },
    [dict]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("data-format-converter");
    if (pending) Promise.resolve().then(() => loadFile(pending));
  }, [loadFile]);

  const result = React.useMemo(() => {
    if (!deferredInput.trim() || !libraries) return null;
    return convertData(libraries, deferredInput, from, to, indent);
  }, [libraries, deferredInput, from, to, indent]);

  function handleSwap() {
    if (result?.ok) setInput(result.output);
    setFrom(to);
    setTo(from);
    setFileName(null);
  }

  function handleFromChange(format: DataFormat) {
    setFrom(format);
    if (format === to) setTo(from);
  }

  function handleToChange(format: DataFormat) {
    setTo(format);
    if (format === from) setFrom(to);
  }

  function handleDownload() {
    if (!result?.ok) return;
    const base = fileName ? fileName.replace(/\.[^.]+$/, "") : "converted";
    const extension = to === "yaml" ? "yaml" : to;
    downloadBytes(new TextEncoder().encode(result.output), `${base}.${extension}`, MIME_TYPES[to]);
  }

  const errorInfo = result && !result.ok ? result.error : null;
  const errorSnippet = React.useMemo(() => {
    if (!errorInfo?.line) return null;
    const lines = deferredInput.split("\n");
    const start = Math.max(1, errorInfo.line - 2);
    const end = Math.min(lines.length, errorInfo.line + 2);
    const snippet: { number: number; text: string }[] = [];
    for (let number = start; number <= end; number += 1) {
      snippet.push({ number, text: lines[number - 1] ?? "" });
    }
    return snippet;
  }, [errorInfo, deferredInput]);

  function errorMessage(): string | null {
    if (!result || result.ok) return null;
    if (result.stage === "stringify") {
      return result.error.message === "toml-root"
        ? dict.tomlRootError
        : formatTemplate(dict.stringifyError, { format: FORMAT_LABELS[to], message: result.error.message });
    }
    if (result.error.line !== null) {
      return formatTemplate(dict.parseErrorAt, {
        format: FORMAT_LABELS[from],
        line: result.error.line,
        column: result.error.column ?? 1,
        message: result.error.message,
      });
    }
    return formatTemplate(dict.parseError, { format: FORMAT_LABELS[from], message: result.error.message });
  }

  const message = errorMessage();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FormatSwitch value={from} onChange={handleFromChange} label={dict.fromLabel} />
        <Button type="button" variant="outline" size="icon" onClick={handleSwap} aria-label={dict.swap} title={dict.swap}>
          <ArrowLeftRight className="size-4" />
        </Button>
        <FormatSwitch value={to} onChange={handleToChange} label={dict.toLabel} />
        {to !== "toml" && (
          <div className="inline-flex w-fit rounded-md border p-1" role="group" aria-label={dict.indentLabel}>
            {[2, 4].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setIndent(value)}
                aria-pressed={indent === value}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  indent === value
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {formatTemplate(dict.indentOption, { count: value })}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="data-format-input" className="text-sm font-medium">
              {formatTemplate(dict.inputLabel, { format: FORMAT_LABELS[from] })}
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="size-4" />
              {dict.openFile}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml,.toml,application/json,application/yaml,application/toml,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFile(file);
                e.target.value = "";
              }}
            />
          </div>
          <Textarea
            id="data-format-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const file = e.dataTransfer.files?.[0];
              if (!file) return;
              e.preventDefault();
              loadFile(file);
            }}
            placeholder={dict.placeholders[from]}
            spellCheck={false}
            className="min-h-96 font-mono text-sm"
            aria-invalid={result && !result.ok && result.stage === "parse" ? true : undefined}
          />
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          {message && (
            <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-sm text-destructive">{message}</p>
              {errorSnippet && (
                <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-xs">
                  {errorSnippet.map((line) => (
                    <div
                      key={line.number}
                      className={cn(line.number === errorInfo?.line && "bg-destructive/10 text-destructive")}
                    >
                      <span className="mr-3 inline-block w-8 select-none text-right text-muted-foreground">
                        {line.number}
                      </span>
                      {line.text || " "}
                    </div>
                  ))}
                </pre>
              )}
            </div>
          )}
          <ToolActions
            onClear={() => {
              setInput("");
              setFileName(null);
              setFileError(null);
            }}
            clearDisabled={!input}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="data-format-output" className="text-sm font-medium">
            {formatTemplate(dict.outputLabel, { format: FORMAT_LABELS[to] })}
          </label>
          <Textarea
            id="data-format-output"
            value={result?.ok ? result.output : ""}
            readOnly
            placeholder={
              libraryError
                ? dict.libraryLoadError
                : result && !result.ok
                  ? dict.outputPlaceholderError
                  : dict.outputPlaceholder
            }
            spellCheck={false}
            className="min-h-96 font-mono text-sm"
          />
          {result?.ok &&
            result.warnings.map((warning) => (
              <p
                key={warning}
                className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {warning === "null-dropped" ? dict.warningNullDropped : dict.warningBigint}
              </p>
            ))}
          <div className="flex flex-wrap gap-2">
            <ToolActions getCopyText={() => (result?.ok ? result.output : "")} copyDisabled={!result?.ok} />
            <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={!result?.ok}>
              <Download className="size-4" />
              {dict.download}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
