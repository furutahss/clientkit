/** SVGの最適化（svgo）とPNGへの変換 */

export type SvgOptimizeOptions = {
  /** 数値の小数点以下の桁数 */
  precision: number;
  /** width・height属性を削除してviewBoxのみにする（レスポンシブ表示向け） */
  removeDimensions: boolean;
  /** 読みやすいようにインデントして出力する */
  pretty: boolean;
};

export type SvgOptimizeResult =
  | { ok: true; data: string }
  | { ok: false; message: string; line: number | null; column: number | null };

/** svgoはサイズが大きいため、最適化を実行するときに初めて読み込む */
export async function optimizeSvg(
  source: string,
  options: SvgOptimizeOptions
): Promise<SvgOptimizeResult> {
  const { optimize } = await import("svgo/browser");
  try {
    const result = optimize(source, {
      multipass: true,
      floatPrecision: options.precision,
      js2svg: options.pretty ? { pretty: true, indent: 2 } : undefined,
      plugins: [
        "preset-default",
        ...(options.removeDimensions ? (["removeDimensions"] as const) : []),
      ],
    });
    return { ok: true, data: result.data };
  } catch (error) {
    const detail = error as { message?: string; line?: number; column?: number; reason?: string };
    return {
      ok: false,
      message: (detail.reason ?? detail.message ?? String(error)).split("\n")[0].replace(/^<input>:\d+:\d+:\s*/, ""),
      line: typeof detail.line === "number" ? detail.line : null,
      column: typeof detail.column === "number" ? detail.column : null,
    };
  }
}

function parseLength(value: string | null): number | null {
  if (!value) return null;
  const match = /^\s*([0-9.]+)\s*(px)?\s*$/.exec(value);
  return match ? Number(match[1]) : null;
}

/** SVGの表示サイズ（width・height属性、なければviewBox）を求める */
export function getSvgSize(source: string): { width: number; height: number } | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) {
    return null;
  }
  const viewBox = svg
    .getAttribute("viewBox")
    ?.split(/[\s,]+/)
    .map(Number);
  const viewWidth = viewBox && viewBox.length === 4 ? viewBox[2] : null;
  const viewHeight = viewBox && viewBox.length === 4 ? viewBox[3] : null;
  let width = parseLength(svg.getAttribute("width"));
  let height = parseLength(svg.getAttribute("height"));
  if (width && !height && viewWidth && viewHeight) height = (width * viewHeight) / viewWidth;
  if (height && !width && viewWidth && viewHeight) width = (height * viewWidth) / viewHeight;
  width ??= viewWidth;
  height ??= viewHeight;
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

/** SVGをCanvasに描画してPNGに変換する */
export function renderSvgToPng(
  source: string,
  width: number,
  height: number,
  background: string | null
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load"));
    };
    image.src = url;
  });
}
