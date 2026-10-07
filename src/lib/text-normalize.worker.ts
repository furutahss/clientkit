/**
 * テキストの正規化・特殊文字の検出・変換前後の差分の計算を行う Web Worker。
 * 巨大なテキストでも画面が固まらないよう、メインスレッドから切り離して実行する。
 */
import { collapseUnchanged, computeTextDiff, loadDiffLibrary, type DiffLine } from "@/lib/text-diff";
import { detectSpecialChars, normalizeText, type Detection, type NormalizeOptions, type NormalizeStep } from "@/lib/text-normalize";

export type TextNormalizeResult = {
  output: string;
  counts: Partial<Record<NormalizeStep, number>>;
  detections: Detection[];
  detectionTotal: number;
  /** 変更箇所の前後だけを残した差分（省略部分は { skipped }） */
  diff: (DiffLine | { skipped: number })[] | null;
  diffTruncated: boolean;
};

const DIFF_CONTEXT = 2;
const MAX_DIFF_ROWS = 3000;
const MAX_DETECTIONS = 5000;

function post(message: unknown) {
  (self as unknown as Worker).postMessage(message);
}

self.onmessage = async (event: MessageEvent<{ id: number; text: string; options: NormalizeOptions }>) => {
  const { id, text, options } = event.data;
  try {
    const { text: output, counts } = normalizeText(text, options);
    const { items, total } = detectSpecialChars(text, MAX_DETECTIONS);
    let diff: TextNormalizeResult["diff"] = null;
    let diffTruncated = false;
    if (output !== text) {
      const result = computeTextDiff(await loadDiffLibrary(), text, output, { ignoreWhitespace: false, charLevel: true });
      if (result) {
        const collapsed = collapseUnchanged(result.lines, (line) => line.type !== "equal", DIFF_CONTEXT);
        diffTruncated = collapsed.length > MAX_DIFF_ROWS;
        diff = collapsed.slice(0, MAX_DIFF_ROWS);
      }
    }
    const result: TextNormalizeResult = { output, counts, detections: items, detectionTotal: total, diff, diffTruncated };
    post({ id, ok: true, result });
  } catch {
    post({ id, ok: false, error: "failed" });
  }
};
