"use client";

import * as React from "react";
import { Download, Film, Loader2, Play, RefreshCw, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { downloadBytes } from "@/lib/download";
import { formatBytes } from "@/lib/format-bytes";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";
import {
  estimateGifBytes,
  estimateRemaining,
  fitDimensions,
  formatClock,
  frameTimestamps,
  reductionLabel,
  sizeWarning,
  type DitherMode,
  type PaletteMode,
} from "@/lib/video-convert";
import type { CompressRequest, VideoErrorCode, VideoInfo, VideoProgress } from "@/lib/video-convert.worker";
import { WorkerCancelledError, WorkerClient, WorkerTaskError } from "@/lib/worker-client";

type Mode = "gif" | "compress";
type Result = { url: string; bytes: Uint8Array; kind: "gif" | "mp4" | "webm"; elapsed: number };

const ACCEPT = "video/*,.mp4,.mov,.m4v,.webm,.mkv,.avi";
const GIF_WIDTHS = [240, 320, 480, 640, 800];
const HEIGHTS = ["original", "1080", "720", "480", "360"] as const;
const FPS_OPTIONS = ["original", "30", "24", "15"] as const;
const LOOP_OPTIONS: [string, number][] = [
  ["infinite", 0],
  ["once", -1],
  ["twice", 1],
  ["three", 2],
];

function createWorker() {
  return new Worker(new URL("../../lib/video-convert.worker.ts", import.meta.url), { type: "module" });
}

function isMobile(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

export function VideoConverterTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.videoConverter, [locale]);

  const [file, setFile] = React.useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<VideoInfo | null>(null);
  const [probing, setProbing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("gif");
  const [range, setRange] = React.useState<[number, number]>([0, 0]);

  const [fps, setFps] = React.useState(12);
  const [gifWidth, setGifWidth] = React.useState(480);
  const [loop, setLoop] = React.useState(0);
  const [palette, setPalette] = React.useState<PaletteMode>("global");
  const [dither, setDither] = React.useState<DitherMode>("floyd-steinberg");

  const [format, setFormat] = React.useState<"mp4" | "webm">("mp4");
  const [quality, setQuality] = React.useState<CompressRequest["quality"]>("medium");
  const [useTarget, setUseTarget] = React.useState(false);
  const [targetMb, setTargetMb] = React.useState(10);
  const [maxHeight, setMaxHeight] = React.useState<(typeof HEIGHTS)[number]>("720");
  const [outFps, setOutFps] = React.useState<(typeof FPS_OPTIONS)[number]>("original");
  const [audio, setAudio] = React.useState<"keep" | "remove">("keep");
  const [audioBitrate, setAudioBitrate] = React.useState("128000");

  const [progress, setProgress] = React.useState<{ value: number; startedAt: number; now: number } | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);

  const clientRef = React.useRef<WorkerClient | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const getClient = () => (clientRef.current ??= new WorkerClient(createWorker));

  // 終了時に Worker と Object URL を確実に解放する
  React.useEffect(() => () => clientRef.current?.cancel(), []);
  React.useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);
  React.useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  const describeError = React.useCallback(
    (e: unknown) => dict.errors[(e instanceof WorkerTaskError ? e.code : "failed") as VideoErrorCode] ?? dict.errors.failed,
    [dict]
  );

  const loadFile = React.useCallback(
    async (next: File) => {
      clientRef.current?.cancel();
      setError(null);
      setResult(null);
      setInfo(null);
      setProgress(null);
      setFile(next);
      setSourceUrl(URL.createObjectURL(next));
      setProbing(true);
      try {
        const probed = await getClient().request<VideoInfo>({ type: "probe", file: next });
        if (!probed.canDecode) throw new WorkerTaskError("cannotDecode");
        setInfo(probed);
        setRange([0, Math.min(probed.duration, 5)]);
        setGifWidth(Math.min(480, probed.width - (probed.width % 2)));
      } catch (e) {
        if (!(e instanceof WorkerCancelledError)) setError(describeError(e));
      } finally {
        setProbing(false);
      }
    },
    [describeError]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("video-converter");
    if (pending) Promise.resolve().then(() => loadFile(pending));
  }, [loadFile]);

  // 処理中は経過時間の表示を更新する
  const running = progress !== null;
  React.useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setProgress((prev) => (prev ? { ...prev, now: Date.now() } : prev)), 500);
    return () => window.clearInterval(timer);
  }, [running]);

  function reset() {
    clientRef.current?.cancel();
    setFile(null);
    setSourceUrl(null);
    setInfo(null);
    setResult(null);
    setProgress(null);
    setError(null);
  }

  async function run() {
    if (!file || !info) return;
    setError(null);
    setResult(null);
    const startedAt = Date.now();
    setProgress({ value: 0, startedAt, now: startedAt });
    const [start, end] = range;
    const onProgress = (p: VideoProgress) => setProgress((prev) => (prev ? { ...prev, value: p.progress, now: Date.now() } : prev));
    try {
      const message =
        mode === "gif"
          ? { type: "gif", file, start, end, fps, width: gifWidth, loop, palette, dither }
          : {
              type: "compress",
              file,
              format,
              quality,
              targetBytes: useTarget ? Math.round(targetMb * 1024 * 1024) : null,
              maxHeight: maxHeight === "original" ? null : Number(maxHeight),
              fps: outFps === "original" ? null : Number(outFps),
              audio,
              audioBitrate: Number(audioBitrate),
              start,
              end,
            };
      const bytes = await getClient().request<Uint8Array, VideoProgress>(message, [], onProgress);
      const kind = mode === "gif" ? "gif" : format;
      const mime = kind === "gif" ? "image/gif" : `video/${kind}`;
      setResult({
        url: URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime })),
        bytes,
        kind,
        elapsed: (Date.now() - startedAt) / 1000,
      });
      // デコーダー・エンコーダーのメモリを解放するため、処理が終わったら Worker を終了する
      clientRef.current?.cancel();
    } catch (e) {
      if (!(e instanceof WorkerCancelledError)) setError(describeError(e));
    } finally {
      setProgress(null);
    }
  }

  function cancel() {
    clientRef.current?.cancel();
    setProgress(null);
  }

  const duration = info?.duration ?? 0;
  const [start, end] = range;
  const clipLength = Math.max(0, end - start);
  const gifSize = info ? fitDimensions(info.width, info.height, gifWidth) : null;
  const gifFrames = frameTimestamps(start, end, fps).length;
  const warning = file && info ? sizeWarning(file.size, duration, isMobile()) : null;
  const elapsed = progress ? (progress.now - progress.startedAt) / 1000 : 0;
  const remaining = progress ? estimateRemaining(elapsed, progress.value) : null;
  const busy = progress !== null;

  const select = <T extends string>(id: string, label: string, value: T, onChange: (value: T) => void, options: [T, string][], disabled = false) => (
    <div className="flex flex-col gap-1.5">
      <label id={`video-${id}-label`} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={(next) => onChange(next as T)} disabled={disabled}>
        <SelectTrigger className="w-full" aria-labelledby={`video-${id}-label`}>
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
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

      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <div className="flex items-center gap-3">
            <Film className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium break-all">{file.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatBytes(file.size)}
                {info &&
                  ` ・ ${info.width}×${info.height} ・ ${formatClock(info.duration)} ・ ${[info.videoCodec, info.audioCodec].filter(Boolean).join(" / ")}`}
                {probing && ` ・ ${dict.probing}`}
              </span>
            </div>
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
          <Film className="size-8 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{dict.dropLabel}</p>
            <p className="text-xs text-muted-foreground">{dict.dropHint}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Film className="size-4" />
            {dict.chooseFile}
          </Button>
        </div>
      )}

      {warning && <p className="text-sm text-amber-600 dark:text-amber-400">{dict.warnings[warning]}</p>}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {info && sourceUrl && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="flex min-w-0 flex-col gap-3">
            <video ref={videoRef} src={sourceUrl} controls playsInline className="max-h-96 w-full rounded-md bg-black" />
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <span className="text-sm font-medium">{dict.trimLabel}</span>
              <Slider
                min={0}
                max={duration}
                step={0.1}
                value={range}
                minStepsBetweenThumbs={1}
                onValueChange={(value) => setRange([value[0], value[1]] as [number, number])}
                aria-label={dict.trimLabel}
              />
              <div className="flex flex-wrap items-end gap-3">
                {(
                  [
                    ["start", dict.start, 0],
                    ["end", dict.end, 1],
                  ] as const
                ).map(([id, label, index]) => (
                  <div key={id} className="flex flex-col gap-1">
                    <label htmlFor={`video-${id}`} className="text-xs text-muted-foreground">
                      {label}
                    </label>
                    <div className="flex items-center gap-1">
                      <Input
                        id={`video-${id}`}
                        type="number"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={Number(range[index].toFixed(1))}
                        onChange={(e) => {
                          const value = Math.min(duration, Math.max(0, Number(e.target.value) || 0));
                          setRange((prev) => (index === 0 ? [Math.min(value, prev[1]), prev[1]] : [prev[0], Math.max(value, prev[0])]));
                        }}
                        className="w-24"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const t = videoRef.current?.currentTime ?? 0;
                          setRange((prev) => (index === 0 ? [Math.min(t, prev[1]), prev[1]] : [prev[0], Math.max(t, prev[0])]));
                        }}
                      >
                        {dict.useCurrentTime}
                      </Button>
                    </div>
                  </div>
                ))}
                <span className="pb-2 text-xs text-muted-foreground tabular-nums">
                  {formatTemplate(dict.clipLength, { seconds: clipLength.toFixed(1) })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex h-fit flex-col gap-4 rounded-md border p-3">
            <div role="tablist" aria-label={dict.modeLabel} className="inline-flex w-fit rounded-md border p-1">
              {(["gif", "compress"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={mode === item}
                  onClick={() => setMode(item)}
                  className={cn(
                    "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                    mode === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item === "gif" ? dict.modeGif : dict.modeCompress}
                </button>
              ))}
            </div>

            {mode === "gif" ? (
              <>
                <div className="flex flex-col gap-2">
                  <label className="flex justify-between text-xs text-muted-foreground">
                    <span>{dict.fps}</span>
                    <span className="tabular-nums">{fps} fps</span>
                  </label>
                  <Slider min={5} max={30} step={1} value={[fps]} onValueChange={([value]) => setFps(value)} aria-label={dict.fps} />
                </div>
                {select(
                  "gif-width",
                  dict.width,
                  String(gifWidth),
                  (value) => setGifWidth(Number(value)),
                  GIF_WIDTHS.filter((w) => w <= info.width).map((w) => [String(w), `${w}px`] as [string, string]).concat(
                    GIF_WIDTHS.includes(gifWidth) ? [] : [[String(gifWidth), `${gifWidth}px`]]
                  )
                )}
                {select(
                  "loop",
                  dict.loop,
                  String(loop),
                  (value) => setLoop(Number(value)),
                  LOOP_OPTIONS.map(([key, value]) => [String(value), dict.loops[key as keyof typeof dict.loops]] as [string, string])
                )}
                {select("palette", dict.palette, palette, setPalette, [
                  ["global", dict.paletteGlobal],
                  ["perFrame", dict.palettePerFrame],
                ])}
                {select("dither", dict.dither, dither, setDither, [
                  ["floyd-steinberg", dict.ditherFloyd],
                  ["bayer", dict.ditherBayer],
                  ["none", dict.ditherNone],
                ])}
                {gifSize && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatTemplate(dict.gifEstimate, {
                      width: gifSize.width,
                      height: gifSize.height,
                      frames: gifFrames,
                      size: formatBytes(estimateGifBytes(gifSize.width, gifSize.height, gifFrames)),
                    })}
                  </p>
                )}
              </>
            ) : (
              <>
                {select("format", dict.format, format, setFormat, [
                  ["mp4", "MP4 (H.264)"],
                  ["webm", "WebM (VP9)"],
                ])}
                <div className="inline-flex w-fit rounded-md border p-1" role="radiogroup" aria-label={dict.qualityMode}>
                  {[false, true].map((value) => (
                    <button
                      key={String(value)}
                      type="button"
                      role="radio"
                      aria-checked={useTarget === value}
                      onClick={() => setUseTarget(value)}
                      className={cn(
                        "rounded-sm px-2.5 py-1 text-xs font-medium",
                        useTarget === value ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
                      )}
                    >
                      {value ? dict.byTargetSize : dict.byQuality}
                    </button>
                  ))}
                </div>
                {useTarget ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="video-target" className="text-xs text-muted-foreground">
                      {dict.targetSize}
                    </label>
                    <Input
                      id="video-target"
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={targetMb}
                      onChange={(e) => setTargetMb(Math.max(0.5, Number(e.target.value) || 0.5))}
                      className="w-28"
                    />
                    <p className="text-xs text-muted-foreground">{dict.targetHint}</p>
                  </div>
                ) : (
                  select("quality", dict.quality, quality, setQuality, [
                    ["low", dict.qualities.low],
                    ["medium", dict.qualities.medium],
                    ["high", dict.qualities.high],
                    ["veryHigh", dict.qualities.veryHigh],
                  ])
                )}
                {select(
                  "height",
                  dict.resolution,
                  maxHeight,
                  setMaxHeight,
                  HEIGHTS.map((h) => [h, h === "original" ? dict.original : `${h}p`] as [(typeof HEIGHTS)[number], string])
                )}
                {select(
                  "fps-out",
                  dict.frameRate,
                  outFps,
                  setOutFps,
                  FPS_OPTIONS.map((f) => [f, f === "original" ? dict.original : `${f} fps`] as [(typeof FPS_OPTIONS)[number], string])
                )}
                {select("audio", dict.audio, audio, setAudio, [
                  ["keep", dict.audioKeep],
                  ["remove", dict.audioRemove],
                ])}
                {audio === "keep" &&
                  select("audio-bitrate", dict.audioBitrate, audioBitrate, setAudioBitrate, [
                    ["64000", "64 kbps"],
                    ["96000", "96 kbps"],
                    ["128000", "128 kbps"],
                    ["192000", "192 kbps"],
                  ])}
                <p className="text-xs text-muted-foreground">{dict.compressNote}</p>
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={run} disabled={busy || clipLength <= 0}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                {mode === "gif" ? dict.runGif : dict.runCompress}
              </Button>
              {busy && (
                <Button type="button" variant="outline" onClick={cancel}>
                  <X className="size-4" />
                  {dict.cancel}
                </Button>
              )}
            </div>
            {progress && (
              <div className="flex flex-col gap-1.5" role="status">
                <progress className="h-2 w-full accent-primary" max={1} value={progress.value} />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatTemplate(dict.progress, {
                    percent: Math.round(progress.value * 100),
                    elapsed: formatClock(elapsed),
                    remaining: remaining === null ? "—" : formatClock(remaining),
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {result && file && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <span className="text-sm font-medium">{dict.resultLabel}</span>
          {result.kind === "gif" ? (
            // eslint-disable-next-line @next/next/no-img-element -- ブラウザ内で生成したGIFをObject URLで表示する
            <img src={result.url} alt={dict.resultLabel} className="max-h-96 w-fit max-w-full rounded-md" />
          ) : (
            <video src={result.url} controls playsInline className="max-h-96 w-full rounded-md bg-black" />
          )}
          <p className="text-sm tabular-nums">
            {formatTemplate(dict.resultSize, {
              size: formatBytes(result.bytes.length),
              original: formatBytes(file.size),
              rate: reductionLabel(file.size, result.bytes.length),
              seconds: result.elapsed.toFixed(1),
            })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() =>
              downloadBytes(
                result.bytes,
                `${file.name.replace(/\.[^.]+$/, "")}${result.kind === "gif" ? "" : "-compressed"}.${result.kind}`,
                result.kind === "gif" ? "image/gif" : `video/${result.kind}`
              )
            }
          >
            <Download className="size-4" />
            {dict.download}
          </Button>
        </div>
      )}
    </div>
  );
}
