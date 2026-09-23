"use client";

import * as React from "react";
import { Download, FileUp, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { downloadBytes } from "@/lib/download";
import { formatBytes } from "@/lib/format-bytes";
import {
  getSvgSize,
  optimizeSvg,
  renderSvgToPng,
  type SvgOptimizeOptions,
  type SvgOptimizeResult,
} from "@/lib/svg-tools";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

/** PNG出力の1辺の最大ピクセル数（ブラウザのCanvasの上限を考慮） */
const MAX_PNG_SIZE = 8192;

const byteLength = (text: string) => new TextEncoder().encode(text).length;

function svgDataUrl(source: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

export function SvgOptimizerTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.svgOptimizer, [locale]);

  const [input, setInput] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [options, setOptions] = React.useState<SvgOptimizeOptions>({
    precision: 3,
    removeDimensions: false,
    pretty: false,
  });
  const [result, setResult] = React.useState<SvgOptimizeResult | null>(null);
  const [isOptimizing, setIsOptimizing] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [pngWidth, setPngWidth] = React.useState(512);
  const [pngHeight, setPngHeight] = React.useState(512);
  const [keepRatio, setKeepRatio] = React.useState(true);
  const [pngBackground, setPngBackground] = React.useState<string | null>(null);
  const [pngError, setPngError] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const deferredInput = React.useDeferredValue(input);

  const loadFile = React.useCallback(
    (file: File) => {
      setFileError(null);
      file
        .text()
        .then((text) => {
          setInput(text);
          setFileName(file.name);
        })
        .catch(() => setFileError(dict.fileReadError));
    },
    [dict]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("svg-optimizer");
    if (pending) Promise.resolve().then(() => loadFile(pending));
  }, [loadFile]);

  React.useEffect(() => {
    if (!deferredInput.trim()) {
      const timer = window.setTimeout(() => setResult(null), 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsOptimizing(true);
      optimizeSvg(deferredInput, options)
        .then((next) => {
          if (!cancelled) setResult(next);
        })
        .catch(() => {
          if (!cancelled) setResult({ ok: false, message: dict.optimizeError, line: null, column: null });
        })
        .finally(() => {
          if (!cancelled) setIsOptimizing(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deferredInput, options, dict]);

  const intrinsicSize = React.useMemo(
    () => (deferredInput.trim() ? getSvgSize(deferredInput) : null),
    [deferredInput]
  );

  // SVGを読み込んだら、PNGの出力サイズを元のサイズに合わせる
  React.useEffect(() => {
    if (!intrinsicSize) return;
    const timer = window.setTimeout(() => {
      setPngWidth(Math.min(MAX_PNG_SIZE, Math.round(intrinsicSize.width)));
      setPngHeight(Math.min(MAX_PNG_SIZE, Math.round(intrinsicSize.height)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [intrinsicSize]);

  const optimized = result?.ok ? result.data : "";
  const originalBytes = byteLength(deferredInput);
  const optimizedBytes = optimized ? byteLength(optimized) : 0;
  const reduction = optimized && originalBytes > 0 ? Math.round((1 - optimizedBytes / originalBytes) * 1000) / 10 : null;

  const ratio = intrinsicSize ? intrinsicSize.height / intrinsicSize.width : 1;

  function clampSize(value: number): number {
    return Math.min(MAX_PNG_SIZE, Math.max(1, Math.round(value) || 1));
  }

  function handleWidthChange(value: number) {
    const width = clampSize(value);
    setPngWidth(width);
    if (keepRatio) setPngHeight(clampSize(width * ratio));
  }

  function handleHeightChange(value: number) {
    const height = clampSize(value);
    setPngHeight(height);
    if (keepRatio) setPngWidth(clampSize(height / ratio));
  }

  function applyScale(scale: number) {
    if (!intrinsicSize) return;
    setPngWidth(clampSize(intrinsicSize.width * scale));
    setPngHeight(clampSize(intrinsicSize.height * scale));
  }

  const baseName = fileName ? fileName.replace(/\.svg$/i, "") : "image";

  async function handleExportPng() {
    const source = optimized || deferredInput;
    if (!source) return;
    setIsExporting(true);
    setPngError(null);
    try {
      const blob = await renderSvgToPng(source, pngWidth, pngHeight, pngBackground);
      downloadBytes(blob, `${baseName}-${pngWidth}x${pngHeight}.png`, "image/png");
    } catch {
      setPngError(dict.pngError);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="svg-input" className="text-sm font-medium">
              {dict.inputLabel}
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="size-4" />
              {dict.openFile}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFile(file);
                e.target.value = "";
              }}
            />
          </div>
          <Textarea
            id="svg-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setFileName(null);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const file = e.dataTransfer.files?.[0];
              if (!file) return;
              e.preventDefault();
              loadFile(file);
            }}
            placeholder={dict.inputPlaceholder}
            spellCheck={false}
            className="min-h-72 font-mono text-xs"
          />
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          <ToolActions
            onClear={() => {
              setInput("");
              setFileName(null);
            }}
            clearDisabled={!input}
          />

          <div className="flex flex-col gap-3 rounded-md border p-3">
            <span className="text-sm font-medium">{dict.optionsHeading}</span>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm">{dict.precisionLabel}</label>
                <span className="text-sm text-muted-foreground tabular-nums">{options.precision}</span>
              </div>
              <Slider
                value={[options.precision]}
                onValueChange={([value]) => setOptions((prev) => ({ ...prev, precision: value }))}
                min={0}
                max={6}
                step={1}
                aria-label={dict.precisionLabel}
              />
              <p className="text-xs text-muted-foreground">{dict.precisionHint}</p>
            </div>
            {(
              [
                ["removeDimensions", dict.removeDimensions],
                ["pretty", dict.pretty],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`svg-${key}`}
                  checked={options[key]}
                  onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, [key]: checked === true }))}
                />
                <label htmlFor={`svg-${key}`} className="text-sm">
                  {label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="svg-output" className="flex items-center gap-2 text-sm font-medium">
              {dict.outputLabel}
              {isOptimizing && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 p-2">
              <span className="text-xs text-muted-foreground">{dict.originalSize}</span>
              <span className="font-semibold tabular-nums">{deferredInput ? formatBytes(originalBytes) : "-"}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 p-2">
              <span className="text-xs text-muted-foreground">{dict.optimizedSize}</span>
              <span className="font-semibold tabular-nums">{optimized ? formatBytes(optimizedBytes) : "-"}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 p-2">
              <span className="text-xs text-muted-foreground">{dict.reduction}</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  reduction !== null &&
                    (reduction >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")
                )}
              >
                {reduction === null ? "-" : `${reduction >= 0 ? "-" : "+"}${Math.abs(reduction)}%`}
              </span>
            </div>
          </div>
          <Textarea
            id="svg-output"
            value={optimized}
            readOnly
            placeholder={dict.outputPlaceholder}
            spellCheck={false}
            className="min-h-48 font-mono text-xs"
          />
          {result && !result.ok && (
            <p className="text-sm text-destructive">
              {result.line !== null
                ? formatTemplate(dict.parseErrorAt, { line: result.line, column: result.column ?? 1, message: result.message })
                : formatTemplate(dict.parseError, { message: result.message })}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <ToolActions getCopyText={() => optimized} copyDisabled={!optimized} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!optimized}
              onClick={() => downloadBytes(new TextEncoder().encode(optimized), `${baseName}.min.svg`, "image/svg+xml")}
            >
              <Download className="size-4" />
              {dict.downloadSvg}
            </Button>
          </div>
          {optimized && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: dict.previewOriginal, source: deferredInput },
                { label: dict.previewOptimized, source: optimized },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <div className="flex h-36 items-center justify-center overflow-hidden rounded-md border bg-[repeating-conic-gradient(#0000000d_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- SVGをimg要素で表示し、スクリプトを実行させないため */}
                    <img src={svgDataUrl(item.source)} alt={item.label} className="max-h-full max-w-full object-contain" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <span className="text-sm font-medium">{dict.pngHeading}</span>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {dict.widthLabel}
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PNG_SIZE}
              value={pngWidth}
              onChange={(e) => handleWidthChange(Number(e.target.value))}
              className="h-8 w-28 text-right"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {dict.heightLabel}
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PNG_SIZE}
              value={pngHeight}
              onChange={(e) => handleHeightChange(Number(e.target.value))}
              className="h-8 w-28 text-right"
            />
          </label>
          <div className="flex items-center gap-2 pb-1.5">
            <Checkbox id="svg-keep-ratio" checked={keepRatio} onCheckedChange={(checked) => setKeepRatio(checked === true)} />
            <label htmlFor="svg-keep-ratio" className="text-sm">
              {dict.keepRatio}
            </label>
          </div>
          <div className="flex gap-1 pb-0.5">
            {[1, 2, 4].map((scale) => (
              <Button
                key={scale}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyScale(scale)}
                disabled={!intrinsicSize}
              >
                {scale}x
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 pb-1.5">
            <Checkbox
              id="svg-png-background"
              checked={pngBackground !== null}
              onCheckedChange={(checked) => setPngBackground(checked === true ? "#ffffff" : null)}
            />
            <label htmlFor="svg-png-background" className="text-sm">
              {dict.backgroundLabel}
            </label>
            {pngBackground !== null && (
              <input
                type="color"
                value={pngBackground}
                onChange={(e) => setPngBackground(e.target.value)}
                className="h-7 w-10 cursor-pointer rounded border bg-transparent"
                aria-label={dict.backgroundLabel}
              />
            )}
          </div>
        </div>
        {!intrinsicSize && deferredInput.trim() && (
          <p className="text-xs text-muted-foreground">{dict.noIntrinsicSize}</p>
        )}
        <Button
          type="button"
          className="w-fit"
          onClick={() => void handleExportPng()}
          disabled={!deferredInput.trim() || (result !== null && !result.ok) || isExporting}
        >
          {isExporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {formatTemplate(dict.downloadPng, { width: pngWidth, height: pngHeight })}
        </Button>
        {pngError && <p className="text-sm text-destructive">{pngError}</p>}
      </div>
    </div>
  );
}
