import { loadImageFromFile } from "@/lib/image-convert";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

type ElementBase = { id: string };

export type MosaicElement = ElementBase & {
  type: "mosaic";
  x: number;
  y: number;
  w: number;
  h: number;
  /** モザイクの粗さ（1ブロックあたりのピクセル数） */
  blockSize: number;
};

export type BlurElement = ElementBase & {
  type: "blur";
  x: number;
  y: number;
  w: number;
  h: number;
  /** ぼかしの強さ（px） */
  blurAmount: number;
};

export type RectElement = ElementBase & {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  strokeWidth: number;
};

export type ArrowElement = ElementBase & {
  type: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
};

export type TextElement = ElementBase & {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
};

export type EditorElement =
  | MosaicElement
  | BlurElement
  | RectElement
  | ArrowElement
  | TextElement;

export type BoxElement = MosaicElement | BlurElement | RectElement;

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "start" | "end";

export type EditorDocument = {
  /** 現在の書き出し元となる、素のベース画像（要素を含まない） */
  canvas: HTMLCanvasElement;
  elements: EditorElement[];
};

/** ドラッグで新規作成する要素の最小サイズ（画像座標系のpx） */
export const MIN_ELEMENT_SIZE = 4;

// ---------------------------------------------------------------------------
// 画像サイズに応じたスライダーの推奨値・最大値
//
// モザイクの粗さやぼかしの強さなどを固定pxで上限を決めてしまうと、
// 解像度の大きい画像では最大値まで上げても効果が弱く見えてしまう。
// 画像の短辺を基準にした割合でデフォルト値・最大値を算出することで、
// 画像サイズによらず「最大値まで上げれば十分強い効果になる」ようにする。
// ---------------------------------------------------------------------------

export type ToolRange = { min: number; default: number; max: number };

function clampNum(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 短辺を基準に、割合(ratio)から算出した値をbounds範囲に収めたToolRangeを作る */
function scaledRange(
  shortSide: number,
  opts: {
    min: number;
    defaultRatio: number;
    defaultBounds: [number, number];
    maxRatio: number;
    maxBounds: [number, number];
  }
): ToolRange {
  const base = shortSide > 0 ? shortSide : 800;
  const def = Math.round(clampNum(base * opts.defaultRatio, opts.defaultBounds[0], opts.defaultBounds[1]));
  const max = Math.round(clampNum(base * opts.maxRatio, opts.maxBounds[0], opts.maxBounds[1]));
  return { min: opts.min, default: Math.min(def, max), max: Math.max(max, opts.min + 1) };
}

export function getMosaicRange(width: number, height: number): ToolRange {
  return scaledRange(Math.min(width, height), {
    min: 4,
    defaultRatio: 0.02,
    defaultBounds: [8, 120],
    maxRatio: 0.12,
    maxBounds: [64, 600],
  });
}

export function getBlurRange(width: number, height: number): ToolRange {
  return scaledRange(Math.min(width, height), {
    min: 2,
    defaultRatio: 0.02,
    defaultBounds: [6, 100],
    maxRatio: 0.08,
    maxBounds: [40, 400],
  });
}

export function getStrokeRange(width: number, height: number): ToolRange {
  return scaledRange(Math.min(width, height), {
    min: 1,
    defaultRatio: 0.006,
    defaultBounds: [2, 40],
    maxRatio: 0.03,
    maxBounds: [30, 150],
  });
}

export function getFontSizeRange(width: number, height: number): ToolRange {
  return scaledRange(Math.min(width, height), {
    min: 10,
    defaultRatio: 0.035,
    defaultBounds: [16, 200],
    maxRatio: 0.15,
    maxBounds: [120, 500],
  });
}

export function getPaddingRange(width: number, height: number): ToolRange {
  return scaledRange(Math.min(width, height), {
    min: 0,
    defaultRatio: 0.04,
    defaultBounds: [16, 200],
    maxRatio: 0.25,
    maxBounds: [200, 1000],
  });
}

export function getCornerRadiusRange(width: number, height: number): ToolRange {
  return scaledRange(Math.min(width, height), {
    min: 0,
    defaultRatio: 0.03,
    defaultBounds: [12, 150],
    maxRatio: 0.5,
    maxBounds: [200, 4000],
  });
}

let idCounter = 0;

export function generateId(): string {
  idCounter += 1;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `el-${Date.now()}-${idCounter}`;
}

export function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

export function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(rect.x, width));
  const y = Math.max(0, Math.min(rect.y, height));
  const w = Math.max(0, Math.min(rect.w, width - x));
  const h = Math.max(0, Math.min(rect.h, height - y));
  return { x, y, w, h };
}

