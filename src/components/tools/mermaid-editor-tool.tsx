"use client";

import * as React from "react";
import {
  Check,
  Copy,
  Download,
  Link2,
  Loader2,
  Maximize,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { downloadBytes } from "@/lib/download";
import { useLazyModule } from "@/lib/lazy-module";
import {
  clampZoom,
  decodeShareState,
  encodeShareState,
  errorLine,
  fitZoom,
  indentText,
  MERMAID_THEMES,
  svgViewBox,
  TEMPLATES,
  withBackground,
  withSize,
  type MermaidTheme,
  type TemplateId,
} from "@/lib/mermaid-editor";
import { cn, formatTemplate } from "@/lib/utils";

const STORAGE_KEY = "clientkit:mermaid:draft";
const HASH_PREFIX = "#m=";
const FONT_FAMILY = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif';
const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];
const RENDER_DELAY = 500;

const loadMermaid = () => import("mermaid").then((module) => module.default);

type Rendered = { svg: string; width: number; height: number };

function readDraft(): { code: string; theme: MermaidTheme; background: string } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? decodeShareState(raw) : null;
  } catch {
    return null;
  }
}

export function MermaidEditorTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.mermaidEditor, [locale]);
  const { module: mermaid, error: loadError } = useLazyModule(loadMermaid);

  const [code, setCode] = React.useState(TEMPLATES.flowchart);
  const [theme, setTheme] = React.useState<MermaidTheme>("default");
  const [background, setBackground] = React.useState("#ffffff");
  const [rendered, setRendered] = React.useState<Rendered | null>(null);
  const [renderError, setRenderError] = React.useState<{ message: string; line: number | null } | null>(null);
  const [rendering, setRendering] = React.useState(false);
  const [view, setView] = React.useState({ zoom: 1, x: 0, y: 0 });
  const [pngScale, setPngScale] = React.useState("2");
  const [mobileView, setMobileView] = React.useState<"editor" | "preview">("editor");
  const [copied, setCopied] = React.useState<string | null>(null);
  const [restored, setRestored] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const gutterRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const tabEscapes = React.useRef(false);
  const dragRef = React.useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const renderSeq = React.useRef(0);
  const needsFit = React.useRef(true);

  // URL のハッシュ → 保存された下書き の順で復元する
  React.useEffect(() => {
    Promise.resolve().then(() => {
      const fromHash = window.location.hash.startsWith(HASH_PREFIX)
        ? decodeShareState(window.location.hash.slice(HASH_PREFIX.length))
        : null;
      const state = fromHash ?? readDraft();
      if (state) {
        setCode(state.code);
        setTheme(state.theme);
        setBackground(state.background);
      }
      setRestored(true);
    });
  }, []);

  // 自動保存（localStorage）と URL ハッシュの更新
  React.useEffect(() => {
    if (!restored) return;
    const timer = window.setTimeout(() => {
      const encoded = encodeShareState({ code, theme, background });
      try {
        window.localStorage.setItem(STORAGE_KEY, encoded);
      } catch {
        // 保存できない環境では何もしない
      }
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${HASH_PREFIX}${encoded}`);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [code, theme, background, restored]);

  const fit = React.useCallback((content: { width: number; height: number }) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const container = { width: viewport.clientWidth, height: viewport.clientHeight };
    const zoom = fitZoom(content, container);
    setView({ zoom, x: (container.width - content.width * zoom) / 2, y: (container.height - content.height * zoom) / 2 });
  }, []);

  // 入力から少し遅れて描画する。エラーの場合は直前の正常な図を残す
  React.useEffect(() => {
    if (!mermaid || !restored) return;
    const seq = ++renderSeq.current;
    const timer = window.setTimeout(async () => {
      setRendering(true);
      const id = `mermaid-preview-${seq}`;
      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme,
          fontFamily: FONT_FAMILY,
          // ELK（elkjs、EPL-2.0）は含めていないため、既定のレイアウトを dagre に固定する
          layout: "dagre",
          // ラベルを foreignObject（HTML）ではなく SVG の text で描画し、PNG 書き出しで崩れないようにする
          htmlLabels: false,
          flowchart: { htmlLabels: false, wrappingWidth: 400 },
        });
        const { svg } = await mermaid.render(id, code);
        if (seq !== renderSeq.current) return;
        const box = svgViewBox(svg);
        const width = Math.ceil(box?.width ?? 800);
        const height = Math.ceil(box?.height ?? 600);
        setRendered({ svg: withSize(svg, width, height), width, height });
        setRenderError(null);
        if (needsFit.current) {
          needsFit.current = false;
          requestAnimationFrame(() => fit({ width, height }));
        }
      } catch (e) {
        if (seq !== renderSeq.current) return;
        const message = e instanceof Error ? e.message : String(e);
        setRenderError({ message, line: errorLine(message) });
      } finally {
        // 失敗時に mermaid が body に残す一時要素を取り除く
        document.getElementById(`d${id}`)?.remove();
        document.getElementById(id)?.remove();
        if (seq === renderSeq.current) setRendering(false);
      }
    }, RENDER_DELAY);
    return () => window.clearTimeout(timer);
  }, [mermaid, code, theme, restored, fit]);

  function exportSvg(scale = 1): string {
    if (!rendered) return "";
    const sized = withSize(rendered.svg, Math.round(rendered.width * scale), Math.round(rendered.height * scale));
    return withBackground(sized, background);
  }

  async function downloadPng() {
    if (!rendered) return;
    const scale = Number(pngScale);
    const svg = exportSvg(scale);
    const image = new Image();
    image.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image"));
    });
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    try {
      await loaded;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(rendered.width * scale);
      canvas.height = Math.round(rendered.height * scale);
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("blob");
      downloadBytes(blob, "diagram.png", "image/png");
    } catch {
      setRenderError({ message: dict.pngError, line: null });
    }
  }

  async function copy(kind: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1500);
    } catch {
      // クリップボードAPIが使えない環境では何もしない
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      tabEscapes.current = true;
      return;
    }
    if (e.key !== "Tab" || tabEscapes.current) {
      tabEscapes.current = false;
      return;
    }
    e.preventDefault();
    const target = e.currentTarget;
    const edit = indentText(target.value, target.selectionStart, target.selectionEnd, e.shiftKey);
    setCode(edit.value);
    requestAnimationFrame(() => target.setSelectionRange(edit.start, edit.end));
  }

  /** 表示領域の中心を基準に拡大・縮小する */
  const zoomBy = React.useCallback((factor: number) => {
    const viewport = viewportRef.current;
    const cx = (viewport?.clientWidth ?? 0) / 2;
    const cy = (viewport?.clientHeight ?? 0) / 2;
    setView((prev) => {
      const zoom = clampZoom(prev.zoom * factor);
      return { zoom, x: cx - ((cx - prev.x) * zoom) / prev.zoom, y: cy - ((cy - prev.y) * zoom) / prev.zoom };
    });
  }, []);

  // Ctrl/⌘ + ホイールで拡大・縮小する（ページのスクロールを止めるため passive: false で登録する）
  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [zoomBy]);

  const lineCount = code.split("\n").length;
  const checkerboard = background === "transparent";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label id="mermaid-template-label" className="text-xs text-muted-foreground">
            {dict.templateLabel}
          </label>
          <Select
            value=""
            onValueChange={(value) => {
              needsFit.current = true;
              setCode(TEMPLATES[value as TemplateId]);
            }}
          >
            <SelectTrigger className="w-48" aria-labelledby="mermaid-template-label">
              <SelectValue placeholder={dict.templatePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {dict.templates[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label id="mermaid-theme-label" className="text-xs text-muted-foreground">
            {dict.themeLabel}
          </label>
          <Select value={theme} onValueChange={(value) => setTheme(value as MermaidTheme)}>
            <SelectTrigger className="w-36" aria-labelledby="mermaid-theme-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MERMAID_THEMES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="mermaid-background" className="text-xs text-muted-foreground">
            {dict.backgroundLabel}
          </label>
          <input
            id="mermaid-background"
            type="color"
            value={checkerboard ? "#ffffff" : background}
            disabled={checkerboard}
            onChange={(e) => setBackground(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1 disabled:opacity-40"
          />
          <Checkbox
            id="mermaid-transparent"
            checked={checkerboard}
            onCheckedChange={(checked) => setBackground(checked === true ? "transparent" : "#ffffff")}
          />
          <label htmlFor="mermaid-transparent" className="text-sm">
            {dict.transparent}
          </label>
        </div>
      </div>

      <div className="inline-flex w-fit rounded-md border p-1 md:hidden" role="tablist" aria-label={dict.viewLabel}>
        {(["editor", "preview"] as const).map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={mobileView === view}
            onClick={() => setMobileView(view)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              mobileView === view ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            {view === "editor" ? dict.editorLabel : dict.previewLabel}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={cn("flex min-w-0 flex-col gap-2", mobileView !== "editor" && "hidden md:flex")}>
          <label htmlFor="mermaid-code" className="text-sm font-medium">
            {dict.editorLabel}
          </label>
          <div className="flex h-[32rem] overflow-hidden rounded-md border bg-background focus-within:ring-[3px] focus-within:ring-ring/50">
            <div
              ref={gutterRef}
              aria-hidden="true"
              className="shrink-0 overflow-hidden border-r bg-muted/40 py-2 pr-2 pl-3 text-right font-mono text-xs leading-5 text-muted-foreground select-none"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className={cn(renderError?.line === i + 1 && "font-bold text-destructive")}>
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              id="mermaid-code"
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={(e) => {
                if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
              spellCheck={false}
              wrap="off"
              aria-describedby="mermaid-editor-hint"
              className="min-w-0 flex-1 resize-none bg-transparent p-2 font-mono text-xs leading-5 outline-none"
            />
          </div>
          <p id="mermaid-editor-hint" className="text-xs text-muted-foreground">
            {dict.editorHint}
          </p>
          {renderError && (
            <p className="text-sm whitespace-pre-wrap text-destructive" role="alert">
              {renderError.line
                ? formatTemplate(dict.errorAt, { line: renderError.line, message: renderError.message.split("\n").slice(-1)[0] })
                : renderError.message.split("\n")[0]}
            </p>
          )}
        </div>

        <div className={cn("flex min-w-0 flex-col gap-2", mobileView !== "preview" && "hidden md:flex")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              {dict.previewLabel}
              {(rendering || (!mermaid && !loadError)) && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label={dict.loading} />}
            </span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => zoomBy(1 / 1.25)} aria-label={dict.zoomOut}>
                <Minus className="size-4" />
              </Button>
              <span className="w-12 text-center text-xs tabular-nums">{Math.round(view.zoom * 100)}%</span>
              <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => zoomBy(1.25)} aria-label={dict.zoomIn}>
                <Plus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => rendered && fit(rendered)}
                aria-label={dict.fit}
                disabled={!rendered}
              >
                <Maximize className="size-4" />
              </Button>
            </div>
          </div>
          <div
            ref={viewportRef}
            className={cn(
              "relative h-[32rem] cursor-grab touch-none overflow-hidden rounded-md border active:cursor-grabbing",
              checkerboard && "bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px]"
            )}
            style={checkerboard ? undefined : { backgroundColor: background }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragRef.current = { x: e.clientX, y: e.clientY, panX: view.x, panY: view.y };
            }}
            onPointerMove={(e) => {
              const drag = dragRef.current;
              if (drag) setView((prev) => ({ ...prev, x: drag.panX + e.clientX - drag.x, y: drag.panY + e.clientY - drag.y }));
            }}
            onPointerUp={() => {
              dragRef.current = null;
            }}
            role="img"
            aria-label={dict.previewAria}
          >
            {loadError ? (
              <p className="p-4 text-sm text-destructive">{dict.loadError}</p>
            ) : (
              rendered && (
                <div
                  className="absolute top-0 left-0 origin-top-left"
                  style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
                  // mermaid（securityLevel: strict）がサニタイズした SVG を表示する
                  dangerouslySetInnerHTML={{ __html: rendered.svg }}
                />
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground">{dict.previewHint}</p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!rendered}
              onClick={() => downloadBytes(new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>\n${exportSvg()}`), "diagram.svg", "image/svg+xml")}
            >
              <Download className="size-4" />
              {dict.downloadSvg}
            </Button>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="sm" disabled={!rendered} onClick={downloadPng}>
                <Download className="size-4" />
                {dict.downloadPng}
              </Button>
              <Select value={pngScale} onValueChange={setPngScale}>
                <SelectTrigger className="h-8 w-20" aria-label={dict.pngScale}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1", "2", "3"].map((scale) => (
                    <SelectItem key={scale} value={scale}>
                      {scale}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["source", dict.copySource, () => code, false],
                ["svg", dict.copySvg, () => exportSvg(), !rendered],
                ["link", dict.copyLink, () => window.location.href, !restored],
              ] as const
            ).map(([kind, label, getText, disabled]) => (
              <Button key={kind} type="button" variant="outline" size="sm" disabled={disabled} onClick={() => copy(kind, getText())}>
                {copied === kind ? <Check className="size-4" /> : kind === "link" ? <Link2 className="size-4" /> : <Copy className="size-4" />}
                {copied === kind ? dict.copied : label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{dict.linkNote}</p>
        </div>
      </div>
    </div>
  );
}
