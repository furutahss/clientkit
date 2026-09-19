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
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
];

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "image/jpeg", label: "JPEG (.jpg)" },
  { value: "image/png", label: "PNG (.png)" },
  { value: "image/webp", label: "WebP (.webp)" },
];

function labelForMimeType(mimeType: string): string {
  return FORMAT_OPTIONS.find((option) => option.value === mimeType)?.label ?? mimeType;
}

type SourceImage = {
  file: File;
  image: HTMLImageElement;
  objectUrl: string;
};

export function ImageConverterTool() {
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
        setLoadError("画像ファイルを選択してください。");
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
          error instanceof Error
            ? error.message
            : "画像を読み込めませんでした。"
        );
      }
    },
    [resetOutput]
  );

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
            error instanceof Error ? error.message : "画像の変換に失敗しました。"
          );
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setIsConverting(false);
        });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [source, format, quality, resizeWidth, resizeHeight]);

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
        <span>
          サーバーへ画像をアップロードせず、すべてお使いのブラウザ内で処理しているため安全・高速です。
        </span>
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
            <p className="font-medium">
              画像をドラッグ＆ドロップ、またはクリックして選択
            </p>
            <p className="text-sm text-muted-foreground">
              PNG / JPEG / WebP / GIF / BMP / AVIF に対応
            </p>
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
              別の画像を処理
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-lg border p-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">出力フォーマット</label>
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
                      お使いのブラウザは{labelForMimeType(unsupportedFormat.requested)}
                      への変換に対応していないため、代わりに
                      {labelForMimeType(unsupportedFormat.actual)}
                      形式で出力されています。
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">画質（圧縮率）</label>
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
                    PNGはロスレス圧縮のため画質設定は適用されません。サイズを調整したい場合は下のリサイズ設定をご利用ください。
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">リサイズ</label>
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
                      アスペクト比を維持
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      幅 (px)
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
                      高さ (px)
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
                  <span className="text-xs text-muted-foreground">元のサイズ</span>
                  <span className="font-semibold tabular-nums">
                    {formatBytes(source.file.size)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 p-2">
                  <span className="text-xs text-muted-foreground">
                    圧縮後の想定サイズ
                  </span>
                  <span className="font-semibold tabular-nums">
                    {isConverting
                      ? "計算中..."
                      : convertedBlob
                        ? formatBytes(convertedBlob.size)
                        : "-"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 p-2">
                  <span className="text-xs text-muted-foreground">削減率</span>
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
                      ? "-"
                      : `${reduction >= 0 ? "-" : "+"}${Math.abs(reduction)}%`}
                  </span>
                </div>
              </div>

              {convertError && (
                <p className="text-sm text-destructive">{convertError}</p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">元画像</span>
                  <div className="flex h-40 items-center justify-center overflow-hidden rounded-md border bg-[repeating-conic-gradient(#0000000d_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- ローカルのobject URLをそのまま表示するため */}
                    <img
                      src={source.objectUrl}
                      alt="元画像のプレビュー"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    圧縮後プレビュー
                  </span>
                  <div className="flex h-40 items-center justify-center overflow-hidden rounded-md border bg-[repeating-conic-gradient(#0000000d_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                    {convertedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- ローカルのobject URLをそのまま表示するため
                      <img
                        src={convertedUrl}
                        alt="圧縮後画像のプレビュー"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {isConverting ? "生成中..." : "-"}
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
                圧縮画像をダウンロード
              </Button>
            </div>
          </div>
        </div>
      )}

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
    </div>
  );
}