// ---------------------------------------------------------------------------
// 要素の生成
// ---------------------------------------------------------------------------

export function createMosaicElement(rect: Rect, blockSize: number): MosaicElement {
  return { id: generateId(), type: "mosaic", ...rect, blockSize };
}

export function createBlurElement(rect: Rect, blurAmount: number): BlurElement {
  return { id: generateId(), type: "blur", ...rect, blurAmount };
}

export function createRectElement(
  rect: Rect,
  color: string,
  strokeWidth: number
): RectElement {
  return { id: generateId(), type: "rect", ...rect, color, strokeWidth };
}

export function createArrowElement(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  strokeWidth: number
): ArrowElement {
  return { id: generateId(), type: "arrow", x1, y1, x2, y2, color, strokeWidth };
}

export function createTextElement(
  x: number,
  y: number,
  text: string,
  fontSize: number,
  color: string
): TextElement {
  return { id: generateId(), type: "text", x, y, text, fontSize, color };
}

// ---------------------------------------------------------------------------
// 幾何・当たり判定
// ---------------------------------------------------------------------------

const TEXT_LINE_HEIGHT_RATIO = 1.3;
const TEXT_FONT_FAMILY =
  '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif';

export function textFont(fontSize: number): string {
  return `${fontSize}px ${TEXT_FONT_FAMILY}`;
}

export function measureTextBlock(
  ctx: CanvasRenderingContext2D,
  el: TextElement
): { width: number; height: number; lines: string[]; lineHeight: number } {
  ctx.font = textFont(el.fontSize);
  const lines = el.text.length > 0 ? el.text.split("\n") : [""];
  const lineHeight = el.fontSize * TEXT_LINE_HEIGHT_RATIO;
  const width = Math.max(1, ...lines.map((line) => ctx.measureText(line || " ").width));
  const height = Math.max(lineHeight, lines.length * lineHeight);
  return { width, height, lines, lineHeight };
}

