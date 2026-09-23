import type { ChangeObject } from "diff";

/** jsdiffは動的に読み込むため、必要な関数だけを受け取る */
export type DiffLibrary = Pick<typeof import("diff"), "diffChars" | "diffLines" | "createTwoFilesPatch">;

export const loadDiffLibrary = (): Promise<DiffLibrary> => import("diff");

export type DiffSegment = { text: string; changed: boolean };

export type DiffLineType = "equal" | "removed" | "added";

export type DiffLine = {
  type: DiffLineType;
  text: string;
  /** 文字単位の差分（文字単位表示で、対応する行がある場合のみ） */
  segments?: DiffSegment[];
  oldNumber?: number;
  newNumber?: number;
};

/** 左右比較表示の1行（片側が空の場合はnull） */
export type SplitRow = {
  left: DiffLine | null;
  right: DiffLine | null;
};

export type DiffOptions = {
  ignoreWhitespace: boolean;
  charLevel: boolean;
};

export type DiffResult = {
  lines: DiffLine[];
  rows: SplitRow[];
  added: number;
  removed: number;
  identical: boolean;
};

/** 差分計算を打ち切るまでの時間（ミリ秒）。巨大な入力でブラウザが固まるのを防ぐ */
const DIFF_TIMEOUT_MS = 3000;

/** 文字単位の差分を計算する行の最大文字数 */
const MAX_CHAR_DIFF_LENGTH = 2000;

function splitLines(value: string): string[] {
  const lines = value.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function charSegments(
  diff: DiffLibrary,
  oldText: string,
  newText: string
): { oldSegments: DiffSegment[]; newSegments: DiffSegment[] } | null {
  if (oldText.length > MAX_CHAR_DIFF_LENGTH || newText.length > MAX_CHAR_DIFF_LENGTH) {
    return null;
  }
  const changes = diff.diffChars(oldText, newText);
  const oldSegments: DiffSegment[] = [];
  const newSegments: DiffSegment[] = [];
  for (const change of changes) {
    if (change.added) newSegments.push({ text: change.value, changed: true });
    else if (change.removed) oldSegments.push({ text: change.value, changed: true });
    else {
      oldSegments.push({ text: change.value, changed: false });
      newSegments.push({ text: change.value, changed: false });
    }
  }
  return { oldSegments, newSegments };
}

/**
 * 2つのテキストの行単位の差分を計算する。
 * 時間内に計算が終わらなかった場合は null を返す。
 */
export function computeTextDiff(
  diff: DiffLibrary,
  oldText: string,
  newText: string,
  options: DiffOptions
): DiffResult | null {
  const normalizedOld = oldText.replace(/\r\n?/g, "\n");
  const normalizedNew = newText.replace(/\r\n?/g, "\n");

  const changes = diff.diffLines(normalizedOld, normalizedNew, {
    ignoreWhitespace: options.ignoreWhitespace,
    ignoreNewlineAtEof: true,
    timeout: DIFF_TIMEOUT_MS,
  }) as ChangeObject<string>[] | undefined;
  if (!changes) return null;

  const lines: DiffLine[] = [];
  const rows: SplitRow[] = [];
  let oldNumber = 1;
  let newNumber = 1;
  let added = 0;
  let removed = 0;

  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index];

    if (change.removed) {
      const next = changes[index + 1];
      const removedLines = splitLines(change.value);
      const addedLines = next?.added ? splitLines(next.value) : [];
      if (next?.added) index += 1;

      const removedItems: DiffLine[] = removedLines.map((text) => ({
        type: "removed",
        text,
        oldNumber: oldNumber++,
      }));
      const addedItems: DiffLine[] = addedLines.map((text) => ({
        type: "added",
        text,
        newNumber: newNumber++,
      }));

      const pairCount = Math.min(removedItems.length, addedItems.length);
      if (options.charLevel) {
        for (let i = 0; i < pairCount; i += 1) {
          const segments = charSegments(diff, removedItems[i].text, addedItems[i].text);
          if (segments) {
            removedItems[i].segments = segments.oldSegments;
            addedItems[i].segments = segments.newSegments;
          }
        }
      }

      removed += removedItems.length;
      added += addedItems.length;
      lines.push(...removedItems, ...addedItems);
      for (let i = 0; i < Math.max(removedItems.length, addedItems.length); i += 1) {
        rows.push({ left: removedItems[i] ?? null, right: addedItems[i] ?? null });
      }
      continue;
    }

    if (change.added) {
      for (const text of splitLines(change.value)) {
        const line: DiffLine = { type: "added", text, newNumber: newNumber++ };
        added += 1;
        lines.push(line);
        rows.push({ left: null, right: line });
      }
      continue;
    }

    // 共通部分（空白を無視した場合は新しい側の表記で表示する）
    const newSide = splitLines(change.value);
    for (const text of newSide) {
      const line: DiffLine = {
        type: "equal",
        text,
        oldNumber: oldNumber++,
        newNumber: newNumber++,
      };
      lines.push(line);
      rows.push({ left: line, right: line });
    }
  }

  return { lines, rows, added, removed, identical: added === 0 && removed === 0 };
}

/**
 * 変更箇所の前後 context 行だけを残し、それ以外を折りたたむ。
 * 折りたたんだ箇所は { skipped: 行数 } として返す。
 */
export function collapseUnchanged<T>(
  items: T[],
  isChanged: (item: T) => boolean,
  context: number
): (T | { skipped: number })[] {
  const keep = new Array<boolean>(items.length).fill(false);
  items.forEach((item, index) => {
    if (!isChanged(item)) return;
    for (
      let i = Math.max(0, index - context);
      i <= Math.min(items.length - 1, index + context);
      i += 1
    ) {
      keep[i] = true;
    }
  });

  const result: (T | { skipped: number })[] = [];
  let skipped = 0;
  items.forEach((item, index) => {
    if (keep[index]) {
      if (skipped > 0) result.push({ skipped });
      skipped = 0;
      result.push(item);
    } else {
      skipped += 1;
    }
  });
  if (skipped > 0) result.push({ skipped });
  return result;
}
