export type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

export type ConvertOptions = {
  format: OutputFormat;
  /** 1〜100。PNG（ロスレス）の場合は無視される */
  quality: number;
  /** 出力する幅・高さ（px）。アスペクト比を維持するかどうかは呼び出し側で決定する */
  width: number;
  height: number;
};

export function loadImageFromFile(file: File): Promise<{
  image: HTMLImageElement;
  objectUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("画像を読み込めませんでした。対応していない形式の可能性があります。"));
    };
    image.src = objectUrl;
  });
}

export function convertImage(
  image: HTMLImageElement,
  options: ConvertOptions
): Promise<Blob> {
  const width = Math.max(1, Math.round(options.width));
  const height = Math.max(1, Math.round(options.height));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Canvasの初期化に失敗しました。"));
  }

  if (options.format === "image/jpeg") {
    // JPEGは透過を扱えないため、白背景で塗りつぶしてから描画する
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(image, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("画像の変換に失敗しました。"));
      },
      options.format,
      options.format === "image/png" ? undefined : options.quality / 100
    );
  });
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * 実際に生成されたBlobのMIMEタイプから拡張子を求める。
 * ブラウザが要求したフォーマットに未対応の場合、Canvas.toBlobは
 * 仕様上 image/png にフォールバックするため、選択中フォーマットではなく
 * 生成結果の blob.type を必ず使用すること。
 */
export function extensionForMimeType(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? mimeType.split("/")[1] ?? "png";
}

export function withExtension(fileName: string, extension: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, "");
  return `${base || "image"}.${extension}`;
}
