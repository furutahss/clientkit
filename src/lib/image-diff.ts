/** 同じサイズの2枚の画像をピクセル単位で比較する */

export type PixelDiffResult = {
  /** 差分を強調した画像（変更ピクセルは赤、それ以外は元画像を薄く表示） */
  data: Uint8ClampedArray;
  changedPixels: number;
  totalPixels: number;
};

/**
 * RGBAの各チャンネルの差の最大値が threshold を超えたピクセルを変更とみなす。
 * 両方とも完全に透明なピクセルは、色の値が異なっても見た目が同じため変更としない。
 */
export function diffPixels(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  threshold: number
): PixelDiffResult {
  if (a.length !== b.length) throw new Error("Image sizes differ");
  const data = new Uint8ClampedArray(a.length);
  let changedPixels = 0;

  for (let i = 0; i < a.length; i += 4) {
    const bothTransparent = a[i + 3] === 0 && b[i + 3] === 0;
    const delta = bothTransparent
      ? 0
      : Math.max(
          Math.abs(a[i] - b[i]),
          Math.abs(a[i + 1] - b[i + 1]),
          Math.abs(a[i + 2] - b[i + 2]),
          Math.abs(a[i + 3] - b[i + 3])
        );
    if (delta > threshold) {
      changedPixels += 1;
      data[i] = 255;
      data[i + 1] = 0;
      data[i + 2] = 80;
      data[i + 3] = 255;
    } else {
      const gray = Math.round(0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      data[i + 3] = Math.round(a[i + 3] * 0.25);
    }
  }
  return { data, changedPixels, totalPixels: a.length / 4 };
}
