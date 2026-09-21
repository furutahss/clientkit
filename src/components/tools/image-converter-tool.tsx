"use client";

import * as React from "react";
import {
  AlertTriangle,
  Download,
  ImageUp,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { formatBytes } from "@/lib/format-bytes";
import {
  convertImage,
  extensionForMimeType,
  loadImageFromFile,
  withExtension,
  type OutputFormat,
} from "@/lib/image-convert";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
];

type SourceImage = {
  file: File;
  image: HTMLImageElement;
  objectUrl: string;
};

export function ImageConverterTool() {
  const locale = useLocale();
  const dict = React.useMemo(
    () => getDictionary(locale).tools.imageConverter,
    [locale]
  );

  const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
    { value: "image/jpeg", label: dict.formatJpeg },
    { value: "image/png", label: dict.formatPng },
    { value: "image/webp", label: dict.formatWebp },
  ];

  function labelForMimeType(mimeType: string): string {
    return FORMAT_OPTIONS.find((option) => option.value === mimeType)?.label ?? mimeType;
  }

  const [source, setSource] = React.useState<SourceImage | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);

  const [format, setFormat] = React.useState<OutputFormat>("image/jpeg");
  const [quality, setQuality] = React.useState(80);
  const [resizeWidth, setResizeWidth] = React.useState<number | null>(null);
  const [resizeHeight, setResizeHeight] = React.useState<number | null>(null);
  const [keepAspectRatio, setKeepAspectRatio] = React.useState(true);

  const [convertedBlob, setConvertedBlob] = React.useState<Blob | null>(null);
  const [convertedUrl, setConvertedUrl] = React.useState<string | null>(null);
  const [isConverting, setIsConverting] = React.useState(false);
  const [convertError, setConvertError] = React.useState<string | null>(null);
  const [unsupportedFormat, setUnsupportedFormat] = React.useState<{
    requested: OutputFormat;
    actual: string;
  } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const requestIdRef = React.useRef(0);

  const resetOutput = React.useCallback(() => {
    setConvertedBlob(null);
    setConvertedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setUnsupportedFormat(null);
  }, []);

  const handleFile = React.useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setLoadError(dict.invalidFileType);
        return;
      }

      setLoadError(null);
      resetOutput();

      try {
        const { image, objectUrl } = await loadImageFromFile(file);
        setSource((prev) => {
          if (prev) URL.revokeObjectURL(prev.objectUrl);
          return { file, image, objectUrl };
        });
        setResizeWidth(image.naturalWidth);
        setResizeHeight(image.naturalHeight);
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : dict.loadErrorGeneric
        );
      }
    },
    [resetOutput, dict]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("image-converter");
    if (pending) Promise.resolve().then(() => handleFile(pending));
  }, [handleFile]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleClear() {
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
    setLoadError(null);
    setConvertError(null);
    setResizeWidth(null);
    setResizeHeight(null);
    setKeepAspectRatio(true);
    setQuality(80);
    setFormat("image/jpeg");
    resetOutput();
  }

  function handleWidthChange(rawWidth: number) {
    if (!source) return;
    const width = Math.min(
      Math.max(1, Math.round(rawWidth)),
      source.image.naturalWidth
    );
    setResizeWidth(width);
    if (keepAspectRatio) {
      const ratio = source.image.naturalHeight / source.image.naturalWidth;
      setResizeHeight(
        Math.min(
          Math.max(1, Math.round(width * ratio)),
          source.image.naturalHeight
        )
      );
    }
  }

  function handleHeightChange(rawHeight: number) {
    if (!source) return;
    const height = Math.min(
      Math.max(1, Math.round(rawHeight)),
      source.image.naturalHeight
    );
    setResizeHeight(height);
    if (keepAspectRatio) {
      const ratio = source.image.naturalWidth / source.image.naturalHeight;
      setResizeWidth(
        Math.min(
          Math.max(1, Math.round(height * ratio)),
          source.image.naturalWidth
        )
      );
    }
  }

  function handleKeepAspectRatioChange(checked: boolean) {
    setKeepAspectRatio(checked);
    if (checked && source && resizeWidth) {
      const ratio = source.image.naturalHeight / source.image.naturalWidth;
      setResizeHeight(
        Math.min(
          Math.max(1, Math.round(resizeWidth * ratio)),
          source.image.naturalHeight
        )
      );
    }
  }

  // フォーマット・画質・リサイズ設定の変更に応じて非同期で圧縮結果を再生成する
  React.useEffect(() => {
    if (!source || !resizeWidth || !resizeHeight) return;

    const requestId = ++requestIdRef.current;

    const timer = window.setTimeout(() => {
      setIsConverting(true);
      setConvertError(null);

      convertImage(source.image, {
        format,
        quality,
        width: resizeWidth,
        height: resizeHeight,
      })
        .then((blob) => {
          if (requestId !== requestIdRef.current) return;
          setConvertedBlob(blob);
          setConvertedUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
          // Canvas.toBlobは要求フォーマットに非対応のブラウザでは
          // 仕様上 image/png に暗黙フォールバックするため、実際の出力を検証する
          setUnsupportedFormat(
            blob.type && blob.type !== format
              ? { requested: format, actual: blob.type }
              : null
          );
        })
        .catch((error: unknown) => {
          if (requestId !== requestIdRef.current) return;
          setConvertError(
            error instanceof Error ? error.message : dict.convertErrorGeneric
          );
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setIsConverting(false);
        });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [source, format, quality, resizeWidth, resizeHeight, dict]);

  const latestUrlsRef = React.useRef({
    sourceUrl: null as string | null,
    convertedUrl: null as string | null,
  });

  React.useEffect(() => {
    latestUrlsRef.current = {
      sourceUrl: source?.objectUrl ?? null,
      convertedUrl,
    };
  }, [source, convertedUrl]);

  React.useEffect(() => {
    return () => {
      const { sourceUrl, convertedUrl: latestConvertedUrl } = latestUrlsRef.current;
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (latestConvertedUrl) URL.revokeObjectURL(latestConvertedUrl);
    };
  }, []);

  function handleDownload() {
    if (!convertedBlob || !source) return;
    const url = convertedUrl ?? URL.createObjectURL(convertedBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = withExtension(
      source.file.name,
      extensionForMimeType(convertedBlob.type)
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const reduction =
    source && convertedBlob
      ? Math.round((1 - convertedBlob.size / source.file.size) * 100)
      : null;

  const isEffectivelyLossless =
    format === "image/png" || unsupportedFormat?.actual === "image/png";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span>{dict.safetyNote}</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={handleInputChange}
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
          onDrop={handleDrop}
          className={cn(
            "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-accent/30"
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
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{source.file.name}</span>
              <span className="text-muted-foreground">
                {source.image.naturalWidth} x {source.image.naturalHeight} px ・{" "}
                {formatBytes(source.file.size)}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleClear}>
              <RefreshCw className="size-4" />
              {dict.processAnother}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-lg border p-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">{dict.outputFormat}</label>
                <Select
                  value={format}
                  onValueChange={(value) => setFormat(value as OutputFormat)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {unsupportedFormat && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {formatTemplate(dict.unsupportedFormatWarning, {
                        requested: labelForMimeType(unsupportedFormat.requested),
                        actual: labelForMimeType(unsupportedFormat.actual),
                      })}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{dict.quality}</label>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {quality}%
                  </span>
                </div>
                <Slider
                  value={[quality]}
                  onValueChange={([value]) => setQuality(value)}
                  min={1}
                  max={100}
                  step={1}
                  disabled={isEffectivelyLossless}
                />
                {isEffectivelyLossless && (
                  <p className="text-xs text-muted-foreground">
                    {dict.qualityLosslessNote}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{dict.resize}</label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="keep-aspect-ratio"
                      checked={keepAspectRatio}
                      onCheckedChange={(checked) =>
                        handleKeepAspectRatioChange(checked === true)
                      }
                    />
                    <label
                      htmlFor="keep-aspect-ratio"
                      className="text-xs text-muted-foreground"
                    >
                      {dict.keepAspectRatio}
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {dict.widthPx}
                    </span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={source.image.naturalWidth}
                      className="h-7 w-24 text-right"
                      value={resizeWidth ?? ""}
                      onChange={(e) => handleWidthChange(Number(e.target.value))}
                    />
                  </div>
                  <Slider
                    value={[resizeWidth ?? source.image.naturalWidth]}
                    onValueChange={([value]) => handleWidthChange(value)}
                    min={1}
                    max={source.image.naturalWidth}
                    step={1}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {dict.heightPx}
                    </span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={source.image.naturalHeight}
                      className="h-7 w-24 text-right"
                      value={resizeHeight ?? ""}
                      onChange={(e) => handleHeightChange(Number(e.target.value))}
                    />
                  </div>
                  <Slider
                    value={[resizeHeight ?? source.image.naturalHeight]}
                    onValueChange={([value]) => handleHeightChange(value)}
                    min={1}
                    max={source.image.naturalHeight}
                    step={1}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-lg border p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 p-2">
                  <span className="text-xs text-muted-foreground">
                    {dict.originalSize}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatBytes(source.file.size)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 p-2">
                  <span className="text-xs text-muted-foreground">
                    {dict.estimatedSize}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {isConverting
                      ? dict.calculating
                      : convertedBlob
                        ? formatBytes(convertedBlob.size)
                        : dict.none}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 p-2">
                  <span className="text-xs text-muted-foreground">{dict.reduction}</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      reduction !== null &&
                        (reduction >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive")
                    )}
                  >
                    {reduction === null
                      ? dict.none
                      : `${reduction >= 0 ? "-" : "+"}${Math.abs(reduction)}%`}
                  </span>
                </div>
              </div>

              {convertError && (
                <p className="text-sm text-destructive">{convertError}</p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {dict.originalPreview}
                  </span>
                  <div className="flex h-40 items-center justify-center overflow-hidden rounded-md border bg-[repeating-conic-gradient(#0000000d_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- ローカルのobject URLをそのまま表示するため */}
                    <img
                      src={source.objectUrl}
                      alt={dict.originalAlt}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {dict.compressedPreview}
                  </span>
                  <div className="flex h-40 items-center justify-center overflow-hidden rounded-md border bg-[repeating-conic-gradient(#0000000d_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                    {convertedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- ローカルのobject URLをそのまま表示するため
                      <img
                        src={convertedUrl}
                        alt={dict.compressedAlt}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {isConverting ? dict.generating : dict.none}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleDownload}
                disabled={!convertedBlob || isConverting}
              >
                <Download className="size-4" />
                {dict.download}
              </Button>
            </div>
          </div>
        </div>
      )}

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
    </div>
  );
}
