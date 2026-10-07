"use client";

import * as React from "react";
import { Brush, Download, Eraser, ImagePlus, Loader2, RefreshCw, ShieldCheck, Undo2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { alphaBoundingBox, limitSize, MAX_IMAGE_EDGE, MODEL_SIZE, toModelInput, type MaskAdjustments } from "@/lib/background-removal";
import type { Backend, LoadProgress } from "@/lib/background-removal.worker";
import { downloadBytes } from "@/lib/download";
import { formatBytes } from "@/lib/format-bytes";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";
import { WorkerCancelledError, WorkerClient } from "@/lib/worker-client";

type BackgroundMode = "transparent" | "color" | "blur" | "image";
type BrushMode = "none" | "erase" | "restore";
type Stage = "download" | "init" | "infer";

const ACCEPT = "image/png,image/jpeg,image/webp";
/** モデル（public/models/u2netp.onnx）のおおよそのサイズ */
const MODEL_MB = 4.6;
const LARGE_FILE_BYTES = 30 * 1024 * 1024;
const DEFAULT_ADJUST: MaskAdjustments = { threshold: 0.5, softness: 0.15, grow: 0, feather: 1 };

function createWorker() {
  return new Worker(new URL("../../lib/background-removal.worker.ts", import.meta.url), { type: "module" });
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context(canvas: HTMLCanvasElement) {
  return canvas.getContext("2d", { willReadFrequently: true })!;
}

export function BackgroundRemoverTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.backgroundRemover, [locale]);

  const [file, setFile] = React.useState<File | null>(null);
  const [size, setSize] = React.useState<{ width: number; height: number; original: { width: number; height: number } } | null>(null);
  const [stage, setStage] = React.useState<Stage | null>(null);
  const [download, setDownload] = React.useState<LoadProgress | null>(null);
  const [backend, setBackend] = React.useState<Backend | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [hasMask, setHasMask] = React.useState(false);
  const [adjust, setAdjust] = React.useState<MaskAdjustments>(DEFAULT_ADJUST);
  const [background, setBackground] = React.useState<BackgroundMode>("transparent");
  const [color, setColor] = React.useState("#ffffff");
  const [blurRadius, setBlurRadius] = React.useState(12);
  const [backgroundImage, setBackgroundImage] = React.useState<ImageBitmap | null>(null);
  const [brush, setBrush] = React.useState<BrushMode>("none");
  const [brushSize, setBrushSize] = React.useState(40);
  const [compare, setCompare] = React.useState(50);
  const [autoCrop, setAutoCrop] = React.useState(false);
  const [format, setFormat] = React.useState<"png" | "webp">("png");
  const [renderTick, setRenderTick] = React.useState(0);
  const [historySize, setHistorySize] = React.useState(0);

  const clientRef = React.useRef<WorkerClient | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const bgInputRef = React.useRef<HTMLInputElement>(null);
  const previewRef = React.useRef<HTMLCanvasElement>(null);
  const originalUrlRef = React.useRef<string | null>(null);
  const [originalUrl, setOriginalUrl] = React.useState<string | null>(null);
  /** 元画像・推論マスク・ブラシの修正を保持するキャンバス（作業用の解像度） */
  const layers = React.useRef<{ source: HTMLCanvasElement; mask: HTMLCanvasElement; restore: HTMLCanvasElement; erase: HTMLCanvasElement } | null>(null);
  const history = React.useRef<{ restore: ImageData; erase: ImageData }[]>([]);
  const painting = React.useRef<{ x: number; y: number } | null>(null);

  const getClient = () => (clientRef.current ??= new WorkerClient(createWorker));

  React.useEffect(
    () => () => {
      clientRef.current?.cancel();
      if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    },
    []
  );

  const fail = React.useCallback((e: unknown, message: string) => {
    if (e instanceof WorkerCancelledError) return;
    setError(message);
    setStage(null);
  }, []);

  /** 推論マスクとブラシの修正を合わせた不透明度のキャンバス */
  const combinedMask = React.useCallback(() => {
    const l = layers.current!;
    const combined = makeCanvas(l.mask.width, l.mask.height);
    const ctx = context(combined);
    ctx.drawImage(l.mask, 0, 0);
    ctx.drawImage(l.restore, 0, 0);
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(l.erase, 0, 0);
    return combined;
  }, []);

  /** 背景を合成した結果を描画する */
  const renderResult = React.useCallback(
    (target: HTMLCanvasElement, crop: boolean) => {
      const l = layers.current;
      if (!l) return;
      const mask = combinedMask();
      const subject = makeCanvas(l.source.width, l.source.height);
      const sctx = context(subject);
      sctx.drawImage(l.source, 0, 0);
      sctx.globalCompositeOperation = "destination-in";
      sctx.drawImage(mask, 0, 0);

      const box = crop
        ? alphaBoundingBox(context(mask).getImageData(0, 0, mask.width, mask.height).data.filter((_, i) => i % 4 === 3), mask.width, mask.height, Math.round(Math.max(mask.width, mask.height) * 0.02))
        : null;
      const region = box ?? { x: 0, y: 0, width: subject.width, height: subject.height };
      target.width = region.width;
      target.height = region.height;
      const ctx = context(target);
      ctx.clearRect(0, 0, region.width, region.height);
      ctx.save();
      ctx.translate(-region.x, -region.y);
      if (background === "color") {
        ctx.fillStyle = color;
        ctx.fillRect(region.x, region.y, region.width, region.height);
      } else if (background === "blur") {
        ctx.filter = `blur(${blurRadius}px)`;
        ctx.drawImage(l.source, 0, 0);
        ctx.filter = "none";
      } else if (background === "image" && backgroundImage) {
        const k = Math.max(subject.width / backgroundImage.width, subject.height / backgroundImage.height);
        const w = backgroundImage.width * k;
        const h = backgroundImage.height * k;
        ctx.drawImage(backgroundImage, (subject.width - w) / 2, (subject.height - h) / 2, w, h);
      }
      ctx.drawImage(subject, 0, 0);
      ctx.restore();
    },
    [background, color, blurRadius, backgroundImage, combinedMask]
  );

  // 調整値が変わったら Worker でマスクを作り直す
  React.useEffect(() => {
    if (!hasMask || !layers.current) return;
    const { width, height } = layers.current.source;
    const timer = window.setTimeout(() => {
      getClient()
        .request<Uint8ClampedArray>({ type: "alpha", width, height, adjust })
        .then((alpha) => {
          const l = layers.current;
          if (!l || l.mask.width !== width) return;
          const image = new ImageData(width, height);
          for (let i = 0; i < alpha.length; i++) {
            image.data[i * 4] = 255;
            image.data[i * 4 + 1] = 255;
            image.data[i * 4 + 2] = 255;
            image.data[i * 4 + 3] = alpha[i];
          }
          context(l.mask).putImageData(image, 0, 0);
          setRenderTick((t) => t + 1);
        })
        .catch((e) => fail(e, dict.processError));
    }, 120);
    return () => window.clearTimeout(timer);
  }, [hasMask, adjust, fail, dict]);

  React.useEffect(() => {
    if (hasMask && previewRef.current) renderResult(previewRef.current, false);
  }, [hasMask, renderTick, renderResult]);

  const loadFile = React.useCallback(
    async (next: File) => {
      setError(null);
      if (!ACCEPT.split(",").includes(next.type)) {
        setError(dict.unsupportedType);
        return;
      }
      clientRef.current?.cancel();
      setHasMask(false);
      setBrush("none");
      history.current = [];
      setHistorySize(0);
      let bitmap: ImageBitmap;
      try {
        // EXIF の向きを反映して読み込む
        bitmap = await createImageBitmap(next, { imageOrientation: "from-image" });
      } catch {
        setError(dict.decodeError);
        return;
      }
      const original = { width: bitmap.width, height: bitmap.height };
      const working = limitSize(original.width, original.height);
      const source = makeCanvas(working.width, working.height);
      context(source).drawImage(bitmap, 0, 0, working.width, working.height);
      bitmap.close();
      layers.current = {
        source,
        mask: makeCanvas(working.width, working.height),
        restore: makeCanvas(working.width, working.height),
        erase: makeCanvas(working.width, working.height),
      };
      if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
      const url = await new Promise<string>((resolve) => source.toBlob((blob) => resolve(URL.createObjectURL(blob!)), "image/png"));
      originalUrlRef.current = url;
      setOriginalUrl(url);
      setFile(next);
      setSize({ ...working, original });

      try {
        setStage("download");
        const loaded = await getClient().request<Backend, LoadProgress>({ type: "load" }, [], (progress) => {
          setDownload(progress);
          if (progress.total && progress.loaded >= progress.total) setStage("init");
        });
        setBackend(loaded);
        setStage("infer");
        const small = makeCanvas(MODEL_SIZE, MODEL_SIZE);
        const sctx = context(small);
        sctx.imageSmoothingQuality = "high";
        sctx.drawImage(source, 0, 0, MODEL_SIZE, MODEL_SIZE);
        const input = toModelInput(sctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data);
        await getClient().request({ type: "infer", input }, [input.buffer]);
        setHasMask(true);
        setStage(null);
      } catch (e) {
        fail(e, stageErrorMessage(e));
      }

      function stageErrorMessage(e: unknown) {
        return e instanceof Error && e.message === "load" ? dict.loadError : dict.processError;
      }
    },
    [dict, fail]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("background-remover");
    if (pending) Promise.resolve().then(() => loadFile(pending));
  }, [loadFile]);

  React.useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((entry) => entry.type.startsWith("image/"));
      const pasted = item?.getAsFile();
      if (pasted) {
        e.preventDefault();
        void loadFile(pasted);
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [loadFile]);

  function cancel() {
    clientRef.current?.cancel();
    setStage(null);
    setDownload(null);
  }

  function reset() {
    cancel();
    layers.current = null;
    setFile(null);
    setSize(null);
    setHasMask(false);
    setError(null);
  }

  function toLayerPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const l = layers.current!;
    return { x: ((e.clientX - rect.left) / rect.width) * l.source.width, y: ((e.clientY - rect.top) / rect.height) * l.source.height };
  }

  function paintTo(point: { x: number; y: number }) {
    const l = layers.current;
    if (!l || brush === "none") return;
    const from = painting.current ?? point;
    const radius = (brushSize / 100) * Math.max(l.source.width, l.source.height) * 0.1;
    const stroke = (canvas: HTMLCanvasElement, operation: GlobalCompositeOperation) => {
      const ctx = context(canvas);
      ctx.globalCompositeOperation = operation;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = radius * 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    };
    // 消す・戻すは後から塗った方が優先されるよう、反対側のレイヤーから同じ範囲を取り除く
    stroke(brush === "erase" ? l.erase : l.restore, "source-over");
    stroke(brush === "erase" ? l.restore : l.erase, "destination-out");
    painting.current = point;
    setRenderTick((t) => t + 1);
  }

  function undo() {
    const l = layers.current;
    const last = history.current.pop();
    if (!l || !last) return;
    context(l.restore).putImageData(last.restore, 0, 0);
    context(l.erase).putImageData(last.erase, 0, 0);
    setHistorySize(history.current.length);
    setRenderTick((t) => t + 1);
  }

  async function exportImage() {
    const out = makeCanvas(1, 1);
    renderResult(out, autoCrop);
    const mime = format === "png" ? "image/png" : "image/webp";
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, mime, 0.92));
    if (!blob) return;
    downloadBytes(blob, `${(file?.name ?? "image").replace(/\.[^.]+$/, "")}-nobg.${format}`, mime);
  }

  const busy = stage !== null;
  const downloadPercent = download?.total ? Math.round((download.loaded / download.total) * 100) : null;
  const updateAdjust = (patch: Partial<MaskAdjustments>) => setAdjust((prev) => ({ ...prev, ...patch }));
  const sliderRow = (label: string, value: number, display: string, min: number, max: number, step: number, onChange: (value: number) => void) => (
    <div className="flex flex-col gap-2">
      <span className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{display}</span>
      </span>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} aria-label={label} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{formatTemplate(dict.safetyNote, { size: MODEL_MB })}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) void loadFile(selected);
          e.target.value = "";
        }}
      />

      {file && size ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium break-all">{file.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {size.original.width}×{size.original.height}px ・ {formatBytes(file.size)}
              {backend && ` ・ ${backend === "webgpu" ? "WebGPU" : "WASM (CPU)"}`}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            <RefreshCw className="size-4" />
            {dict.loadAnother}
          </Button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragActive(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) void loadFile(dropped);
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-border"
          )}
        >
          <ImagePlus className="size-8 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{dict.dropLabel}</p>
            <p className="text-xs text-muted-foreground">{dict.dropHint}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <ImagePlus className="size-4" />
            {dict.chooseFile}
          </Button>
        </div>
      )}

      {file && file.size >= LARGE_FILE_BYTES && <p className="text-sm text-amber-600 dark:text-amber-400">{dict.largeFile}</p>}
      {size && (size.original.width > MAX_IMAGE_EDGE || size.original.height > MAX_IMAGE_EDGE) && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {formatTemplate(dict.downscaled, { max: MAX_IMAGE_EDGE, width: size.width, height: size.height })}
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {busy && (
        <div className="flex flex-col gap-2 rounded-md border p-3" role="status">
          <span className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {stage === "download"
              ? download?.cached
                ? dict.stages.cached
                : formatTemplate(dict.stages.download, {
                    loaded: formatBytes(download?.loaded ?? 0),
                    total: download?.total ? formatBytes(download.total) : "?",
                  })
              : dict.stages[stage]}
          </span>
          {stage === "download" && <progress className="h-2 w-full accent-primary" max={100} value={downloadPercent ?? undefined} />}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={cancel}>
            <X className="size-4" />
            {dict.cancel}
          </Button>
        </div>
      )}

      {hasMask && size && originalUrl && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="flex min-w-0 flex-col gap-2">
            <div
              className="relative mx-auto w-fit max-w-full overflow-hidden rounded-md border bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px]"
            >
              <canvas
                ref={previewRef}
                className={cn("block max-h-[32rem] max-w-full", brush !== "none" && "cursor-crosshair touch-none")}
                aria-label={dict.resultAlt}
                role="img"
                onPointerDown={(e) => {
                  if (brush === "none" || !layers.current) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const l = layers.current;
                  history.current.push({
                    restore: context(l.restore).getImageData(0, 0, l.restore.width, l.restore.height),
                    erase: context(l.erase).getImageData(0, 0, l.erase.width, l.erase.height),
                  });
                  if (history.current.length > 20) history.current.shift();
                  setHistorySize(history.current.length);
                  painting.current = null;
                  paintTo(toLayerPoint(e));
                }}
                onPointerMove={(e) => {
                  if (painting.current) paintTo(toLayerPoint(e));
                }}
                onPointerUp={() => {
                  painting.current = null;
                }}
              />
              {brush === "none" && (
                // eslint-disable-next-line @next/next/no-img-element -- 比較用の元画像（ブラウザ内で作成したObject URL）
                <img
                  src={originalUrl}
                  alt={dict.originalAlt}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }}
                />
              )}
            </div>
            {brush === "none" ? (
              <div className="flex flex-col gap-1">
                <Slider min={0} max={100} step={1} value={[compare]} onValueChange={([v]) => setCompare(v)} aria-label={dict.compare} />
                <span className="flex justify-between text-xs text-muted-foreground">
                  <span>{dict.before}</span>
                  <span>{dict.after}</span>
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{brush === "erase" ? dict.brushEraseHint : dict.brushRestoreHint}</p>
            )}
          </div>

          <div className="flex h-fit flex-col gap-4 rounded-md border p-3">
            <div className="flex flex-col gap-1.5">
              <label id="bg-mode-label" className="text-xs text-muted-foreground">
                {dict.backgroundLabel}
              </label>
              <Select value={background} onValueChange={(value) => setBackground(value as BackgroundMode)}>
                <SelectTrigger className="w-full" aria-labelledby="bg-mode-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["transparent", "color", "blur", "image"] as const).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {dict.backgrounds[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {background === "color" && (
              <div className="flex items-center gap-2">
                <label htmlFor="bg-color" className="text-xs text-muted-foreground">
                  {dict.color}
                </label>
                <input
                  id="bg-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
                />
              </div>
            )}
            {background === "blur" && sliderRow(dict.blur, blurRadius, `${blurRadius}px`, 2, 60, 1, setBlurRadius)}
            {background === "image" && (
              <>
                <input
                  ref={bgInputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={async (e) => {
                    const selected = e.target.files?.[0];
                    e.target.value = "";
                    if (!selected) return;
                    try {
                      setBackgroundImage(await createImageBitmap(selected, { imageOrientation: "from-image" }));
                    } catch {
                      setError(dict.decodeError);
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => bgInputRef.current?.click()}>
                  <ImagePlus className="size-4" />
                  {backgroundImage ? dict.changeBackgroundImage : dict.chooseBackgroundImage}
                </Button>
              </>
            )}

            <span className="text-sm font-medium">{dict.refineHeading}</span>
            {sliderRow(dict.threshold, adjust.threshold, adjust.threshold.toFixed(2), 0.05, 0.95, 0.01, (threshold) => updateAdjust({ threshold }))}
            {sliderRow(dict.softness, adjust.softness, adjust.softness.toFixed(2), 0, 0.5, 0.01, (softness) => updateAdjust({ softness }))}
            {sliderRow(dict.grow, adjust.grow, `${adjust.grow > 0 ? "+" : ""}${adjust.grow}px`, -10, 10, 1, (grow) => updateAdjust({ grow }))}
            {sliderRow(dict.feather, adjust.feather, `${adjust.feather}px`, 0, 10, 1, (feather) => updateAdjust({ feather }))}
            <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setAdjust(DEFAULT_ADJUST)}>
              {dict.resetAdjust}
            </Button>

            <span className="text-sm font-medium">{dict.brushHeading}</span>
            <div className="inline-flex w-fit rounded-md border p-1" role="radiogroup" aria-label={dict.brushHeading}>
              {(
                [
                  ["none", dict.brushOff, null],
                  ["erase", dict.brushErase, Eraser],
                  ["restore", dict.brushRestore, Brush],
                ] as const
              ).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={brush === mode}
                  onClick={() => setBrush(mode)}
                  className={cn(
                    "flex items-center gap-1 rounded-sm px-2.5 py-1 text-xs font-medium",
                    brush === mode ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
                  )}
                >
                  {Icon && <Icon className="size-3.5" aria-hidden="true" />}
                  {label}
                </button>
              ))}
            </div>
            {brush !== "none" && sliderRow(dict.brushSize, brushSize, String(brushSize), 5, 100, 1, setBrushSize)}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={undo} disabled={historySize === 0}>
              <Undo2 className="size-4" />
              {dict.undo}
            </Button>

            <div className="flex items-start gap-2">
              <Checkbox id="bg-crop" checked={autoCrop} onCheckedChange={(checked) => setAutoCrop(checked === true)} className="mt-0.5" />
              <label htmlFor="bg-crop" className="text-sm">
                {dict.autoCrop}
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={format} onValueChange={(value) => setFormat(value as "png" | "webp")}>
                <SelectTrigger className="w-24" aria-label={dict.format}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="webp">WebP</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" onClick={exportImage}>
                <Download className="size-4" />
                {dict.download}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{dict.accuracyNote}</p>
          </div>
        </div>
      )}
    </div>
  );
}
