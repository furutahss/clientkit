"use client";

import * as React from "react";
import { Check, Copy, Download, ImageIcon, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { downloadBytes } from "@/lib/download";
import { useLazyModule } from "@/lib/lazy-module";
import {
  applySnippet,
  EXAMPLES,
  SNIPPET_GROUPS,
  toImageSvg,
  type ExampleId,
  type SnippetGroup,
} from "@/lib/tex-image";
import { cn, formatTemplate } from "@/lib/utils";

const STORAGE_KEY = "clientkit:tex-image:draft";
const RENDER_DELAY = 200;
const EXAMPLE_IDS = Object.keys(EXAMPLES) as ExampleId[];
const GROUP_IDS = Object.keys(SNIPPET_GROUPS) as SnippetGroup[];
const SCALES = ["1", "2", "3", "4"];

const loadRenderer = () => import("@/lib/tex-image").then((module) => module.createTexRenderer());

type Output = { svg: string; width: number; height: number };

async function svgToPng(image: Output, scale: number): Promise<Blob> {
  const element = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    element.onload = () => resolve();
    element.onerror = () => reject(new Error("image"));
  });
  element.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.svg)}`;
  await loaded;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d")?.drawImage(element, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("blob");
  return blob;
}

export function TexImageTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.texImage, [locale]);
  const { module: render, error: loadError } = useLazyModule(loadRenderer);

  const [tex, setTex] = React.useState<string>(EXAMPLES.quadratic);
  const [display, setDisplay] = React.useState(true);
  const [fontSize, setFontSize] = React.useState(48);
  const [padding, setPadding] = React.useState(16);
  const [color, setColor] = React.useState("#000000");
  const [background, setBackground] = React.useState("#ffffff");
  const [scale, setScale] = React.useState("2");
  const [group, setGroup] = React.useState<SnippetGroup>("structures");
  const [mathSvg, setMathSvg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [restored, setRestored] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const draft = window.localStorage.getItem(STORAGE_KEY);
        if (draft !== null) setTex(draft);
      } catch {
        // 読み込めない環境では例の数式のまま
      }
      setRestored(true);
    });
  }, []);

  React.useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, tex);
    } catch {
      // 保存できない環境では何もしない
    }
  }, [tex, restored]);

  // 入力から少し遅れて描画する。エラーの場合は直前の正常な数式を残す
  React.useEffect(() => {
    if (!render) return;
    const timer = window.setTimeout(() => {
      if (!tex.trim()) {
        setMathSvg(null);
        setError(null);
        return;
      }
      try {
        setMathSvg(render(tex, display));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }, RENDER_DELAY);
    return () => window.clearTimeout(timer);
  }, [render, tex, display]);

  const image = React.useMemo(
    () => (mathSvg ? toImageSvg(mathSvg, { fontSize, padding, color, background }) : null),
    [mathSvg, fontSize, padding, color, background]
  );
  const previewUrl = React.useMemo(
    () => (image ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.svg)}` : null),
    [image]
  );

  function insert(snippet: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const edit = applySnippet(textarea.value, start, end, snippet);
    textarea.focus();
    // execCommand なら Ctrl+Z で元に戻せる。使えない環境では値を直接書き換える
    if (document.execCommand("insertText", false, edit.insert)) {
      textarea.setSelectionRange(edit.cursor, edit.cursor);
    } else {
      setTex(edit.value);
      requestAnimationFrame(() => textarea.setSelectionRange(edit.cursor, edit.cursor));
    }
  }

  function flash(kind: string) {
    setCopied(kind);
    window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1500);
  }

  async function copyText(kind: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(kind);
    } catch {
      // クリップボードAPIが使えない環境では何もしない
    }
  }

  async function copyPng() {
    if (!image) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": svgToPng(image, Number(scale)) })]);
      flash("png");
    } catch {
      setError(dict.copyImageError);
    }
  }

  async function downloadPng() {
    if (!image) return;
    try {
      downloadBytes(await svgToPng(image, Number(scale)), "formula.png", "image/png");
    } catch {
      setError(dict.pngError);
    }
  }

  const transparent = background === "transparent";
  const outputSize = image
    ? formatTemplate(dict.outputSize, {
        width: Math.round(image.width * Number(scale)),
        height: Math.round(image.height * Number(scale)),
      })
    : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label id="tex-example-label" className="text-xs text-muted-foreground">
            {dict.exampleLabel}
          </label>
          <Select value="" onValueChange={(value) => setTex(EXAMPLES[value as ExampleId])}>
            <SelectTrigger className="w-56" aria-labelledby="tex-example-label">
              <SelectValue placeholder={dict.examplePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {EXAMPLE_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {dict.examples[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="tex-display" checked={display} onCheckedChange={setDisplay} />
          <label htmlFor="tex-display" className="text-sm">
            {dict.displayMode}
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label={dict.snippetsLabel}>
          {GROUP_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={group === id}
              onClick={() => setGroup(id)}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                group === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {dict.groups[id]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1" role="tabpanel">
          {SNIPPET_GROUPS[group].map((snippet) => (
            <Button
              key={snippet.tex}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 min-w-9 px-2 font-serif text-sm"
              title={snippet.tex.replace("$", "")}
              aria-label={snippet.tex.replace("$", "")}
              // ボタンにフォーカスが移ると選択範囲が分かりにくくなるため、押下時のフォーカス移動を止める
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(snippet.tex)}
            >
              {snippet.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{dict.snippetsHint}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="tex-source" className="text-sm font-medium">
            {dict.inputLabel}
          </label>
          <textarea
            id="tex-source"
            ref={textareaRef}
            value={tex}
            onChange={(e) => setTex(e.target.value)}
            spellCheck={false}
            className="h-56 resize-y rounded-md border bg-background p-3 font-mono text-sm leading-6 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="text-xs text-muted-foreground">{dict.inputHint}</p>
          {error && (
            <p className="text-sm whitespace-pre-wrap text-destructive" role="alert">
              {formatTemplate(dict.error, { message: error })}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            {dict.previewLabel}
            {!render && !loadError && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label={dict.loading} />}
            {image && <span className="text-xs font-normal text-muted-foreground tabular-nums">{outputSize}</span>}
          </span>
          <div
            className={cn(
              "flex h-56 items-center justify-center overflow-auto rounded-md border p-2",
              "bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px]"
            )}
          >
            {loadError ? (
              <p className="text-sm text-destructive">{dict.loadError}</p>
            ) : (
              previewUrl &&
              image && (
                // eslint-disable-next-line @next/next/no-img-element -- ブラウザ内で生成した data URL を表示する
                <img src={previewUrl} width={image.width} height={image.height} alt={tex} className="max-h-full max-w-full object-contain" />
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground">{dict.previewHint}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["fontSize", fontSize, setFontSize, 8, 200],
            ["padding", padding, setPadding, 0, 100],
          ] as const
        ).map(([key, value, setValue, min, max]) => (
          <div key={key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor={`tex-${key}`} className="text-sm">
                {dict[key]}
              </label>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  id={`tex-${key}`}
                  type="number"
                  min={min}
                  max={max}
                  value={value}
                  onChange={(e) => setValue(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
                  className="h-7 w-16 rounded-md border bg-transparent px-1.5 text-right text-sm tabular-nums"
                />
                px
              </span>
            </div>
            <Slider value={[value]} onValueChange={([next]) => setValue(next)} min={min} max={max} step={1} aria-label={dict[key]} />
          </div>
        ))}
        <div className="flex flex-col gap-2">
          <span className="text-sm">{dict.colors}</span>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="tex-color" className="text-xs text-muted-foreground">
              {dict.textColor}
            </label>
            <input
              id="tex-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded-md border bg-transparent p-1"
            />
            <label htmlFor="tex-background" className="text-xs text-muted-foreground">
              {dict.backgroundColor}
            </label>
            <input
              id="tex-background"
              type="color"
              value={transparent ? "#ffffff" : background}
              disabled={transparent}
              onChange={(e) => setBackground(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded-md border bg-transparent p-1 disabled:opacity-40"
            />
            <Checkbox
              id="tex-transparent"
              checked={transparent}
              onCheckedChange={(checked) => setBackground(checked === true ? "transparent" : "#ffffff")}
            />
            <label htmlFor="tex-transparent" className="text-sm">
              {dict.transparent}
            </label>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label id="tex-scale-label" className="text-sm">
            {dict.scale}
          </label>
          <Select value={scale} onValueChange={setScale}>
            <SelectTrigger className="w-24" aria-labelledby="tex-scale-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCALES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!image} onClick={downloadPng}>
          <Download className="size-4" />
          {dict.downloadPng}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!image}
          onClick={() =>
            image && downloadBytes(new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>\n${image.svg}`), "formula.svg", "image/svg+xml")
          }
        >
          <Download className="size-4" />
          {dict.downloadSvg}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!image} onClick={copyPng}>
          {copied === "png" ? <Check className="size-4" /> : <ImageIcon className="size-4" />}
          {copied === "png" ? dict.copied : dict.copyPng}
        </Button>
        {(
          [
            ["svg", dict.copySvg, image?.svg ?? "", !image],
            ["tex", dict.copyTex, tex, !tex],
          ] as const
        ).map(([kind, label, text, disabled]) => (
          <Button key={kind} type="button" variant="outline" size="sm" disabled={disabled} onClick={() => copyText(kind, text)}>
            {copied === kind ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied === kind ? dict.copied : label}
          </Button>
        ))}
      </div>
    </div>
  );
}
