"use client";

import * as React from "react";
import { ArrowLeftRight, ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SafetyNote } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { diffPixels } from "@/lib/image-diff";
import { loadImageFromFile } from "@/lib/image-convert";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

type LoadedImage = { name: string; url: string; width: number; height: number; pixels: Uint8ClampedArray };
type Side = { image?: LoadedImage; error?: "unsupported" | "load" };
type Mode = "slider" | "overlay" | "diff";

const CHECKERBOARD =
  "bg-[conic-gradient(#e5e7eb_25%,#fff_0_50%,#e5e7eb_0_75%,#fff_0)] bg-[length:16px_16px] dark:bg-[conic-gradient(#27272a_25%,#3f3f46_0_50%,#27272a_0_75%,#3f3f46_0)]";

async function loadImage(file: File): Promise<Side> {
  if (!ACCEPTED_TYPES.includes(file.type)) return { error: "unsupported" };
  try {
    const { image, objectUrl } = await loadImageFromFile(file);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("no context");
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return { image: { name: file.name, url: objectUrl, width: canvas.width, height: canvas.height, pixels } };
  } catch {
    return { error: "load" };
  }
}

function ImagePicker({
  label,
  side,
  onFile,
  dict,
}: {
  label: string;
  side: Side;
  onFile: (file: File) => void;
  dict: ReturnType<typeof getDictionary>["tools"]["imageDiff"];
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-dashed p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        e.preventDefault();
        onFile(file);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <ImagePlus className="size-4" />
          {dict.chooseImage}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {side.image ? (
        <p className="break-all text-xs text-muted-foreground">
          {side.image.name} · {side.image.width} × {side.image.height}px
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{dict.dropHint}</p>
      )}
      {side.error && <p className="text-sm text-destructive">{dict.errors[side.error]}</p>}
    </div>
  );
}