export function getElementBounds(el: EditorElement, ctx: CanvasRenderingContext2D): Rect {
  switch (el.type) {
    case "mosaic":
    case "blur":
    case "rect":
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    case "arrow":
      return normalizeRect(el.x1, el.y1, el.x2, el.y2);
    case "text": {
      const { width, height } = measureTextBlock(ctx, el);
      return { x: el.x, y: el.y, w: width, h: height };
    }
  }
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export function isPointInElement(
  el: EditorElement,
  point: Point,
  ctx: CanvasRenderingContext2D
): boolean {
  if (el.type === "arrow") {
    return distanceToSegment(
      point,
      { x: el.x1, y: el.y1 },
      { x: el.x2, y: el.y2 }
    ) <= Math.max(10, el.strokeWidth);
  }
  const b = getElementBounds(el, ctx);
  return point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h;
}

export function getHandles(
  el: EditorElement,
  ctx: CanvasRenderingContext2D
): { id: HandleId; x: number; y: number }[] {
  if (el.type === "arrow") {
    return [
      { id: "start", x: el.x1, y: el.y1 },
      { id: "end", x: el.x2, y: el.y2 },
    ];
  }
  if (el.type === "text") return [];

  const b = getElementBounds(el, ctx);
  return [
    { id: "nw", x: b.x, y: b.y },
    { id: "n", x: b.x + b.w / 2, y: b.y },
    { id: "ne", x: b.x + b.w, y: b.y },
    { id: "e", x: b.x + b.w, y: b.y + b.h / 2 },
    { id: "se", x: b.x + b.w, y: b.y + b.h },
    { id: "s", x: b.x + b.w / 2, y: b.y + b.h },
    { id: "sw", x: b.x, y: b.y + b.h },
    { id: "w", x: b.x, y: b.y + b.h / 2 },
  ];
}

export function hitTestHandle(
  el: EditorElement,
  point: Point,
  ctx: CanvasRenderingContext2D,
  radius: number
): HandleId | null {
  for (const handle of getHandles(el, ctx)) {
    if (Math.hypot(point.x - handle.x, point.y - handle.y) <= radius) return handle.id;
  }
  return null;
}

export function translateElement(el: EditorElement, dx: number, dy: number): EditorElement {
  switch (el.type) {
    case "mosaic":
    case "blur":
    case "rect":
      return { ...el, x: el.x + dx, y: el.y + dy };
    case "arrow":
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    case "text":
      return { ...el, x: el.x + dx, y: el.y + dy };
  }
}

export function resizeRect(rect: Rect, handle: HandleId, point: Point): Rect {
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  let newX = rect.x;
  let newY = rect.y;
  let newRight = right;
  let newBottom = bottom;

  if (handle.includes("w")) newX = point.x;
  if (handle.includes("e")) newRight = point.x;
  if (handle.includes("n")) newY = point.y;
  if (handle.includes("s")) newBottom = point.y;

  return normalizeRect(newX, newY, newRight, newBottom);
}

export function resizeElement(
  el: EditorElement,
  handle: HandleId,
  point: Point
): EditorElement {
  if (el.type === "arrow") {
    if (handle === "start") return { ...el, x1: point.x, y1: point.y };
    if (handle === "end") return { ...el, x2: point.x, y2: point.y };
    return el;
  }
  if (el.type === "text") return el;

  return { ...el, ...resizeRect({ x: el.x, y: el.y, w: el.w, h: el.h }, handle, point) };
}

export type CropAspect = "free" | "1:1" | "4:3" | "16:9";

const ASPECT_RATIO_VALUES: Record<Exclude<CropAspect, "free">, number> = {
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
};

/** 指定したアスペクト比に矩形を合わせる（左上を起点に、境界内に収まるよう調整する） */
export function applyCropAspect(
  rect: Rect,
  aspect: CropAspect,
  boundsW: number,
  boundsH: number
): Rect {
  if (aspect === "free") return rect;
  const ratio = ASPECT_RATIO_VALUES[aspect];

  let w = Math.min(rect.w, boundsW - rect.x);
  let h = w / ratio;
  if (h > rect.h) {
    h = rect.h;
    w = h * ratio;
  }
  if (rect.y + h > boundsH) h = boundsH - rect.y;
  w = h * ratio;
  if (rect.x + w > boundsW) w = boundsW - rect.x;
  h = w / ratio;

  return { x: rect.x, y: rect.y, w: Math.max(1, w), h: Math.max(1, h) };
}

// ---------------------------------------------------------------------------
// 描画
// ---------------------------------------------------------------------------

function drawMosaic(ctx: CanvasRenderingContext2D, el: MosaicElement, source: HTMLCanvasElement) {
  const rect = clampRect({ x: el.x, y: el.y, w: el.w, h: el.h }, source.width, source.height);
  const rw = Math.max(1, Math.round(rect.w));
  const rh = Math.max(1, Math.round(rect.h));
  if (rw < 1 || rh < 1) return;

  const blockSize = Math.max(2, el.blockSize);
  const cols = Math.max(1, Math.round(rw / blockSize));
  const rows = Math.max(1, Math.round(rh / blockSize));

  const tiny = document.createElement("canvas");
  tiny.width = cols;
  tiny.height = rows;
  const tinyCtx = tiny.getContext("2d");
  if (!tinyCtx) return;
  tinyCtx.drawImage(source, rect.x, rect.y, rw, rh, 0, 0, cols, rows);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, cols, rows, rect.x, rect.y, rw, rh);
  ctx.restore();
}

function drawBlur(ctx: CanvasRenderingContext2D, el: BlurElement, source: HTMLCanvasElement) {
  const rect = clampRect({ x: el.x, y: el.y, w: el.w, h: el.h }, source.width, source.height);
  if (rect.w < 1 || rect.h < 1) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = `blur(${el.blurAmount}px)`;
  ctx.drawImage(source, 0, 0);
  ctx.restore();
}

function drawRect(ctx: CanvasRenderingContext2D, el: RectElement) {
  ctx.save();
  ctx.strokeStyle = el.color;
  ctx.lineWidth = el.strokeWidth;
  ctx.strokeRect(el.x, el.y, el.w, el.h);
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, el: ArrowElement) {
  const { x1, y1, x2, y2, color, strokeWidth } = el;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = Math.max(12, strokeWidth * 4);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(
    x2 - Math.cos(angle) * headLength * 0.5,
    y2 - Math.sin(angle) * headLength * 0.5
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 6),
    y2 - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 6),
    y2 - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, el: TextElement) {
  if (!el.text) return;
  const { lines, lineHeight } = measureTextBlock(ctx, el);
  ctx.save();
  ctx.font = textFont(el.fontSize);
  ctx.fillStyle = el.color;
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillText(line, el.x, el.y + index * lineHeight);
  });
  ctx.restore();
}

export function drawElement(
  ctx: CanvasRenderingContext2D,
  el: EditorElement,
  source: HTMLCanvasElement
) {
  switch (el.type) {
    case "mosaic":
      drawMosaic(ctx, el, source);
      return;
    case "blur":
      drawBlur(ctx, el, source);
      return;
    case "rect":
      drawRect(ctx, el);
      return;
    case "arrow":
      drawArrow(ctx, el);
      return;
    case "text":
      drawText(ctx, el);
      return;
  }
}

