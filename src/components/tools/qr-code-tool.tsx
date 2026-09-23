"use client";

import * as React from "react";
import { AlertTriangle, Download, ImageUp, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { contrastRatio, parseHex, relativeLuminance } from "@/lib/color";
import { downloadBytes } from "@/lib/download";
import { loadImageFromFile } from "@/lib/image-convert";
import {
  decodeQrFromImage,
  generateQrMatrix,
  renderQrToCanvas,
  renderQrToSvg,
  type ErrorCorrectionLevel,
  type QrMatrix,
} from "@/lib/qr-code";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

type Tab = "generate" | "read";

const LEVELS: ErrorCorrectionLevel[] = ["L", "M", "Q", "H"];

/** これ未満のコントラスト比だと読み取りにくくなる旨を表示する */
const MIN_CONTRAST = 3;

type ReadState =
  | { status: "idle" }
  | { status: "reading"; objectUrl: string; name: string }
  | { status: "done"; objectUrl: string; name: string; text: string | null };

export function QrCodeTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.qrCode, [locale]);

  const [tab, setTab] = React.useState<Tab>("generate");
  const [text, setText] = React.useState("https://clientkit.dev");
  const [level, setLevel] = React.useState<ErrorCorrectionLevel>("M");
  const [size, setSize] = React.useState(512);
  const [margin, setMargin] = React.useState(4);
  const [foreground, setForeground] = React.useState("#000000");
  const [background, setBackground] = React.useState("#ffffff");
  const [matrix, setMatrix] = React.useState<QrMatrix | null>(null);
  const [generateError, setGenerateError] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const [readState, setReadState] = React.useState<ReadState>({ status: "idle" });
  const [readError, setReadError] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const readUrlRef = React.useRef<string | null>(null);

  const deferredText = React.useDeferredValue(text);

  React.useEffect(() => {
    if (!deferredText) {
      const timer = window.setTimeout(() => {
        setMatrix(null);
        setGenerateError(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    generateQrMatrix(deferredText, level)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setMatrix(result.matrix);
          setGenerateError(null);
        } else {
          setMatrix(null);
          setGenerateError(result.error === "too-long" ? dict.tooLong : dict.generateError);
        }
      })
      .catch(() => {
        if (!cancelled) setGenerateError(dict.generateError);
      });
    return () => {
      cancelled = true;
    };
  }, [deferredText, level, dict]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewUrl(
        matrix
          ? renderQrToCanvas(matrix, { pixelSize: size, margin, foreground, background }).toDataURL("image/png")
          : null
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [matrix, size, margin, foreground, background]);

  const contrast = React.useMemo(() => {
    const fg = parseHex(foreground);
    const bg = parseHex(background);
    if (!fg || !bg) return null;
    return { ratio: contrastRatio(fg, bg), inverted: relativeLuminance(fg) > relativeLuminance(bg) };
  }, [foreground, background]);

  const handleReadFile = React.useCallback(
    async (file: File) => {
      setTab("read");
      if (!file.type.startsWith("image/")) {
        setReadError(dict.invalidFileType);
        return;
      }
      setReadError(null);
      try {
        const { image, objectUrl } = await loadImageFromFile(file);
        if (readUrlRef.current) URL.revokeObjectURL(readUrlRef.current);
        readUrlRef.current = objectUrl;
        setReadState({ status: "reading", objectUrl, name: file.name });
        const result = await decodeQrFromImage(image);
        setReadState({ status: "done", objectUrl, name: file.name, text: result.ok ? result.text : null });
      } catch {
        setReadError(dict.loadError);
      }
    },
    [dict]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("qr-code");
    if (!pending) return;
    const timer = window.setTimeout(() => {
      void handleReadFile(pending);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [handleReadFile]);

  // 読み取りタブでは、クリップボードから画像を貼り付けて読み取れるようにする
  React.useEffect(() => {
    if (tab !== "read") return;
    function handlePaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((entry) => entry.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void handleReadFile(file);
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [tab, handleReadFile]);

  React.useEffect(() => {
    return () => {
      if (readUrlRef.current) URL.revokeObjectURL(readUrlRef.current);
    };
  }, []);

  function handleDownloadPng() {
    if (!matrix) return;
    renderQrToCanvas(matrix, { pixelSize: size, margin, foreground, background }).toBlob((blob) => {
      if (blob) downloadBytes(blob, "qrcode.png", "image/png");
    }, "image/png");
  }

  function handleDownloadSvg() {
    if (!matrix) return;
    const svg = renderQrToSvg(matrix, { margin, foreground, background });
    downloadBytes(new TextEncoder().encode(svg), "qrcode.svg", "image/svg+xml");
  }

  function handleResetRead() {
    if (readUrlRef.current) URL.revokeObjectURL(readUrlRef.current);
    readUrlRef.current = null;
    setReadState({ status: "idle" });
    setReadError(null);
  }

  const TABS: { value: Tab; label: string }[] = [
    { value: "generate", label: dict.tabGenerate },
    { value: "read", label: dict.tabRead },
  ];

  const decodedText = readState.status === "done" ? readState.text : null;
  const isUrl = decodedText !== null && /^https?:\/\//i.test(decodedText);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="inline-flex w-fit rounded-md border p-1">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              tab === item.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "generate" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="qr-text" className="text-sm font-medium">
                {dict.textLabel}
              </label>
              <Textarea
                id="qr-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={dict.textPlaceholder}
                className="min-h-28"
              />
              <div className="flex items-center justify-between gap-2">
                <ToolActions onClear={() => setText("")} clearDisabled={!text} />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatTemplate(dict.byteCount, { count: new TextEncoder().encode(text).length })}
                </span>
              </div>
              {generateError && <p className="text-sm text-destructive">{generateError}</p>}
            </div>

            <div className="flex flex-col gap-4 rounded-lg border p-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{dict.levelLabel}</span>
                <Select value={level} onValueChange={(value) => setLevel(value as ErrorCorrectionLevel)}>
                  <SelectTrigger className="w-full" aria-label={dict.levelLabel}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {dict.levels[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{dict.sizeLabel}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {size} × {size} px
                  </span>
                </div>
                <Slider value={[size]} onValueChange={([value]) => setSize(value)} min={128} max={2048} step={32} aria-label={dict.sizeLabel} />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{dict.marginLabel}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">{margin}</span>
                </div>
                <Slider value={[margin]} onValueChange={([value]) => setMargin(value)} min={0} max={10} step={1} aria-label={dict.marginLabel} />
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  {dict.foregroundLabel}
                  <input
                    type="color"
                    value={foreground}
                    onChange={(e) => setForeground(e.target.value)}
                    className="h-7 w-10 cursor-pointer rounded border bg-transparent"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  {dict.backgroundLabel}
                  <input
                    type="color"
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    className="h-7 w-10 cursor-pointer rounded border bg-transparent"
                  />
                </label>
              </div>
              {contrast && (contrast.ratio < MIN_CONTRAST || contrast.inverted) && (
                <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {contrast.inverted ? dict.invertedWarning : dict.lowContrastWarning}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
            <div className="flex aspect-square w-full max-w-80 items-center justify-center rounded-md bg-[repeating-conic-gradient(#0000000d_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- 生成したQRコードのdata URLを表示するため
                <img src={previewUrl} alt={dict.previewAlt} className="max-h-full max-w-full [image-rendering:pixelated]" />
              ) : (
                <span className="p-6 text-center text-sm text-muted-foreground">{dict.emptyPreview}</span>
              )}
            </div>
            {matrix && (
              <span className="text-xs text-muted-foreground">
                {formatTemplate(dict.versionInfo, { version: matrix.version, modules: matrix.size })}
              </span>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={handleDownloadPng} disabled={!matrix}>
                <Download className="size-4" />
                {dict.downloadPng}
              </Button>
              <Button type="button" variant="outline" onClick={handleDownloadSvg} disabled={!matrix}>
                <Download className="size-4" />
                {dict.downloadSvg}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleReadFile(file);
              e.target.value = "";
            }}
          />
          {readState.status === "idle" ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragActive(true);
              }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleReadFile(file);
              }}
              className={cn(
                "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"
              )}
            >
              <ImageUp className="size-10 text-muted-foreground" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <p className="font-medium">{dict.readDropLabel}</p>
                <p className="text-sm text-muted-foreground">{dict.readDropHint}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{readState.name}</span>
                  <Button type="button" variant="outline" size="sm" onClick={handleResetRead}>
                    <RefreshCw className="size-4" />
                    {dict.readAnother}
                  </Button>
                </div>
                <div className="flex h-72 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ローカルのobject URLをそのまま表示するため */}
                  <img src={readState.objectUrl} alt={readState.name} className="max-h-full max-w-full object-contain" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{dict.readResultLabel}</span>
                {readState.status === "reading" ? (
                  <p className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {dict.reading}
                  </p>
                ) : decodedText === null ? (
                  <p className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{dict.notFound}</p>
                ) : (
                  <>
                    <Textarea value={decodedText} readOnly className="min-h-40 font-mono text-sm" aria-label={dict.readResultLabel} />
                    {isUrl && <p className="text-xs text-muted-foreground">{dict.urlNote}</p>}
                    <ToolActions getCopyText={() => decodedText} />
                  </>
                )}
              </div>
            </div>
          )}
          {readError && <p className="text-sm text-destructive">{readError}</p>}
        </div>
      )}
    </div>
  );
}
