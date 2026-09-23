/**
 * QRコードの生成と読み取り。
 * @zxing/library はサイズが大きいため、利用するときに動的に読み込む。
 */

export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export type QrMatrix = {
  /** 1辺のモジュール数（余白を含まない） */
  size: number;
  version: number;
  /** modules[y][x] が true のときに暗いモジュール */
  modules: boolean[][];
};

export type QrGenerateResult = { ok: true; matrix: QrMatrix } | { ok: false; error: "too-long" | "unknown" };

export async function generateQrMatrix(
  text: string,
  level: ErrorCorrectionLevel
): Promise<QrGenerateResult> {
  const zxing = await import("@zxing/library");
  const hints = new Map();
  hints.set(zxing.EncodeHintType.CHARACTER_SET, "UTF-8");
  try {
    const code = zxing.QRCodeEncoder.encode(
      text,
      zxing.QRCodeDecoderErrorCorrectionLevel.fromString(level),
      hints
    );
    const matrix = code.getMatrix();
    const size = matrix.getWidth();
    const modules: boolean[][] = [];
    for (let y = 0; y < size; y += 1) {
      const row: boolean[] = [];
      for (let x = 0; x < size; x += 1) row.push(matrix.get(x, y) === 1);
      modules.push(row);
    }
    return { ok: true, matrix: { size, version: code.getVersion().getVersionNumber(), modules } };
  } catch (error) {
    // 本番ビルドではクラス名が短縮されるため、メッセージでも判定する
    const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    return { ok: false, error: /WriterException|too big|data bits/i.test(text) ? "too-long" : "unknown" };
  }
}

export type QrRenderOptions = {
  /** 出力画像の1辺のピクセル数（余白を含む） */
  pixelSize: number;
  /** 余白のモジュール数（仕様上の推奨は4） */
  margin: number;
  foreground: string;
  background: string;
};

export function renderQrToCanvas(matrix: QrMatrix, options: QrRenderOptions): HTMLCanvasElement {
  const total = matrix.size + options.margin * 2;
  const canvas = document.createElement("canvas");
  canvas.width = options.pixelSize;
  canvas.height = options.pixelSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = options.background;
  ctx.fillRect(0, 0, options.pixelSize, options.pixelSize);
  ctx.fillStyle = options.foreground;
  const scale = options.pixelSize / total;
  for (let y = 0; y < matrix.size; y += 1) {
    for (let x = 0; x < matrix.size; x += 1) {
      if (!matrix.modules[y][x]) continue;
      // 隣接するモジュールの間に隙間ができないよう、整数座標に丸めて塗る
      const left = Math.round((x + options.margin) * scale);
      const top = Math.round((y + options.margin) * scale);
      const right = Math.round((x + options.margin + 1) * scale);
      const bottom = Math.round((y + options.margin + 1) * scale);
      ctx.fillRect(left, top, right - left, bottom - top);
    }
  }
  return canvas;
}

export function renderQrToSvg(matrix: QrMatrix, options: Omit<QrRenderOptions, "pixelSize">): string {
  const total = matrix.size + options.margin * 2;
  let path = "";
  for (let y = 0; y < matrix.size; y += 1) {
    let x = 0;
    while (x < matrix.size) {
      if (!matrix.modules[y][x]) {
        x += 1;
        continue;
      }
      let run = 1;
      while (x + run < matrix.size && matrix.modules[y][x + run]) run += 1;
      path += `M${x + options.margin} ${y + options.margin}h${run}v1h-${run}z`;
      x += run;
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">`,
    `<rect width="${total}" height="${total}" fill="${options.background}"/>`,
    `<path fill="${options.foreground}" d="${path}"/>`,
    "</svg>",
  ].join("");
}

/** 読み取り時に画像を縮小する最大辺（大きすぎる画像は処理が重くなるため） */
const MAX_DECODE_SIZE = 1600;

function toLuminance(imageData: ImageData): Uint8ClampedArray {
  const { data, width, height } = imageData;
  const luminance = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const alpha = data[i * 4 + 3] / 255;
    // 透過部分は白背景として扱う
    const r = data[i * 4] * alpha + 255 * (1 - alpha);
    const g = data[i * 4 + 1] * alpha + 255 * (1 - alpha);
    const b = data[i * 4 + 2] * alpha + 255 * (1 - alpha);
    luminance[i] = (r * 299 + g * 587 + b * 114) / 1000;
  }
  return luminance;
}

export type QrDecodeResult = { ok: true; text: string } | { ok: false };

/** 画像からQRコードを読み取る */
export async function decodeQrFromImage(image: HTMLImageElement): Promise<QrDecodeResult> {
  const zxing = await import("@zxing/library");
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) return { ok: false };

  const hints = new Map();
  hints.set(zxing.DecodeHintType.TRY_HARDER, true);
  hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [zxing.BarcodeFormat.QR_CODE]);
  const reader = new zxing.QRCodeReader();

  // 元の大きさで読めない場合に備えて、縮小した画像でも試す
  const baseScale = Math.min(1, MAX_DECODE_SIZE / Math.max(width, height));
  for (const scale of [baseScale, baseScale / 2, baseScale / 4]) {
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    if (Math.min(w, h) < 21) break;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { ok: false };
    ctx.drawImage(image, 0, 0, w, h);
    const luminance = toLuminance(ctx.getImageData(0, 0, w, h));
    const source = new zxing.RGBLuminanceSource(luminance, w, h);
    for (const candidate of [source, source.invert()]) {
      try {
        const result = reader.decode(new zxing.BinaryBitmap(new zxing.HybridBinarizer(candidate)), hints);
        return { ok: true, text: result.getText() };
      } catch {
        reader.reset();
      }
    }
  }
  return { ok: false };
}
