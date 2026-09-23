"use client";

import * as React from "react";
import { Download, FileText, FileUp, Loader2, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { downloadBytes } from "@/lib/download";
import { formatBytes } from "@/lib/format-bytes";
import {
  MASK_CATEGORIES,
  maskSensitiveData,
  type MaskCategory,
  type MaskResult,
  type MaskStyle,
} from "@/lib/sensitive-mask";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

type LoadedFile = { name: string; size: number; text: string };

/** 出力プレビューに表示する最大文字数（ダウンロードには全体が含まれる） */
const MAX_PREVIEW_CHARS = 200_000;

function maskedFileName(name: string, format: MaskResult["format"]): string {
  const index = name.lastIndexOf(".");
  const base = index > 0 ? name.slice(0, index) : name;
  const ext = index > 0 ? name.slice(index) : format === "text" ? ".txt" : ".json";
  return `${base}_masked${ext}`;
}

export function LogMaskerTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.logMasker, [locale]);

  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<LoadedFile | null>(null);
  const [categories, setCategories] = React.useState<Set<MaskCategory>>(
    () => new Set(MASK_CATEGORIES)
  );
  const [style, setStyle] = React.useState<MaskStyle>("label");
  const [customTerms, setCustomTerms] = React.useState("");
  const [result, setResult] = React.useState<MaskResult | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const source = file ? file.text : text;
  const deferredSource = React.useDeferredValue(source);
  const deferredCustomTerms = React.useDeferredValue(customTerms);

  const loadFile = React.useCallback(
    (selected: File) => {
      setFileError(null);
      selected
        .text()
        .then((content) => {
          setFile({ name: selected.name, size: selected.size, text: content });
        })
        .catch(() => setFileError(dict.fileReadError));
    },
    [dict]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("log-masker");
    if (pending) Promise.resolve().then(() => loadFile(pending));
  }, [loadFile]);

  React.useEffect(() => {
    if (!deferredSource) {
      const timer = window.setTimeout(() => setResult(null), 0);
      return () => window.clearTimeout(timer);
    }
    // 大きなファイルでも入力中の操作を妨げないよう、描画後に処理する
    const showSpinner = window.setTimeout(() => setIsProcessing(true), 0);
    const timer = window.setTimeout(() => {
      setResult(
        maskSensitiveData(deferredSource, {
          categories,
          style,
          customTerms: deferredCustomTerms.split(/\r?\n|,/),
        })
      );
      setIsProcessing(false);
    }, 30);
    return () => {
      window.clearTimeout(showSpinner);
      window.clearTimeout(timer);
    };
  }, [deferredSource, categories, style, deferredCustomTerms]);

  function toggleCategory(category: MaskCategory, checked: boolean) {
    setCategories((prev) => {
      const next = new Set(prev);
      if (checked) next.add(category);
      else next.delete(category);
      return next;
    });
  }

  function handleClear() {
    setText("");
    setFile(null);
    setFileError(null);
    setResult(null);
  }

  function handleDownload() {
    if (!result) return;
    const name = file
      ? maskedFileName(file.name, result.format)
      : result.format === "text"
        ? "masked.txt"
        : result.format === "har"
          ? "masked.har"
          : "masked.json";
    downloadBytes(
      new TextEncoder().encode(result.output),
      name,
      result.format === "text" ? "text/plain" : "application/json"
    );
  }

  const totalMasked = result
    ? Object.values(result.counts).reduce((sum, count) => sum + count, 0)
    : 0;
  const preview =
    result && result.output.length > MAX_PREVIEW_CHARS
      ? result.output.slice(0, MAX_PREVIEW_CHARS)
      : (result?.output ?? "");

  const STYLE_OPTIONS: { value: MaskStyle; label: string }[] = [
    { value: "label", label: dict.styleLabel },
    { value: "asterisk", label: dict.styleAsterisk },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="log-masker-input" className="text-sm font-medium">
              {dict.inputLabel}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="size-4" />
              {dict.openFile}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".har,.json,.log,.txt,text/plain,application/json"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) loadFile(selected);
                e.target.value = "";
              }}
            />
          </div>
          {file ? (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-md border p-6 text-center">
              <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium break-all">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setFile(null)}>
                <X className="size-4" />
                {dict.closeFile}
              </Button>
            </div>
          ) : (
            <Textarea
              id="log-masker-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragActive(true);
              }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={(e) => {
                const dropped = e.dataTransfer.files?.[0];
                setIsDragActive(false);
                if (!dropped) return;
                e.preventDefault();
                loadFile(dropped);
              }}
              placeholder={dict.inputPlaceholder}
              spellCheck={false}
              className={cn(
                "min-h-80 font-mono text-sm",
                isDragActive && "border-primary bg-primary/5"
              )}
            />
          )}
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          <ToolActions onClear={handleClear} clearDisabled={!text && !file} />
        </div>

        <div className="flex flex-col gap-4 rounded-lg border p-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{dict.targetsHeading}</span>
            <div className="flex flex-col gap-2">
              {MASK_CATEGORIES.map((category) => (
                <div key={category} className="flex items-start gap-2">
                  <Checkbox
                    id={`mask-${category}`}
                    checked={categories.has(category)}
                    onCheckedChange={(checked) => toggleCategory(category, checked === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor={`mask-${category}`} className="flex flex-1 flex-col gap-0.5 text-sm">
                    <span className="flex items-center justify-between gap-2">
                      <span>{dict.categories[category].label}</span>
                      {result && categories.has(category) && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatTemplate(dict.detectedCount, { count: result.counts[category] })}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {dict.categories[category].description}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {categories.has("custom") && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mask-custom-terms" className="text-sm font-medium">
                {dict.customTermsLabel}
              </label>
              <Textarea
                id="mask-custom-terms"
                value={customTerms}
                onChange={(e) => setCustomTerms(e.target.value)}
                placeholder={dict.customTermsPlaceholder}
                spellCheck={false}
                className="min-h-20 font-mono text-sm"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{dict.styleHeading}</span>
            <div className="inline-flex w-fit rounded-md border p-1">
              {STYLE_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStyle(item.value)}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                    style === item.value
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{dict.outputLabel}</span>
            {isProcessing && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            {result && (
              <span className="text-muted-foreground">
                {formatTemplate(dict.resultSummary, {
                  count: totalMasked,
                  format: dict.formats[result.format],
                })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handleDownload} disabled={!result}>
              <Download className="size-4" />
              {dict.download}
            </Button>
            <ToolActions getCopyText={() => result?.output ?? ""} copyDisabled={!result} />
          </div>
        </div>
        <Textarea
          value={preview}
          readOnly
          placeholder={dict.outputPlaceholder}
          spellCheck={false}
          className="min-h-80 font-mono text-sm"
          aria-label={dict.outputLabel}
        />
        {result && result.output.length > MAX_PREVIEW_CHARS && (
          <p className="text-xs text-muted-foreground">{dict.previewTruncated}</p>
        )}
        {result && totalMasked === 0 && (
          <p className="text-xs text-muted-foreground">{dict.nothingFound}</p>
        )}
        <p className="text-xs text-muted-foreground">{dict.reviewNote}</p>
      </div>
    </div>
  );
}
