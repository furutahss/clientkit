"use client";

import * as React from "react";
import type { Worker as TesseractWorker } from "tesseract.js";
import { Download, ImagePlus, Loader2, RefreshCw, RotateCw, ScanText, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { downloadBytes } from "@/lib/download";
import { formatBytes } from "@/lib/format-bytes";
import {
  applyPixelFilters,
  fitScale,
  joinParagraphLines,
  rectFromPoints,
  removeJapaneseSpaces,
  rotatedSize,
  tidyText,
  type PixelFilterOptions,
  type Rect,
} from "@/lib/ocr";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

type Language = "jpn+eng" | "jpn" | "eng" | "jpn_vert";
type Stage = "core" | "lang" | "init" | "recognize";
type Word = { text: string; confidence: number };

const LANGUAGES: Language[] = ["jpn+eng", "jpn", "eng", "jpn_vert"];
/** 各ファイルのおおよそのダウンロードサイズ（MB）。public/vendor/tesseract の実ファイルに合わせる */
const DOWNLOAD_MB = { core: 3.9, jpn: 2.0, eng: 2.9, jpn_vert: 2.0 };
const ACCEPT = "image/png,image/jpeg,image/webp,image/bmp";
const LARGE_FILE_BYTES = 20 * 1024 * 1024;
/** 認識に使う画像の長辺の上限（メモリ不足を防ぐ） */
const MAX_RECOGNIZE_EDGE = 4000;
const MAX_PREVIEW_EDGE = 1200;
const LOW_CONFIDENCE = 60;
const VENDOR = "/vendor/tesseract";

type Settings = PixelFilterOptions & { rotation: number; scale: number };

/** 回転・範囲指定・拡大・画素フィルタを適用したキャンバスを作る。region は回転後の画像に対する割合（0〜1） */
function renderImage(image: HTMLImageElement, settings: Settings, region: Rect | null, maxEdge: number, scale: number) {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const rotated = rotatedSize(w, h, settings.rotation);
  const crop = region
    ? {
        x: region.x * rotated.width,
        y: region.y * rotated.height,
        width: region.width * rotated.width,
        height: region.height * rotated.height,
      }
    : { x: 0, y: 0, ...rotated };
  const k = fitScale(crop.width, crop.height, scale, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * k));
  canvas.height = Math.max(1, Math.round(crop.height * k));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.scale(k, k);
  ctx.translate(-crop.x + rotated.width / 2, -crop.y + rotated.height / 2);
  ctx.rotate((settings.rotation * Math.PI) / 180);
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  if (settings.grayscale || settings.contrast !== 0 || settings.threshold !== null) {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyPixelFilters(data.data, settings);
    ctx.putImageData(data, 0, 0);
  }
  return canvas;
}

function loadImage(file: File): Promise<{ image: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    image.src = url;
  });
}

function stageOf(status: string): Stage | null {
  if (status.includes("core")) return "core";
  if (status.includes("traineddata")) return "lang";
  if (status.includes("initializ")) return "init";
  if (status.includes("recogniz")) return "recognize";
  return null;
}

