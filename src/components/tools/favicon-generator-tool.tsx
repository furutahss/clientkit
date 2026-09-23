"use client";

import * as React from "react";
import { Download, ImageUp, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { createZip, downloadBytes } from "@/lib/download";
import {
  buildHtmlSnippet,
  generateFavicons,
  type FaviconFile,
  type FaviconOptions,
  type ManifestOptions,
} from "@/lib/favicon";
import { formatBytes } from "@/lib/format-bytes";
import { loadImageFromFile } from "@/lib/image-convert";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif,.svg";

/** 1辺がこれより小さい画像は、大きなアイコンがぼやける旨を表示する */
const RECOMMENDED_MIN_SIZE = 512;

type Source = { file: File; image: HTMLImageElement; objectUrl: string };

type Preview = { name: string; size: number; url: string; bytes: number };

const MIME_BY_EXTENSION: Record<string, string> = {
  ico: "image/x-icon",
  png: "image/png",
  json: "application/json",
  html: "text/html",
};

export function FaviconGeneratorTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.faviconGenerator, [locale]);

  const [source, setSource] = React.useState<Source | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [useBackground, setUseBackground] = React.useState(false);
  const [background, setBackground] = React.useState("#ffffff");
  const [padding, setPadding] = React.useState(0);
  const [cornerRadius, setCornerRadius] = React.useState(0);
  const [manifest, setManifest] = React.useState<ManifestOptions>({
    name: "My App",
    shortName: "App",
    themeColor: "#ffffff",
    backgroundColor: "#ffffff",
  });
  const [files, setFiles] = React.useState<FaviconFile[]>([]);
  const [previews, setPreviews] = React.useState<Preview[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const previewsRef = React.useRef<Preview[]>([]);
  const sourceRef = React.useRef<Source | null>(null);

  const handleFile = React.useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".svg")) {
        setLoadError(dict.invalidFileType);
        return;
      }
      setLoadError(null);
      try {
        const { image, objectUrl } = await loadImageFromFile(file);
        setSource((prev) => {
          if (prev) URL.revokeObjectURL(prev.objectUrl);
          return { file, image, objectUrl };
        });
        const baseName = file.name.replace(/\.[^.]+$/, "");
        setManifest((prev) => (prev.name === "My App" ? { ...prev, name: baseName, shortName: baseName.slice(0, 12) } : prev));
      } catch {
        setLoadError(dict.loadError);
      }
    },
    [dict]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("favicon-generator");
    if (!pending) return;
    const timer = window.setTimeout(() => {
      void handleFile(pending);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [handleFile]);

  const options = React.useMemo<FaviconOptions>(
    () => ({
      padding: padding / 100,
      background: useBackground ? background : null,
      cornerRadius: useBackground ? cornerRadius / 100 : 0,
    }),
    [padding, useBackground, background, cornerRadius]
  );

  // 設定の変更に応じてファビコン一式を再生成する
  React.useEffect(() => {
    if (!source) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsGenerating(true);
      setGenerateError(null);
      generateFavicons(source.image, options, manifest)
        .then((generated) => {
          if (cancelled) return;
          setFiles(generated);
          const nextPreviews = generated
            .filter((file) => file.name.endsWith(".png"))
            .map((file) => ({
              name: file.name,
              size: file.size,
              bytes: file.data.length,
              url: URL.createObjectURL(new Blob([file.data as Uint8Array<ArrayBuffer>], { type: "image/png" })),
            }));
          for (const preview of previewsRef.current) URL.revokeObjectURL(preview.url);
          previewsRef.current = nextPreviews;
          setPreviews(nextPreviews);
        })
        .catch(() => {
          if (!cancelled) setGenerateError(dict.generateError);
        })
        .finally(() => {
          if (!cancelled) setIsGenerating(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [source, options, manifest, dict]);

  React.useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  React.useEffect(() => {
    return () => {
      for (const preview of previewsRef.current) URL.revokeObjectURL(preview.url);
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.objectUrl);
    };
  }, []);

  function handleReset() {
    if (source) URL.revokeObjectURL(source.objectUrl);
    for (const preview of previewsRef.current) URL.revokeObjectURL(preview.url);
    previewsRef.current = [];
    setSource(null);
    setFiles([]);
    setPreviews([]);
    setLoadError(null);
    setGenerateError(null);
  }

  async function handleDownloadZip() {
    if (files.length === 0) return;
    try {
      const zip = await createZip(files.map((file) => ({ name: file.name, data: file.data })));
      downloadBytes(zip, "favicons.zip", "application/zip");
    } catch {
      setGenerateError(dict.zipError);
    }
  }

  function handleDownloadFile(file: FaviconFile) {
    const extension = file.name.split(".").pop() ?? "";
    downloadBytes(file.data, file.name, MIME_BY_EXTENSION[extension] ?? "application/octet-stream");
  }

  const snippet = buildHtmlSnippet(manifest.themeColor);
  const sourceWidth = source ? source.image.naturalWidth || 0 : 0;
  const sourceHeight = source ? source.image.naturalHeight || 0 : 0;
  const isSmall = source && sourceWidth > 0 && Math.min(sourceWidth, sourceHeight) < RECOMMENDED_MIN_SIZE;
  const isNotSquare = source && sourceWidth > 0 && sourceWidth !== sourceHeight;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {!source ? (
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
            if (file) void handleFile(file);
          }}
          className={cn(
            "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"
          )}
        >
          <ImageUp className="size-10 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">{dict.dropLabel}</p>
            <p className="text-sm text-muted-foreground">{dict.dropHint}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- ローカルのobject URLをそのまま表示するため */}
              <img src={source.objectUrl} alt={source.file.name} className="size-10 rounded border object-contain" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium break-all">{source.file.name}</span>
                <span className="text-muted-foreground">
                  {sourceWidth > 0 ? `${sourceWidth} x ${sourceHeight} px ・ ` : ""}
                  {formatBytes(source.file.size)}
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="size-4" />
              {dict.processAnother}
            </Button>
          </div>
          {(isSmall || isNotSquare) && (
            <div className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              {isSmall && <span>{formatTemplate(dict.smallImageWarning, { size: RECOMMENDED_MIN_SIZE })}</span>}
              {isNotSquare && <span>{dict.notSquareWarning}</span>}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-lg border p-4">
              <span className="text-sm font-medium">{dict.appearanceHeading}</span>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm">{dict.paddingLabel}</label>
                  <span className="text-sm text-muted-foreground tabular-nums">{padding}%</span>
                </div>
                <Slider value={[padding]} onValueChange={([value]) => setPadding(value)} min={0} max={30} step={1} aria-label={dict.paddingLabel} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="favicon-background"
                  checked={useBackground}
                  onCheckedChange={(checked) => setUseBackground(checked === true)}
                />
                <label htmlFor="favicon-background" className="text-sm">
                  {dict.backgroundLabel}
                </label>
                <input
                  type="color"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  disabled={!useBackground}
                  className="h-7 w-10 cursor-pointer rounded border bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={dict.backgroundColorLabel}
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm">{dict.cornerRadiusLabel}</label>
                  <span className="text-sm text-muted-foreground tabular-nums">{cornerRadius}%</span>
                </div>
                <Slider
                  value={[cornerRadius]}
                  onValueChange={([value]) => setCornerRadius(value)}
                  min={0}
                  max={50}
                  step={1}
                  disabled={!useBackground}
                  aria-label={dict.cornerRadiusLabel}
                />
                {!useBackground && <p className="text-xs text-muted-foreground">{dict.cornerRadiusHint}</p>}
              </div>
              <p className="text-xs text-muted-foreground">{dict.appleTouchHint}</p>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <span className="text-sm font-medium">{dict.manifestHeading}</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  {dict.appNameLabel}
                  <Input value={manifest.name} onChange={(e) => setManifest((prev) => ({ ...prev, name: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  {dict.shortNameLabel}
                  <Input value={manifest.shortName} onChange={(e) => setManifest((prev) => ({ ...prev, shortName: e.target.value }))} />
                </label>
                <label className="flex items-center justify-between gap-2 text-sm">
                  {dict.themeColorLabel}
                  <input
                    type="color"
                    value={manifest.themeColor}
                    onChange={(e) => setManifest((prev) => ({ ...prev, themeColor: e.target.value }))}
                    className="h-7 w-10 cursor-pointer rounded border bg-transparent"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-sm">
                  {dict.backgroundColorManifestLabel}
                  <input
                    type="color"
                    value={manifest.backgroundColor}
                    onChange={(e) => setManifest((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                    className="h-7 w-10 cursor-pointer rounded border bg-transparent"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                {dict.previewHeading}
                {isGenerating && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </span>
              <Button type="button" onClick={() => void handleDownloadZip()} disabled={files.length === 0 || isGenerating}>
                <Download className="size-4" />
                {dict.downloadZip}
              </Button>
            </div>
            {generateError && <p className="text-sm text-destructive">{generateError}</p>}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {previews.map((preview) => (
                <li key={preview.name} className="flex flex-col items-center gap-2 rounded-lg border p-3">
                  <div className="flex size-24 items-center justify-center rounded-md bg-[repeating-conic-gradient(#0000000d_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 生成したアイコンのobject URLを表示するため */}
                    <img
                      src={preview.url}
                      alt={preview.name}
                      width={Math.min(preview.size, 96)}
                      height={Math.min(preview.size, 96)}
                      className="[image-rendering:auto]"
                    />
                  </div>
                  <span className="text-center font-mono text-[11px] break-all">{preview.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {preview.size}px ・ {formatBytes(preview.bytes)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => {
                      const file = files.find((item) => item.name === preview.name);
                      if (file) handleDownloadFile(file);
                    }}
                  >
                    <Download className="size-3.5" />
                    {dict.downloadOne}
                  </Button>
                </li>
              ))}
            </ul>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files
                  .filter((file) => !file.name.endsWith(".png"))
                  .map((file) => (
                    <Button key={file.name} type="button" variant="outline" size="sm" onClick={() => handleDownloadFile(file)}>
                      <Download className="size-4" />
                      {file.name}
                    </Button>
                  ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="favicon-snippet" className="text-sm font-medium">
              {dict.snippetLabel}
            </label>
            <Textarea id="favicon-snippet" value={snippet} readOnly spellCheck={false} className="min-h-32 font-mono text-xs" />
            <ToolActions getCopyText={() => snippet} />
          </div>
        </div>
      )}

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
    </div>
  );
}
