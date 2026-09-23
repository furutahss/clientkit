/** 1枚の画像から、ファビコン一式（ICO・各サイズのPNG・manifest）を生成する */

export type FaviconOptions = {
  /** 余白（画像の一辺に対する割合、0〜0.4） */
  padding: number;
  /** 背景色。null の場合は透過 */
  background: string | null;
  /** 角丸の半径（一辺に対する割合、0〜0.5）。背景色がある場合のみ有効 */
  cornerRadius: number;
};

export type ManifestOptions = {
  name: string;
  shortName: string;
  themeColor: string;
  backgroundColor: string;
};

export type FaviconFile = {
  name: string;
  size: number;
  data: Uint8Array;
};

/** 出力するPNGの一覧 */
export const FAVICON_PNGS: { name: string; size: number }[] = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "favicon-48x48.png", size: 48 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 },
];

/** favicon.ico に含めるサイズ */
export const ICO_SIZES = [16, 32, 48];

function roundedRectPath(ctx: CanvasRenderingContext2D, size: number, radius: number) {
  const r = Math.min(radius, size / 2);
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
}

function sourceSize(image: HTMLImageElement): { width: number; height: number } {
  // 幅・高さの指定がないSVGは naturalWidth が0になるため、既定の大きさで扱う
  return {
    width: image.naturalWidth || 512,
    height: image.naturalHeight || 512,
  };
}

/**
 * 大きな画像を一度に小さく縮小すると画質が荒れるため、
 * 半分ずつ段階的に縮小してから目的のサイズで描画する。
 */
function downscaleSource(image: HTMLImageElement, target: number): CanvasImageSource {
  const { width, height } = sourceSize(image);
  let currentWidth = width;
  let currentHeight = height;
  let source: CanvasImageSource = image;
  while (Math.max(currentWidth, currentHeight) / 2 >= target * 2) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(currentWidth / 2));
    canvas.height = Math.max(1, Math.round(currentHeight / 2));
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    source = canvas;
    currentWidth = canvas.width;
    currentHeight = canvas.height;
  }
  return source;
}

export function renderIconCanvas(
  image: HTMLImageElement,
  size: number,
  options: FaviconOptions
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  if (options.background) {
    ctx.fillStyle = options.background;
    if (options.cornerRadius > 0) {
      roundedRectPath(ctx, size, size * options.cornerRadius);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, size, size);
    }
  }

  const { width, height } = sourceSize(image);
  const available = size * (1 - options.padding * 2);
  const scale = Math.min(available / width, available / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    downscaleSource(image, Math.max(drawWidth, drawHeight)),
    (size - drawWidth) / 2,
    (size - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
  return canvas;
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("toBlob"));
        return;
      }
      blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
    }, "image/png");
  });
}

/** PNG画像を格納したICOファイルを組み立てる（Windows Vista以降・主要ブラウザが対応） */
export function buildIco(images: { size: number; data: Uint8Array }[]): Uint8Array {
  const headerSize = 6 + images.length * 16;
  const total = headerSize + images.reduce((sum, image) => sum + image.data.length, 0);
  const output = new Uint8Array(total);
  const view = new DataView(output.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true); // 1 = アイコン
  view.setUint16(4, images.length, true);

  let offset = headerSize;
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    output[entry] = image.size >= 256 ? 0 : image.size;
    output[entry + 1] = image.size >= 256 ? 0 : image.size;
    output[entry + 2] = 0; // パレット数
    output[entry + 3] = 0;
    view.setUint16(entry + 4, 1, true); // カラープレーン
    view.setUint16(entry + 6, 32, true); // ビット深度
    view.setUint32(entry + 8, image.data.length, true);
    view.setUint32(entry + 12, offset, true);
    output.set(image.data, offset);
    offset += image.data.length;
  });
  return output;
}

export function buildManifest(options: ManifestOptions): string {
  const manifest = {
    name: options.name,
    short_name: options.shortName || options.name,
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    theme_color: options.themeColor,
    background_color: options.backgroundColor,
    display: "standalone",
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function buildHtmlSnippet(themeColor: string): string {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/manifest.json">',
    `<meta name="theme-color" content="${themeColor}">`,
  ].join("\n");
}

/** ファビコン一式を生成する */
export async function generateFavicons(
  image: HTMLImageElement,
  options: FaviconOptions,
  manifest: ManifestOptions
): Promise<FaviconFile[]> {
  const pngs: FaviconFile[] = [];
  for (const { name, size } of FAVICON_PNGS) {
    pngs.push({ name, size, data: await canvasToPng(renderIconCanvas(image, size, options)) });
  }
  const icoImages = ICO_SIZES.map((size) => {
    const png = pngs.find((file) => file.size === size);
    if (!png) throw new Error("ico size");
    return { size, data: png.data };
  });
  const encoder = new TextEncoder();
  return [
    { name: "favicon.ico", size: 48, data: buildIco(icoImages) },
    ...pngs,
    { name: "manifest.json", size: 0, data: encoder.encode(buildManifest(manifest)) },
    { name: "favicon-snippet.html", size: 0, data: encoder.encode(`${buildHtmlSnippet(manifest.themeColor)}\n`) },
  ];
}
