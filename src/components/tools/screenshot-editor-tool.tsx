"use client";

import * as React from "react";
import {
  ArrowUpRight,
  Columns3,
  Crop as CropIcon,
  Download,
  Droplets,
  Frame,
  Grid3x3,
  GripVertical,
  ImagePlus,
  MousePointer2,
  Plus,
  Redo2,
  RefreshCw,
  Rows3,
  ShieldCheck,
  Square,
  SquircleIcon,
  Trash2,
  Type as TypeIcon,
  Undo2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  extensionForMimeType,
  withExtension,
  type OutputFormat,
} from "@/lib/image-convert";
import {
  MIN_ELEMENT_SIZE,
  addPadding,
  applyCropAspect,
  bakeDocument,
  canvasToBlob,
  clampRect,
  composeCanvases,
  createArrowElement,
  createBlurElement,
  createMosaicElement,
  createRectElement,
  createTextElement,
  cropCanvas,
  drawMarquee,
  drawSelectionOverlay,
  generateId,
  getHandles,
  hitTestHandle,
  isPointInElement,
  loadImageAsCanvas,
  normalizeRect,
  renderDocument,
  resizeElement,
  resizeRect,
  roundCorners,
  translateElement,
  type CropAspect,
  type EditorDocument,
  type EditorElement,
  type HandleId,
  type Point,
  type Rect,
  type RectElement,
} from "@/lib/screenshot-editor";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn } from "@/lib/utils";

type ToolId =
  | "select"
  | "mosaic"
  | "blur"
  | "rect"
  | "arrow"
  | "text"
  | "crop"
  | "padding"
  | "corner";

type Draft =
  | { kind: "creating"; elementType: "mosaic" | "blur" | "rect" | "arrow"; start: Point; current: Point }
  | { kind: "crop-creating"; start: Point; current: Point }
  | { kind: "move"; id: string; start: Point; current: Point }
  | { kind: "resize"; id: string; handle: HandleId; current: Point };

type TrayImage = {
  id: string;
  canvas: HTMLCanvasElement;
  name: string;
  thumbnailUrl: string;
};

type TextEditSession = {
  id: string | null;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  value: string;
  original: string;
  isNew: boolean;
};

type HistoryState = { entries: EditorDocument[]; index: number };
type HistoryAction =
  | { type: "reset"; doc: EditorDocument }
  | { type: "push"; doc: EditorDocument }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear" };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "reset":
      return { entries: [action.doc], index: 0 };
    case "push": {
      const truncated = state.entries.slice(0, state.index + 1);
      return { entries: [...truncated, action.doc], index: truncated.length };
    }
    case "undo":
      return { ...state, index: Math.max(0, state.index - 1) };
    case "redo":
      return { ...state, index: Math.min(state.entries.length - 1, state.index + 1) };
    case "clear":
      return { entries: [], index: -1 };
  }
}

const CROP_ELEMENT_ID = "__crop__";
const HANDLE_HIT_RADIUS_CSS = 9;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/avif"];

function cropAsElement(rect: Rect): RectElement {
  return { id: CROP_ELEMENT_ID, type: "rect", ...rect, color: "#2563eb", strokeWidth: 2 };
}

function createThumbnail(canvas: HTMLCanvasElement): string {
  const maxWidth = 160;
  const scale = Math.min(1, maxWidth / canvas.width);
  const tw = Math.max(1, Math.round(canvas.width * scale));
  const th = Math.max(1, Math.round(canvas.height * scale));
  const tiny = document.createElement("canvas");
  tiny.width = tw;
  tiny.height = th;
  const ctx = tiny.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(canvas, 0, 0, tw, th);
  return tiny.toDataURL("image/png");
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}