export function ImageDiffTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.imageDiff;

  const [before, setBefore] = React.useState<Side>({});
  const [after, setAfter] = React.useState<Side>({});
  const [mode, setMode] = React.useState<Mode>("slider");
  const [position, setPosition] = React.useState(50);
  const [opacity, setOpacity] = React.useState(50);
  const [threshold, setThreshold] = React.useState(0);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // 置き換えた画像・アンマウント時にオブジェクトURLを解放する
  const urls = React.useRef(new Set<string>());
  React.useEffect(() => {
    const set = urls.current;
    return () => set.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const handleFile = React.useCallback((file: File, setter: (side: Side) => void, current: Side) => {
    loadImage(file).then((side) => {
      if (side.image) urls.current.add(side.image.url);
      if (current.image) {
        URL.revokeObjectURL(current.image.url);
        urls.current.delete(current.image.url);
      }
      setter(side.image ? side : { ...side, image: current.image });
    });
  }, []);

  React.useEffect(() => {
    const pending = takePendingToolFile("image-diff");
    if (pending) handleFile(pending, setBefore, {});
  }, [handleFile]);

  const a = before.image;
  const b = after.image;
  const sameSize = !!a && !!b && a.width === b.width && a.height === b.height;

  const diff = React.useMemo(
    () => (a && b && sameSize ? diffPixels(a.pixels, b.pixels, threshold) : null),
    [a, b, sameSize, threshold]
  );

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !diff || !a || mode !== "diff") return;
    canvas.width = a.width;
    canvas.height = a.height;
    canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(diff.data), a.width, a.height), 0, 0);
  }, [diff, a, mode]);

  const MODES: { value: Mode; label: string }[] = [
    { value: "slider", label: dict.modes.slider },
    { value: "overlay", label: dict.modes.overlay },
    { value: "diff", label: dict.modes.diff },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ImagePicker label={dict.beforeLabel} side={before} dict={dict} onFile={(file) => handleFile(file, setBefore, before)} />
        <ImagePicker label={dict.afterLabel} side={after} dict={dict} onFile={(file) => handleFile(file, setAfter, after)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setBefore(after);
            setAfter(before);
          }}
          disabled={!a && !b}
        >
          <ArrowLeftRight className="size-4" />
          {dict.swap}
        </Button>
        <ToolActions
          onClear={() => {
            urls.current.forEach((url) => URL.revokeObjectURL(url));
            urls.current.clear();
            setBefore({});
            setAfter({});
          }}
          clearDisabled={!a && !b}
        />
      </div>

      {!a || !b ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{dict.emptyState}</p>
      ) : !sameSize ? (
        <div className="rounded-lg border border-destructive/40 p-4 text-sm">
          <p className="font-medium text-destructive">{dict.sizeMismatch}</p>
          <p className="mt-1 text-muted-foreground">
            {formatTemplate(dict.sizeDetail, {
              beforeWidth: a.width,
              beforeHeight: a.height,
              afterWidth: b.width,
              afterHeight: b.height,
            })}
          </p>
          <p className="mt-1 text-muted-foreground">{dict.sizeHint}</p>
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex w-fit rounded-md border p-1" role="tablist" aria-label={dict.modeLabel}>
              {MODES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={mode === item.value}
                  onClick={() => setMode(item.value)}
                  className={cn(
                    "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                    mode === item.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {diff && (
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  diff.changedPixels === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                )}
              >
                {diff.changedPixels === 0
                  ? dict.identical
                  : formatTemplate(dict.changedPixels, {
                      count: diff.changedPixels.toLocaleString(),
                      percent: ((diff.changedPixels / diff.totalPixels) * 100).toFixed(2),
                    })}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            {mode === "slider" && (
              <>
                <span className="text-sm">{formatTemplate(dict.sliderLabel, { value: position })}</span>
                <Slider
                  value={[position]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([value]) => setPosition(value)}
                  aria-label={dict.sliderAria}
                  className="max-w-md"
                />
              </>
            )}
            {mode === "overlay" && (
              <>
                <span className="text-sm">{formatTemplate(dict.opacityLabel, { value: opacity })}</span>
                <Slider
                  value={[opacity]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([value]) => setOpacity(value)}
                  aria-label={dict.opacityAria}
                  className="max-w-md"
                />
              </>
            )}
            {mode === "diff" && (
              <>
                <span className="text-sm">{formatTemplate(dict.thresholdLabel, { value: threshold })}</span>
                <Slider
                  value={[threshold]}
                  min={0}
                  max={128}
                  step={1}
                  onValueChange={([value]) => setThreshold(value)}
                  aria-label={dict.thresholdAria}
                  className="max-w-md"
                />
                <span className="text-xs text-muted-foreground">{dict.thresholdHint}</span>
              </>
            )}
          </div>

          <div className="overflow-auto rounded-lg border">
            <div className={cn("relative w-full", CHECKERBOARD)} style={{ aspectRatio: `${a.width} / ${a.height}` }}>
              {mode === "diff" ? (
                <canvas ref={canvasRef} className="absolute inset-0 size-full [image-rendering:pixelated]" aria-label={dict.modes.diff} />
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- ブラウザ内のオブジェクトURLを表示するため */}
                  <img src={a.url} alt={dict.beforeLabel} className="absolute inset-0 size-full" />
                  {/* eslint-disable-next-line @next/next/no-img-element -- ブラウザ内のオブジェクトURLを表示するため */}
                  <img
                    src={b.url}
                    alt={dict.afterLabel}
                    className="absolute inset-0 size-full"
                    style={
                      mode === "slider" ? { clipPath: `inset(0 0 0 ${position}%)` } : { opacity: opacity / 100 }
                    }
                  />
                  {mode === "slider" && (
                    <div
                      className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary"
                      style={{ left: `${position}%` }}
                      aria-hidden="true"
                    />
                  )}
                </>
              )}
            </div>
          </div>
          {mode === "slider" && <p className="text-xs text-muted-foreground">{dict.sliderHint}</p>}
        </section>
      )}
    </div>
  );
}