/** ベース画像の上に要素群を描画する（source自体は変更しない） */
export function renderDocument(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  elements: EditorElement[]
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(source, 0, 0);
  for (const el of elements) {
    drawElement(ctx, el, source);
  }
}

/** 現在の状態（ベース画像＋要素）を1枚のCanvasに焼き込む */
export function bakeDocument(source: HTMLCanvasElement, elements: EditorElement[]): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  renderDocument(ctx, source, elements);
  return out;
}

// ---------------------------------------------------------------------------
// 選択オーバーレイ描画（CSSピクセル空間）
// ---------------------------------------------------------------------------

export function drawSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  el: EditorElement,
  measureCtx: CanvasRenderingContext2D,
  scale: number
) {
  const bounds = getElementBounds(el, measureCtx);
  ctx.save();
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(bounds.x * scale, bounds.y * scale, bounds.w * scale, bounds.h * scale);
  ctx.setLineDash([]);

  const handles = getHandles(el, measureCtx);
  for (const handle of handles) {
    ctx.beginPath();
    ctx.arc(handle.x * scale, handle.y * scale, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#2563eb";
    ctx.stroke();
  }
  ctx.restore();
}

export function drawMarquee(ctx: CanvasRenderingContext2D, rect: Rect, scale: number) {
  ctx.save();
  ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
  ctx.fillRect(rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale);
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale);
  ctx.setLineDash([]);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 画像入出力・全体変換
// ---------------------------------------------------------------------------

export async function loadImageAsCanvas(
  file: File
): Promise<{ canvas: HTMLCanvasElement; name: string }> {
  const { image, objectUrl } = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  URL.revokeObjectURL(objectUrl);
  if (!ctx) throw new Error("Canvasの初期化に失敗しました。");
  ctx.drawImage(image, 0, 0);
  return { canvas, name: file.name };
}

export function cropCanvas(source: HTMLCanvasElement, rect: Rect): HTMLCanvasElement {
  const clamped = clampRect(rect, source.width, source.height);
  const w = Math.max(1, Math.round(clamped.w));
  const h = Math.max(1, Math.round(clamped.h));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.drawImage(source, clamped.x, clamped.y, w, h, 0, 0, w, h);
  return out;
}

export type PaddingSpec = { top: number; right: number; bottom: number; left: number };

export function addPadding(
  source: HTMLCanvasElement,
  padding: PaddingSpec,
  color: string
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.max(1, source.width + padding.left + padding.right);
  out.height = Math.max(1, source.height + padding.top + padding.bottom);
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, padding.left, padding.top);
  return out;
}

export function roundCorners(source: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  const r = Math.max(0, Math.min(radius, Math.min(source.width, source.height) / 2));
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(out.width, 0, out.width, out.height, r);
  ctx.arcTo(out.width, out.height, 0, out.height, r);
  ctx.arcTo(0, out.height, 0, 0, r);
  ctx.arcTo(0, 0, out.width, 0, r);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(source, 0, 0);
  return out;
}

export type ComposeDirection = "vertical" | "horizontal";

/** 複数画像を縦または横に結合する。サイズが異なる場合は中央揃えにする */
export function composeCanvases(
  canvases: HTMLCanvasElement[],
  direction: ComposeDirection,
  gap: number,
  background: string
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  if (canvases.length === 0) {
    out.width = 1;
    out.height = 1;
    return out;
  }

  if (direction === "vertical") {
    const width = Math.max(...canvases.map((c) => c.width));
    const height =
      canvases.reduce((sum, c) => sum + c.height, 0) + gap * (canvases.length - 1);
    out.width = Math.max(1, width);
    out.height = Math.max(1, height);
    const ctx = out.getContext("2d");
    if (!ctx) return out;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
    let offsetY = 0;
    for (const c of canvases) {
      const offsetX = Math.round((width - c.width) / 2);
      ctx.drawImage(c, offsetX, offsetY);
      offsetY += c.height + gap;
    }
  } else {
    const height = Math.max(...canvases.map((c) => c.height));
    const width =
      canvases.reduce((sum, c) => sum + c.width, 0) + gap * (canvases.length - 1);
    out.width = Math.max(1, width);
    out.height = Math.max(1, height);
    const ctx = out.getContext("2d");
    if (!ctx) return out;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
    let offsetX = 0;
    for (const c of canvases) {
      const offsetY = Math.round((height - c.height) / 2);
      ctx.drawImage(c, offsetX, offsetY);
      offsetX += c.width + gap;
    }
  }

  return out;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("画像の書き出しに失敗しました。"));
      },
      type,
      quality
    );
  });
}