export function ScreenshotEditorTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.screenshotEditor, [locale]);

  const DRAW_TOOLS: { id: ToolId; icon: LucideIcon; label: string }[] = [
    { id: "select", icon: MousePointer2, label: dict.toolSelect },
    { id: "mosaic", icon: Grid3x3, label: dict.toolMosaic },
    { id: "blur", icon: Droplets, label: dict.toolBlur },
    { id: "rect", icon: Square, label: dict.toolRect },
    { id: "arrow", icon: ArrowUpRight, label: dict.toolArrow },
    { id: "text", icon: TypeIcon, label: dict.toolText },
    { id: "crop", icon: CropIcon, label: dict.toolCrop },
    { id: "padding", icon: Frame, label: dict.toolPadding },
    { id: "corner", icon: SquircleIcon, label: dict.toolCorner },
  ];

  const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
    { value: "image/png", label: dict.formatPng },
    { value: "image/jpeg", label: dict.formatJpeg },
    { value: "image/webp", label: dict.formatWebp },
  ];

  const CROP_ASPECT_OPTIONS: { value: CropAspect; label: string }[] = [
    { value: "free", label: dict.cropFree },
    { value: "1:1", label: dict.crop1x1 },
    { value: "4:3", label: dict.crop4x3 },
    { value: "16:9", label: dict.crop16x9 },
  ];

  const [images, setImages] = React.useState<TrayImage[]>([]);
  const [mergeDirection, setMergeDirection] = React.useState<"vertical" | "horizontal">("vertical");
  const [mergeGap, setMergeGap] = React.useState(16);
  const [mergeBackground, setMergeBackground] = React.useState("#ffffff");

  const [historyState, dispatchHistory] = React.useReducer(historyReducer, {
    entries: [],
    index: -1,
  });
  const doc = historyState.index >= 0 ? historyState.entries[historyState.index] : null;
  const editStarted = historyState.entries.length > 1;
  const canUndo = historyState.index > 0;
  const canRedo = historyState.index < historyState.entries.length - 1;

  const [activeTool, setActiveTool] = React.useState<ToolId>("select");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [cropRect, setCropRect] = React.useState<Rect | null>(null);
  const [textEdit, setTextEdit] = React.useState<TextEditSession | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [resizeTick, setResizeTick] = React.useState(0);
  const [displayScale, setDisplayScale] = React.useState(1);

  const [mosaicBlockSize, setMosaicBlockSize] = React.useState(16);
  const [blurAmount, setBlurAmount] = React.useState(10);
  const [shapeColor, setShapeColor] = React.useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = React.useState(4);
  const [textColor, setTextColor] = React.useState("#ef4444");
  const [fontSize, setFontSize] = React.useState(28);
  const [cropAspect, setCropAspect] = React.useState<CropAspect>("free");
  const [paddingAmount, setPaddingAmount] = React.useState(32);
  const [paddingColor, setPaddingColor] = React.useState("#ffffff");
  const [cornerRadius, setCornerRadius] = React.useState(24);
  const [exportFormat, setExportFormat] = React.useState<OutputFormat>("image/png");
  const [exportQuality, setExportQuality] = React.useState(90);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const contentCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const overlayRef = React.useRef<HTMLCanvasElement>(null);
  const measureCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const dragImageIndexRef = React.useRef<number | null>(null);
  const textEditCancelledRef = React.useRef(false);

  function getMeasureCtx(): CanvasRenderingContext2D {
    if (!measureCanvasRef.current) {
      measureCanvasRef.current = document.createElement("canvas");
    }
    const ctx = measureCanvasRef.current.getContext("2d");
    if (!ctx) throw new Error("Canvasの初期化に失敗しました。");
    return ctx;
  }

  const selectedElement = doc?.elements.find((el) => el.id === selectedId) ?? null;

  const commit = React.useCallback((next: EditorDocument) => {
    dispatchHistory({ type: "push", doc: next });
  }, []);

  const undo = React.useCallback(() => dispatchHistory({ type: "undo" }), []);
  const redo = React.useCallback(() => dispatchHistory({ type: "redo" }), []);

  const deleteSelected = React.useCallback(() => {
    if (!doc || !selectedId) return;
    commit({ canvas: doc.canvas, elements: doc.elements.filter((el) => el.id !== selectedId) });
    setSelectedId(null);
  }, [doc, selectedId, commit]);

  // ---------------------------------------------------------------------
  // 画像の読み込み・結合トレイ
  // ---------------------------------------------------------------------

  const appendImages = React.useCallback(
    (loaded: { canvas: HTMLCanvasElement; name: string }[]) => {
      if (loaded.length === 0) return;
      if (!doc || !editStarted) {
        setImages((prev) => [
          ...prev,
          ...loaded.map((l) => ({
            id: generateId(),
            canvas: l.canvas,
            name: l.name,
            thumbnailUrl: createThumbnail(l.canvas),
          })),
        ]);
        return;
      }
      const baked = bakeDocument(doc.canvas, doc.elements);
      const composed = composeCanvases(
        [baked, ...loaded.map((l) => l.canvas)],
        mergeDirection,
        mergeGap,
        mergeBackground
      );
      commit({ canvas: composed, elements: [] });
    },
    [doc, editStarted, mergeDirection, mergeGap, mergeBackground, commit]
  );

  const handleFiles = React.useCallback(
    async (fileList: File[]) => {
      const validFiles = fileList.filter((f) => f.type.startsWith("image/"));
      if (validFiles.length === 0) {
        setLoadError(dict.invalidFileType);
        return;
      }
      setLoadError(null);
      try {
        const loaded = await Promise.all(validFiles.map(loadImageAsCanvas));
        appendImages(loaded);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : dict.loadErrorGeneric);
      }
    },
    [dict, appendImages]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("screenshot-editor");
    if (!pending) return;
    const timer = window.setTimeout(() => {
      void handleFiles([pending]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [handleFiles]);

  React.useEffect(() => {
    if (editStarted) return;
    const timer = window.setTimeout(() => {
      if (images.length === 0) {
        dispatchHistory({ type: "clear" });
        return;
      }
      const canvases = images.map((img) => img.canvas);
      const composed =
        canvases.length === 1
          ? canvases[0]
          : composeCanvases(canvases, mergeDirection, mergeGap, mergeBackground);
      dispatchHistory({ type: "reset", doc: { canvas: composed, elements: [] } });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [images, mergeDirection, mergeGap, mergeBackground, editStarted]);

  React.useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        void handleFiles(files);
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFiles]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) void handleFiles(files);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) void handleFiles(files);
  }

  function handleThumbDragStart(index: number) {
    dragImageIndexRef.current = index;
  }

  function handleThumbDrop(index: number) {
    const from = dragImageIndexRef.current;
    dragImageIndexRef.current = null;
    if (from === null || from === index) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
  }

  function handleRemoveImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  function handleReset() {
    setImages([]);
    dispatchHistory({ type: "clear" });
    setSelectedId(null);
    setDraft(null);
    setCropRect(null);
    setTextEdit(null);
    setActiveTool("select");
    setLoadError(null);
  }

  // ---------------------------------------------------------------------
  // 要素のライブプレビュー（ドラッグ中の下書き状態を反映した配列）
  // ---------------------------------------------------------------------

  function computeRenderElements(): EditorElement[] {
    if (!doc) return [];
    const base =
      textEdit && !textEdit.isNew
        ? doc.elements.filter((el) => el.id !== textEdit.id)
        : doc.elements;

    if (!draft) return base;

    if (draft.kind === "creating") {
      const rect = normalizeRect(draft.start.x, draft.start.y, draft.current.x, draft.current.y);
      if (rect.w < 1 || rect.h < 1) return base;
      if (draft.elementType === "mosaic") return [...base, createMosaicElement(rect, mosaicBlockSize)];
      if (draft.elementType === "blur") return [...base, createBlurElement(rect, blurAmount)];
      if (draft.elementType === "rect") return [...base, createRectElement(rect, shapeColor, strokeWidth)];
      return [
        ...base,
        createArrowElement(draft.start.x, draft.start.y, draft.current.x, draft.current.y, shapeColor, strokeWidth),
      ];
    }

    if (draft.kind === "move" && draft.id !== CROP_ELEMENT_ID) {
      const dx = draft.current.x - draft.start.x;
      const dy = draft.current.y - draft.start.y;
      return base.map((el) => (el.id === draft.id ? translateElement(el, dx, dy) : el));
    }

    if (draft.kind === "resize" && draft.id !== CROP_ELEMENT_ID) {
      return base.map((el) => (el.id === draft.id ? resizeElement(el, draft.handle, draft.current) : el));
    }

    return base;
  }

  const renderElements = computeRenderElements();

  const previewSelectedElement = renderElements.find((el) => el.id === selectedId) ?? null;

  // ---------------------------------------------------------------------
  // 描画
  // ---------------------------------------------------------------------

  React.useEffect(() => {
    const canvas = contentCanvasRef.current;
    if (!canvas) return;
    if (!doc) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    if (canvas.width !== doc.canvas.width) canvas.width = doc.canvas.width;
    if (canvas.height !== doc.canvas.height) canvas.height = doc.canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderDocument(ctx, doc.canvas, renderElements);
  }, [doc, renderElements]);

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => setResizeTick((t) => t + 1));
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !doc) {
      setDisplayScale(1);
      return;
    }
    const rect = overlay.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    overlay.width = Math.max(1, Math.round(rect.width * dpr));
    overlay.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const scale = rect.width / doc.canvas.width;
    setDisplayScale(scale);
    const measureCtx = getMeasureCtx();

    if (activeTool === "crop") {
      const previewRect =
        draft && draft.kind === "crop-creating"
          ? applyCropAspect(
              normalizeRect(draft.start.x, draft.start.y, draft.current.x, draft.current.y),
              cropAspect,
              doc.canvas.width,
              doc.canvas.height
            )
          : draft && draft.kind === "move" && draft.id === CROP_ELEMENT_ID && cropRect
            ? clampRect(
                {
                  x: cropRect.x + (draft.current.x - draft.start.x),
                  y: cropRect.y + (draft.current.y - draft.start.y),
                  w: cropRect.w,
                  h: cropRect.h,
                },
                doc.canvas.width,
                doc.canvas.height
              )
            : draft && draft.kind === "resize" && draft.id === CROP_ELEMENT_ID && cropRect
              ? applyCropAspect(
                  resizeRect(cropRect, draft.handle, draft.current),
                  cropAspect,
                  doc.canvas.width,
                  doc.canvas.height
                )
              : cropRect;
      if (previewRect) {
        drawMarquee(ctx, previewRect, scale);
        const handles = getHandles(cropAsElement(previewRect), measureCtx);
        for (const handle of handles) {
          ctx.beginPath();
          ctx.arc(handle.x * scale, handle.y * scale, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "#2563eb";
          ctx.stroke();
        }
      }
    } else if (draft && draft.kind === "creating" && draft.elementType === "arrow") {
      ctx.save();
      ctx.strokeStyle = shapeColor;
      ctx.lineWidth = strokeWidth;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(draft.start.x * scale, draft.start.y * scale);
      ctx.lineTo(draft.current.x * scale, draft.current.y * scale);
      ctx.stroke();
      ctx.restore();
    } else if (activeTool === "select" && previewSelectedElement) {
      drawSelectionOverlay(ctx, previewSelectedElement, measureCtx, scale);
    }
  }, [doc, draft, cropRect, activeTool, previewSelectedElement, cropAspect, shapeColor, strokeWidth, resizeTick]);

  // ---------------------------------------------------------------------
  // ポインター操作
  // ---------------------------------------------------------------------

  function toImagePoint(e: React.PointerEvent<HTMLCanvasElement>): { point: Point; scale: number } | null {
    const overlay = overlayRef.current;
    if (!overlay || !doc) return null;
    const rect = overlay.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scale = rect.width / doc.canvas.width;
    return {
      point: { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale },
      scale,
    };
  }

  function selectTool(tool: ToolId) {
    setActiveTool(tool);
    if (tool !== "select") setSelectedId(null);
    setDraft(null);
    if (tool !== "crop") setCropRect(null);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!doc || activeTool === "padding" || activeTool === "corner") return;
    const hit = toImagePoint(e);
    if (!hit) return;
    // canvasはフォーカス不可のため、既定動作のままだとテキスト入力欄への
    // オートフォーカス直後にフォーカスが奪われてしまう。それを防ぐ。
    e.preventDefault();
    const { point, scale } = hit;
    const measureCtx = getMeasureCtx();
    const handleRadius = HANDLE_HIT_RADIUS_CSS / scale;
    overlayRef.current?.setPointerCapture(e.pointerId);

    if (activeTool === "crop") {
      if (cropRect) {
        const cropEl = cropAsElement(cropRect);
        const handle = hitTestHandle(cropEl, point, measureCtx, handleRadius);
        if (handle) {
          setDraft({ kind: "resize", id: CROP_ELEMENT_ID, handle, current: point });
          return;
        }
        if (isPointInElement(cropEl, point, measureCtx)) {
          setDraft({ kind: "move", id: CROP_ELEMENT_ID, start: point, current: point });
          return;
        }
      }
      setDraft({ kind: "crop-creating", start: point, current: point });
      return;
    }

    if (activeTool === "text") {
      setTextEdit({
        id: null,
        x: point.x,
        y: point.y,
        fontSize,
        color: textColor,
        value: "",
        original: "",
        isNew: true,
      });
      return;
    }

    if (activeTool !== "select") {
      setDraft({ kind: "creating", elementType: activeTool, start: point, current: point });
      return;
    }

    if (selectedElement) {
      const handle = hitTestHandle(selectedElement, point, measureCtx, handleRadius);
      if (handle) {
        setDraft({ kind: "resize", id: selectedElement.id, handle, current: point });
        return;
      }
    }

    const hitElement = [...doc.elements].reverse().find((el) => isPointInElement(el, point, measureCtx));
    if (hitElement) {
      setSelectedId(hitElement.id);
      setDraft({ kind: "move", id: hitElement.id, start: point, current: point });
    } else {
      setSelectedId(null);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!draft) return;
    const hit = toImagePoint(e);
    if (!hit) return;
    const { point } = hit;
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.kind === "resize") return { ...prev, current: point };
      return { ...prev, current: point };
    });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    overlayRef.current?.releasePointerCapture(e.pointerId);
    if (!draft || !doc) {
      setDraft(null);
      return;
    }

    if (draft.kind === "creating") {
      const rect = clampRect(
        normalizeRect(draft.start.x, draft.start.y, draft.current.x, draft.current.y),
        doc.canvas.width,
        doc.canvas.height
      );
      if (rect.w >= MIN_ELEMENT_SIZE && rect.h >= MIN_ELEMENT_SIZE) {
        let el: EditorElement;
        if (draft.elementType === "mosaic") el = createMosaicElement(rect, mosaicBlockSize);
        else if (draft.elementType === "blur") el = createBlurElement(rect, blurAmount);
        else if (draft.elementType === "rect") el = createRectElement(rect, shapeColor, strokeWidth);
        else {
          el = createArrowElement(draft.start.x, draft.start.y, draft.current.x, draft.current.y, shapeColor, strokeWidth);
        }
        commit({ canvas: doc.canvas, elements: [...doc.elements, el] });
        setSelectedId(el.id);
        setActiveTool("select");
      }
      setDraft(null);
      return;
    }

    if (draft.kind === "crop-creating") {
      const rect = applyCropAspect(
        clampRect(
          normalizeRect(draft.start.x, draft.start.y, draft.current.x, draft.current.y),
          doc.canvas.width,
          doc.canvas.height
        ),
        cropAspect,
        doc.canvas.width,
        doc.canvas.height
      );
      if (rect.w >= MIN_ELEMENT_SIZE && rect.h >= MIN_ELEMENT_SIZE) setCropRect(rect);
      setDraft(null);
      return;
    }

    if (draft.kind === "move") {
      const dx = draft.current.x - draft.start.x;
      const dy = draft.current.y - draft.start.y;
      if (draft.id === CROP_ELEMENT_ID) {
        if (cropRect && (dx !== 0 || dy !== 0)) {
          setCropRect(
            clampRect({ x: cropRect.x + dx, y: cropRect.y + dy, w: cropRect.w, h: cropRect.h }, doc.canvas.width, doc.canvas.height)
          );
        }
      } else if (dx !== 0 || dy !== 0) {
        const elements = doc.elements.map((el) => (el.id === draft.id ? translateElement(el, dx, dy) : el));
        commit({ canvas: doc.canvas, elements });
      }
      setDraft(null);
      return;
    }

    if (draft.kind === "resize") {
      if (draft.id === CROP_ELEMENT_ID) {
        if (cropRect) {
          const resized = resizeRect(cropRect, draft.handle, draft.current);
          setCropRect(applyCropAspect(clampRect(resized, doc.canvas.width, doc.canvas.height), cropAspect, doc.canvas.width, doc.canvas.height));
        }
      } else {
        const elements = doc.elements.map((el) => (el.id === draft.id ? resizeElement(el, draft.handle, draft.current) : el));
        commit({ canvas: doc.canvas, elements });
      }
      setDraft(null);
      return;
    }
  }

  function handleDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!doc || activeTool !== "select") return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    if (rect.width === 0) return;
    const scale = rect.width / doc.canvas.width;
    const point = { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
    const measureCtx = getMeasureCtx();
    const hitEl = [...doc.elements].reverse().find((el) => el.type === "text" && isPointInElement(el, point, measureCtx));
    if (hitEl && hitEl.type === "text") {
      setSelectedId(hitEl.id);
      setTextEdit({
        id: hitEl.id,
        x: hitEl.x,
        y: hitEl.y,
        fontSize: hitEl.fontSize,
        color: hitEl.color,
        value: hitEl.text,
        original: hitEl.text,
        isNew: false,
      });
    }
  }

  // ---------------------------------------------------------------------
  // テキスト編集の確定・キャンセル
  // ---------------------------------------------------------------------

  function commitTextEdit() {
    if (!textEdit || !doc) {
      setTextEdit(null);
      return;
    }
    const value = textEdit.value;
    if (textEdit.isNew) {
      if (value.trim() !== "") {
        const el = createTextElement(textEdit.x, textEdit.y, value, textEdit.fontSize, textEdit.color);
        commit({ canvas: doc.canvas, elements: [...doc.elements, el] });
        setSelectedId(el.id);
      }
    } else if (value.trim() === "") {
      commit({ canvas: doc.canvas, elements: doc.elements.filter((el) => el.id !== textEdit.id) });
      setSelectedId(null);
    } else if (value !== textEdit.original) {
      commit({
        canvas: doc.canvas,
        elements: doc.elements.map((el) => (el.id === textEdit.id ? { ...el, text: value } : el)),
      });
    }
    setTextEdit(null);
    setActiveTool("select");
  }

  function handleTextKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      textEditCancelledRef.current = true;
      e.currentTarget.blur();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  function handleTextBlur() {
    if (textEditCancelledRef.current) {
      textEditCancelledRef.current = false;
      setTextEdit(null);
      setActiveTool("select");
      return;
    }
    commitTextEdit();
  }

  // ---------------------------------------------------------------------
  // キーボードショートカット
  // ---------------------------------------------------------------------

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditableTarget =
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isEditableTarget) return;

      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (isMeta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, deleteSelected]);

  // ---------------------------------------------------------------------
  // 全体変換（クロップ・余白・角丸）
  // ---------------------------------------------------------------------

  function applyCrop() {
    if (!doc || !cropRect) return;
    const baked = bakeDocument(doc.canvas, doc.elements);
    const cropped = cropCanvas(baked, cropRect);
    commit({ canvas: cropped, elements: [] });
    setCropRect(null);
    setSelectedId(null);
    setActiveTool("select");
  }

  function cancelCrop() {
    setCropRect(null);
    setActiveTool("select");
  }

  function applyPaddingAction() {
    if (!doc) return;
    const baked = bakeDocument(doc.canvas, doc.elements);
    const padded = addPadding(
      baked,
      { top: paddingAmount, right: paddingAmount, bottom: paddingAmount, left: paddingAmount },
      paddingColor
    );
    commit({ canvas: padded, elements: [] });
    setSelectedId(null);
    setActiveTool("select");
  }

  function applyRoundedCornersAction() {
    if (!doc) return;
    const baked = bakeDocument(doc.canvas, doc.elements);
    const rounded = roundCorners(baked, cornerRadius);
    commit({ canvas: rounded, elements: [] });
    setSelectedId(null);
    setActiveTool("select");
  }

  function patchSelected(patch: Record<string, string | number>) {
    if (!doc || !selectedElement) return;
    const updated = { ...selectedElement, ...patch } as unknown as EditorElement;
    commit({
      canvas: doc.canvas,
      elements: doc.elements.map((el) => (el.id === selectedElement.id ? updated : el)),
    });
  }

  // ---------------------------------------------------------------------
  // 書き出し
  // ---------------------------------------------------------------------

  async function handleDownload() {
    if (!doc) return;
    setIsExporting(true);
    try {
      const baked = bakeDocument(doc.canvas, doc.elements);
      const blob = await canvasToBlob(baked, exportFormat, exportFormat === "image/png" ? undefined : exportQuality / 100);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = withExtension("screenshot", extensionForMimeType(blob.type));
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : dict.exportErrorGeneric);
    } finally {
      setIsExporting(false);
    }
  }

  const cursorClass =
    activeTool === "select"
      ? "cursor-default"
      : activeTool === "padding" || activeTool === "corner"
        ? "cursor-default"
        : "cursor-crosshair";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      {!doc ? (
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
            isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"
          )}
        >
          <ImagePlus className="size-10 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">{dict.dropLabel}</p>
            <p className="text-sm text-muted-foreground">{dict.dropHint}</p>
            <p className="text-xs text-muted-foreground">{dict.pasteHint}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex flex-col gap-3 lg:w-60 lg:shrink-0">
            <div className="flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap">
              {DRAW_TOOLS.map(({ id, icon: Icon, label }) => (
                <Button
                  key={id}
                  type="button"
                  variant={activeTool === id ? "default" : "outline"}
                  size="sm"
                  className="justify-start"
                  onClick={() => selectTool(id)}
                >
                  <Icon className="size-4" />
                  {label}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={undo} disabled={!canUndo}>
                <Undo2 className="size-4" />
                {dict.undo}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={redo} disabled={!canRedo}>
                <Redo2 className="size-4" />
                {dict.redo}
              </Button>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="size-4" />
              {dict.startOver}
            </Button>

            {images.length > 0 && !editStarted && (
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{dict.mergeHeading}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Plus className="size-4" />
                    {dict.addImage}
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  {images.map((img, index) => (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={() => handleThumbDragStart(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleThumbDrop(index)}
                      className="flex items-center gap-2 rounded-md border bg-background p-1.5"
                    >
                      <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />
                      {/* eslint-disable-next-line @next/next/no-img-element -- ローカルのサムネイルを表示するため */}
                      <img
                        src={img.thumbnailUrl}
                        alt={img.name}
                        className="h-10 w-14 shrink-0 rounded object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs">{img.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => handleRemoveImage(img.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                {images.length > 1 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={mergeDirection === "vertical" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setMergeDirection("vertical")}
                      >
                        <Rows3 className="size-4" />
                        {dict.mergeVertical}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={mergeDirection === "horizontal" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setMergeDirection("horizontal")}
                      >
                        <Columns3 className="size-4" />
                        {dict.mergeHorizontal}
                      </Button>
                    </div>
                    <SliderField label={dict.mergeGap} value={mergeGap} min={0} max={120} suffix="px" onChange={setMergeGap} />
                    <ColorField label={dict.mergeBackground} value={mergeBackground} onChange={setMergeBackground} />
                  </div>
                )}
              </div>
            )}

            {editStarted && (
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Plus className="size-4" />
                {dict.addImage}
              </Button>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex justify-center overflow-auto rounded-lg border bg-[repeating-conic-gradient(#0000000d_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-3">
              <div ref={wrapperRef} className="relative w-fit max-w-full touch-none select-none">
                <canvas
                  ref={contentCanvasRef}
                  style={{ maxWidth: "100%", maxHeight: "65vh", width: "auto", height: "auto", display: "block" }}
                />
                <canvas
                  ref={overlayRef}
                  className={cn("absolute inset-0 h-full w-full touch-none", cursorClass)}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onDoubleClick={handleDoubleClick}
                />
                {textEdit && (
                  <textarea
                    autoFocus
                    value={textEdit.value}
                    onChange={(e) => setTextEdit((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
                    onBlur={handleTextBlur}
                    onKeyDown={handleTextKeyDown}
                    rows={Math.max(1, textEdit.value.split("\n").length)}
                    className="absolute z-10 min-w-[3ch] resize-none overflow-hidden border border-dashed border-primary bg-background/70 px-1 outline-none"
                    style={{
                      left: textEdit.x * displayScale,
                      top: textEdit.y * displayScale,
                      fontSize: textEdit.fontSize * displayScale,
                      lineHeight: 1.3,
                      color: textEdit.color,
                      minWidth: 40,
                    }}
                  />
                )}
              </div>
            </div>

            <div className="rounded-lg border p-4">
              {activeTool === "crop" ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {CROP_ASPECT_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        size="sm"
                        variant={cropAspect === opt.value ? "default" : "outline"}
                        onClick={() => setCropAspect(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={applyCrop} disabled={!cropRect}>
                      {dict.cropApply}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={cancelCrop} disabled={!cropRect}>
                      {dict.cropCancel}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{dict.cropHint}</p>
                </div>
              ) : activeTool === "padding" ? (
                <div className="flex flex-col gap-3">
                  <SliderField label={dict.paddingAmount} value={paddingAmount} min={0} max={200} suffix="px" onChange={setPaddingAmount} />
                  <ColorField label={dict.paddingColor} value={paddingColor} onChange={setPaddingColor} />
                  <Button type="button" size="sm" className="w-fit" onClick={applyPaddingAction}>
                    {dict.paddingApply}
                  </Button>
                </div>
              ) : activeTool === "corner" ? (
                <div className="flex flex-col gap-3">
                  <SliderField label={dict.cornerRadius} value={cornerRadius} min={0} max={200} suffix="px" onChange={setCornerRadius} />
                  <p className="text-xs text-muted-foreground">{dict.cornerHint}</p>
                  <Button type="button" size="sm" className="w-fit" onClick={applyRoundedCornersAction}>
                    {dict.cornerApply}
                  </Button>
                </div>
              ) : selectedElement ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{dict.selectedElementHeading}</span>
                    <Button type="button" size="sm" variant="outline" onClick={deleteSelected}>
                      <Trash2 className="size-4" />
                      {dict.deleteElement}
                    </Button>
                  </div>
                  {selectedElement.type === "mosaic" && (
                    <SliderField
                      label={dict.mosaicSize}
                      value={selectedElement.blockSize}
                      min={4}
                      max={64}
                      suffix="px"
                      onChange={(v) => patchSelected({ blockSize: v })}
                    />
                  )}
                  {selectedElement.type === "blur" && (
                    <SliderField
                      label={dict.blurAmount}
                      value={selectedElement.blurAmount}
                      min={2}
                      max={40}
                      suffix="px"
                      onChange={(v) => patchSelected({ blurAmount: v })}
                    />
                  )}
                  {(selectedElement.type === "rect" || selectedElement.type === "arrow") && (
                    <>
                      <ColorField label={dict.color} value={selectedElement.color} onChange={(v) => patchSelected({ color: v })} />
                      <SliderField
                        label={dict.strokeWidth}
                        value={selectedElement.strokeWidth}
                        min={1}
                        max={30}
                        suffix="px"
                        onChange={(v) => patchSelected({ strokeWidth: v })}
                      />
                    </>
                  )}
                  {selectedElement.type === "text" && (
                    <>
                      <ColorField label={dict.color} value={selectedElement.color} onChange={(v) => patchSelected({ color: v })} />
                      <SliderField
                        label={dict.fontSize}
                        value={selectedElement.fontSize}
                        min={10}
                        max={120}
                        suffix="px"
                        onChange={(v) => patchSelected({ fontSize: v })}
                      />
                      <p className="text-xs text-muted-foreground">{dict.textEditHint}</p>
                    </>
                  )}
                </div>
              ) : activeTool === "mosaic" ? (
                <SliderField label={dict.mosaicSize} value={mosaicBlockSize} min={4} max={64} suffix="px" onChange={setMosaicBlockSize} />
              ) : activeTool === "blur" ? (
                <SliderField label={dict.blurAmount} value={blurAmount} min={2} max={40} suffix="px" onChange={setBlurAmount} />
              ) : activeTool === "rect" || activeTool === "arrow" ? (
                <div className="flex flex-col gap-3">
                  <ColorField label={dict.color} value={shapeColor} onChange={setShapeColor} />
                  <SliderField label={dict.strokeWidth} value={strokeWidth} min={1} max={30} suffix="px" onChange={setStrokeWidth} />
                </div>
              ) : activeTool === "text" ? (
                <div className="flex flex-col gap-3">
                  <ColorField label={dict.color} value={textColor} onChange={setTextColor} />
                  <SliderField label={dict.fontSize} value={fontSize} min={10} max={120} suffix="px" onChange={setFontSize} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{dict.selectHint}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {doc && (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {doc.canvas.width} x {doc.canvas.height} px
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{dict.exportFormat}</label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as OutputFormat)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 sm:w-48">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{dict.exportQuality}</label>
                <span className="text-sm text-muted-foreground tabular-nums">{exportQuality}%</span>
              </div>
              <Slider
                value={[exportQuality]}
                onValueChange={([v]) => setExportQuality(v)}
                min={1}
                max={100}
                step={1}
                disabled={exportFormat === "image/png"}
                className="mt-2"
              />
            </div>
            <Button type="button" onClick={handleDownload} disabled={isExporting} className="self-end">
              <Download className="size-4" />
              {isExporting ? dict.exporting : dict.download}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