export function OcrTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.ocr, [locale]);

  const [file, setFile] = React.useState<File | null>(null);
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [language, setLanguage] = React.useState<Language>("jpn+eng");
  const [settings, setSettings] = React.useState<Settings>({
    grayscale: false,
    contrast: 0,
    threshold: null,
    rotation: 0,
    scale: 1,
  });
  const [region, setRegion] = React.useState<Rect | null>(null);
  const [dragRect, setDragRect] = React.useState<Rect | null>(null);
  const [progress, setProgress] = React.useState<{ stage: Stage; value: number } | null>(null);
  const [rawText, setRawText] = React.useState("");
  /** 結果をユーザーが編集した場合の内容（null の場合は後処理を適用した認識結果を表示） */
  const [editedText, setEditedText] = React.useState<string | null>(null);
  const [words, setWords] = React.useState<Word[][]>([]);
  const [removeSpaces, setRemoveSpaces] = React.useState(true);
  const [joinLines, setJoinLines] = React.useState(false);
  const [highlightLow, setHighlightLow] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const previewRef = React.useRef<HTMLCanvasElement>(null);
  const dragStart = React.useRef<{ x: number; y: number } | null>(null);
  const workerRef = React.useRef<{ worker: TesseractWorker; language: Language } | null>(null);
  const runSeq = React.useRef(0);
  const urlRef = React.useRef<string | null>(null);

  const deferredSettings = React.useDeferredValue(settings);

  const terminateWorker = React.useCallback(() => {
    void workerRef.current?.worker.terminate();
    workerRef.current = null;
  }, []);

  React.useEffect(
    () => () => {
      terminateWorker();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [terminateWorker]
  );

  const loadFile = React.useCallback(
    async (next: File) => {
      setError(null);
      if (!ACCEPT.split(",").includes(next.type)) {
        setError(dict.unsupportedType);
        return;
      }
      try {
        const loaded = await loadImage(next);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = loaded.url;
        setFile(next);
        setImage(loaded.image);
        setRegion(null);
        setSettings((prev) => ({ ...prev, rotation: 0 }));
      } catch {
        setError(dict.decodeError);
      }
    },
    [dict]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("ocr");
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

  // 前処理後の画像をプレビューに描画する
  React.useEffect(() => {
    const target = previewRef.current;
    if (!image || !target) return;
    const rendered = renderImage(image, deferredSettings, null, MAX_PREVIEW_EDGE, 1);
    target.width = rendered.width;
    target.height = rendered.height;
    target.getContext("2d")?.drawImage(rendered, 0, 0);
  }, [image, deferredSettings]);

  const processedText = React.useMemo(() => {
    let next = tidyText(rawText);
    if (removeSpaces) next = removeJapaneseSpaces(next);
    if (joinLines) next = joinParagraphLines(next);
    return next;
  }, [rawText, removeSpaces, joinLines]);
  const text = editedText ?? processedText;

  function pointerToFraction(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  }

  async function getWorker(lang: Language, seq: number) {
    if (workerRef.current?.language === lang) return workerRef.current.worker;
    terminateWorker();
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker(lang.split("+"), 1, {
      workerPath: new URL(`${VENDOR}/worker.min.js`, window.location.origin).href,
      corePath: new URL(`${VENDOR}/core`, window.location.origin).href,
      langPath: new URL(`${VENDOR}/lang`, window.location.origin).href,
      logger: (m) => {
        const stage = stageOf(m.status);
        if (stage && seq === runSeq.current) setProgress({ stage, value: m.progress });
      },
    });
    await worker.setParameters({
      tessedit_pageseg_mode: lang === "jpn_vert" ? PSM.SINGLE_BLOCK_VERT_TEXT : PSM.AUTO,
      preserve_interword_spaces: "1",
    });
    if (seq !== runSeq.current) {
      void worker.terminate();
      throw new Error("cancelled");
    }
    workerRef.current = { worker, language: lang };
    return worker;
  }

  async function handleRecognize() {
    if (!image) return;
    const seq = ++runSeq.current;
    setError(null);
    setProgress({ stage: "core", value: 0 });
    try {
      const canvas = renderImage(image, settings, region, MAX_RECOGNIZE_EDGE, settings.scale);
      const worker = await getWorker(language, seq);
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      if (seq !== runSeq.current) return;
      const lines: Word[][] = [];
      for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            lines.push(line.words.map((word) => ({ text: word.text, confidence: word.confidence })));
          }
        }
      }
      setWords(lines);
      setRawText(data.text);
      setEditedText(null);
      if (!data.text.trim()) setError(dict.noTextFound);
    } catch {
      if (seq === runSeq.current) {
        terminateWorker();
        setError(dict.recognizeError);
      }
    } finally {
      if (seq === runSeq.current) setProgress(null);
    }
  }

  function handleCancel() {
    runSeq.current++;
    terminateWorker();
    setProgress(null);
  }

  function reset() {
    handleCancel();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setFile(null);
    setImage(null);
    setRegion(null);
    setRawText("");
    setEditedText(null);
    setWords([]);
    setError(null);
  }

  const downloadMb =
    DOWNLOAD_MB.core + language.split("+").reduce((sum, lang) => sum + DOWNLOAD_MB[lang as keyof typeof DOWNLOAD_MB], 0);
  const busy = progress !== null;
  const shownRect = dragRect ?? region;
  const update = (patch: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...patch }));

  const checkbox = (id: string, checked: boolean, onChange: (value: boolean) => void, label: string) => (
    <div className="flex items-start gap-2">
      <Checkbox id={`ocr-${id}`} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <label htmlFor={`ocr-${id}`} className="text-sm">
        {label}
      </label>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{formatTemplate(dict.safetyNote, { size: downloadMb.toFixed(1) })}</span>
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

      {file && image ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium break-all">{file.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {image.naturalWidth}×{image.naturalHeight}px ・ {formatBytes(file.size)}
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
          <ScanText className="size-8 text-muted-foreground" aria-hidden="true" />
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

      {file && file.size >= LARGE_FILE_BYTES && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {formatTemplate(dict.largeFileWarning, { size: formatBytes(file.size) })}
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {image && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="flex h-fit flex-col gap-4 rounded-md border p-3">
            <div className="flex flex-col gap-1.5">
              <label id="ocr-language-label" className="text-xs text-muted-foreground">
                {dict.languageLabel}
              </label>
              <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
                <SelectTrigger className="w-full" aria-labelledby="ocr-language-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {dict.languages[lang.replace("+", "_") as keyof typeof dict.languages]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <span className="text-sm font-medium">{dict.preprocessHeading}</span>
            {checkbox("grayscale", settings.grayscale, (v) => update({ grayscale: v }), dict.grayscale)}

            <div className="flex flex-col gap-2">
              <label id="ocr-contrast-label" className="flex justify-between text-xs text-muted-foreground">
                <span>{dict.contrast}</span>
                <span className="tabular-nums">{settings.contrast}</span>
              </label>
              <Slider
                aria-label={dict.contrast}
                min={-100}
                max={100}
                step={5}
                value={[settings.contrast]}
                onValueChange={([value]) => update({ contrast: value })}
              />
            </div>

            {checkbox("threshold", settings.threshold !== null, (v) => update({ threshold: v ? 160 : null }), dict.binarize)}
            {settings.threshold !== null && (
              <div className="flex flex-col gap-2">
                <label id="ocr-threshold-label" className="flex justify-between text-xs text-muted-foreground">
                  <span>{dict.threshold}</span>
                  <span className="tabular-nums">{settings.threshold}</span>
                </label>
                <Slider
                  aria-label={dict.threshold}
                  min={1}
                  max={254}
                  value={[settings.threshold]}
                  onValueChange={([value]) => update({ threshold: value })}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label id="ocr-scale-label" className="text-xs text-muted-foreground">
                {dict.scaleLabel}
              </label>
              <Select value={String(settings.scale)} onValueChange={(value) => update({ scale: Number(value) })}>
                <SelectTrigger className="w-full" aria-labelledby="ocr-scale-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 1.5, 2, 3].map((scale) => (
                    <SelectItem key={scale} value={String(scale)}>
                      {scale === 1 ? dict.scaleNone : `×${scale}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                update({ rotation: (settings.rotation + 90) % 360 });
                setRegion(null);
              }}
            >
              <RotateCw className="size-4" />
              {formatTemplate(dict.rotate, { deg: settings.rotation })}
            </Button>

            <p className="text-xs text-muted-foreground">{dict.accuracyNote}</p>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{dict.previewLabel}</span>
                {region && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRegion(null)}>
                    <X className="size-4" />
                    {dict.clearRegion}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{dict.regionHint}</p>
              <div className="flex justify-center rounded-md border bg-muted/30 p-2">
                <div
                  className="relative touch-none select-none"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragStart.current = pointerToFraction(e);
                  }}
                  onPointerMove={(e) => {
                    if (!dragStart.current) return;
                    setDragRect(rectFromPoints(dragStart.current, pointerToFraction(e), { width: 1, height: 1 }, 0.01));
                  }}
                  onPointerUp={(e) => {
                    if (dragStart.current) {
                      setRegion(rectFromPoints(dragStart.current, pointerToFraction(e), { width: 1, height: 1 }, 0.01));
                    }
                    dragStart.current = null;
                    setDragRect(null);
                  }}
                >
                  <canvas
                    ref={previewRef}
                    className="block max-h-[28rem] max-w-full cursor-crosshair"
                    aria-label={dict.previewLabel}
                    role="img"
                  />
                  {shownRect && (
                    <div
                      className="pointer-events-none absolute border-2 border-primary bg-primary/10"
                      style={{
                        left: `${shownRect.x * 100}%`,
                        top: `${shownRect.y * 100}%`,
                        width: `${shownRect.width * 100}%`,
                        height: `${shownRect.height * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={handleRecognize} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ScanText className="size-4" />}
                {region ? dict.recognizeRegion : dict.recognize}
              </Button>
              {busy && (
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="size-4" />
                  {dict.cancel}
                </Button>
              )}
            </div>
            {progress && (
              <div className="flex flex-col gap-1.5" role="status">
                <span className="text-xs text-muted-foreground">
                  {dict.stages[progress.stage]} {Math.round(progress.value * 100)}%
                </span>
                <progress className="h-2 w-full accent-primary" max={1} value={progress.value} />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="ocr-output" className="text-sm font-medium">
                {dict.outputLabel}
              </label>
              <div className="flex flex-col gap-2">
                {checkbox("remove-spaces", removeSpaces, (v) => {
                  setRemoveSpaces(v);
                  setEditedText(null);
                }, dict.removeSpaces)}
                {checkbox("join-lines", joinLines, (v) => {
                  setJoinLines(v);
                  setEditedText(null);
                }, dict.joinLines)}
                {checkbox("highlight", highlightLow, setHighlightLow, dict.highlightLow)}
              </div>
              <Textarea
                id="ocr-output"
                value={text}
                onChange={(e) => setEditedText(e.target.value)}
                placeholder={dict.outputPlaceholder}
                className="min-h-64 text-sm"
              />
              {highlightLow && words.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {formatTemplate(dict.highlightLegend, { value: LOW_CONFIDENCE })}
                  </span>
                  <div className="max-h-64 overflow-auto rounded-md border p-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {words.map((line, i) => (
                      <div key={i}>
                        {line.map((word, j) => (
                          <React.Fragment key={j}>
                            {j > 0 && " "}
                            {word.confidence < LOW_CONFIDENCE ? (
                              <mark
                                className="rounded bg-amber-200 px-0.5 text-foreground dark:bg-amber-500/40"
                                title={`${Math.round(word.confidence)}%`}
                              >
                                {word.text}
                              </mark>
                            ) : (
                              word.text
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <ToolActions getCopyText={() => text} copyDisabled={!text} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!text}
                  onClick={() =>
                    downloadBytes(
                      new TextEncoder().encode(`${text}\n`),
                      `${(file?.name ?? "ocr").replace(/\.[^.]+$/, "")}.txt`,
                      "text/plain"
                    )
                  }
                >
                  <Download className="size-4" />
                  {dict.download}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
