/** PDFの結合・分割・ページ抽出で共通して使うページ操作ユーティリティ */

export type PdfSourceFile = {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  bytes: ArrayBuffer;
};

export type PdfPageItem = {
  /** ページ一覧内で一意のキー */
  key: string;
  fileId: string;
  /** 元ファイル内のページ番号（0始まり） */
  pageIndex: number;
  /** 元ページの回転に加える回転角（0/90/180/270） */
  rotation: number;
};

export type PageSpecErrorCode = "empty" | "invalid" | "out-of-range";

export type PageSpecResult =
  | { ok: true; groups: number[][] }
  | { ok: false; error: PageSpecErrorCode; token?: string };

/**
 * "1-3, 5, 8-" のようなページ指定を解析する。
 * カンマ区切りの各要素を1グループとして返す（ページ番号は0始まり）。
 * "8-" は8ページ目から最後まで、"-3" は1ページ目から3ページ目までを表す。
 */
export function parsePageSpec(spec: string, total: number): PageSpecResult {
  const tokens = spec
    .split(/[,、，]/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return { ok: false, error: "empty" };

  const groups: number[][] = [];
  for (const token of tokens) {
    const match = /^(\d*)\s*[-‐－~〜]\s*(\d*)$|^(\d+)$/.exec(token);
    if (!match) return { ok: false, error: "invalid", token };

    let start: number;
    let end: number;
    if (match[3] !== undefined) {
      start = end = Number(match[3]);
    } else {
      if (!match[1] && !match[2]) return { ok: false, error: "invalid", token };
      start = match[1] ? Number(match[1]) : 1;
      end = match[2] ? Number(match[2]) : total;
    }

    if (start < 1 || end < 1 || start > total || end > total) {
      return { ok: false, error: "out-of-range", token };
    }

    const group: number[] = [];
    const step = start <= end ? 1 : -1;
    for (let page = start; step > 0 ? page <= end : page >= end; page += step) {
      group.push(page - 1);
    }
    groups.push(group);
  }
  return { ok: true, groups };
}

/** 全ページをNページごとのグループに分ける（0始まり） */
export function chunkPages(total: number, size: number): number[][] {
  const groups: number[][] = [];
  const chunk = Math.max(1, Math.floor(size));
  for (let start = 0; start < total; start += chunk) {
    const group: number[] = [];
    for (let page = start; page < Math.min(total, start + chunk); page += 1) {
      group.push(page);
    }
    groups.push(group);
  }
  return groups;
}

/** 連続するページ番号を "1-3, 5" のような表記にまとめる（入力は0始まり） */
export function formatPageGroup(group: number[]): string {
  const parts: string[] = [];
  let index = 0;
  while (index < group.length) {
    let end = index;
    while (end + 1 < group.length && group[end + 1] === group[end] + 1) end += 1;
    parts.push(
      end === index
        ? String(group[index] + 1)
        : `${group[index] + 1}-${group[end] + 1}`
    );
    index = end + 1;
  }
  return parts.join(", ");
}

export function normalizeRotation(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** 拡張子を除いたファイル名を返す */
export function baseName(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index > 0 ? fileName.slice(0, index) : fileName;
}

export class PdfLoadError extends Error {
  constructor(public code: "encrypted" | "invalid") {
    super(code);
  }
}

/** PDFのページ数を読み取る（pdf-libは容量が大きいため動的に読み込む） */
export async function readPdfPageCount(bytes: ArrayBuffer): Promise<number> {
  const { PDFDocument } = await import("@pdfme/pdf-lib");
  let doc;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    throw new PdfLoadError("invalid");
  }
  if (doc.isEncrypted) throw new PdfLoadError("encrypted");
  return doc.getPageCount();
}

/** 指定したページの並びから新しいPDFを生成する */
export async function buildPdf(
  files: PdfSourceFile[],
  pages: PdfPageItem[]
): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import("@pdfme/pdf-lib");
  const output = await PDFDocument.create();
  const loaded = new Map<string, Awaited<ReturnType<typeof PDFDocument.load>>>();

  for (const item of pages) {
    let source = loaded.get(item.fileId);
    if (!source) {
      const file = files.find((candidate) => candidate.id === item.fileId);
      if (!file) continue;
      source = await PDFDocument.load(file.bytes, { updateMetadata: false });
      loaded.set(item.fileId, source);
    }
    const [copied] = await output.copyPages(source, [item.pageIndex]);
    if (item.rotation) {
      copied.setRotation(
        degrees(normalizeRotation(copied.getRotation().angle + item.rotation))
      );
    }
    output.addPage(copied);
  }

  return output.save();
}
