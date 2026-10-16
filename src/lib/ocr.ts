/**
 * OCR（文字認識）ツールの前処理・後処理に使う純粋関数群。
 * 認識そのものは tesseract.js（Web Worker）で行う。
 */

export type PixelFilterOptions = {
  grayscale: boolean;
  /** コントラスト（-100〜100、0で変化なし） */
  contrast: number;
  /** 二値化のしきい値（0〜255）。null の場合は二値化しない */
  threshold: number | null;
};

export type Rect = { x: number; y: number; width: number; height: number };

/** RGBAの画素配列にグレースケール・コントラスト・二値化をこの順で適用する（配列を直接書き換える） */
export function applyPixelFilters(data: Uint8ClampedArray, options: PixelFilterOptions): void {
  const c = Math.max(-100, Math.min(100, options.contrast)) * 2.55;
  // 一般的なコントラスト補正式（c: -255〜255）
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  const toGray = options.grayscale || options.threshold !== null;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    if (toGray) {
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = y;
    }
    if (c !== 0) {
      r = factor * (r - 128) + 128;
      g = factor * (g - 128) + 128;
      b = factor * (b - 128) + 128;
    }
    if (options.threshold !== null) {
      r = g = b = r >= options.threshold ? 255 : 0;
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

/** 拡大率を適用したうえで、長辺が maxEdge を超えないように調整した倍率を返す */
export function fitScale(width: number, height: number, scale: number, maxEdge: number): number {
  const longEdge = Math.max(width, height) * scale;
  return longEdge > maxEdge ? (scale * maxEdge) / longEdge : scale;
}

/** 回転（90度単位）後の幅と高さを返す */
export function rotatedSize(width: number, height: number, rotation: number): { width: number; height: number } {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}

/** ドラッグの始点と終点から、画像の範囲内に収めた矩形を作る。小さすぎる場合は null */
export function rectFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
  bounds: { width: number; height: number },
  minSize = 4
): Rect | null {
  const clampX = (v: number) => Math.max(0, Math.min(bounds.width, v));
  const clampY = (v: number) => Math.max(0, Math.min(bounds.height, v));
  const x1 = clampX(Math.min(a.x, b.x));
  const y1 = clampY(Math.min(a.y, b.y));
  const x2 = clampX(Math.max(a.x, b.x));
  const y2 = clampY(Math.max(a.y, b.y));
  if (x2 - x1 < minSize || y2 - y1 < minSize) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

// 日本語の文字（ひらがな・カタカナ・漢字・全角記号・全角英数）
const JA = "\\u3000-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\uFF00-\\uFFEF";
const JA_SPACE_JA = new RegExp(`([${JA}])[ \\t]+(?=[${JA}])`, "g");

/** 日本語の文字どうしの間に入った不要な半角スペースを除去する */
export function removeJapaneseSpaces(text: string): string {
  return text.replace(JA_SPACE_JA, "$1");
}

const ENDS_WITH_JA = new RegExp(`[${JA}]$`);
const STARTS_WITH_JA = new RegExp(`^[${JA}]`);

/**
 * 段落内の改行を結合する。空行は段落の区切りとして残す。
 * 日本語どうしはそのまま、英語などの単語の間は半角スペースでつなぐ。
 */
export function joinParagraphLines(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .reduce((joined, line) => {
          if (!joined) return line;
          if (/-$/.test(joined) && /^[a-z]/.test(line)) return joined.slice(0, -1) + line;
          const glue = ENDS_WITH_JA.test(joined) || STARTS_WITH_JA.test(line) ? "" : " ";
          return joined + glue + line;
        }, "")
    )
    .filter(Boolean)
    .join("\n\n");
}

/** 前後の空白行を除き、3行以上続く空行を1行にまとめる */
export function tidyText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
