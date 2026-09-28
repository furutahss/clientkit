/**
 * フォルダ・圧縮ファイルからパスの一覧（TreeEntry）を読み取る。
 * 圧縮ファイルは中身を展開せず、ファイル名とサイズの情報だけを読み取る。
 */
import type { TreeEntry } from "@/lib/file-tree";

/** 読み取るエントリ数の上限（ブラウザが固まらないようにするため） */
export const MAX_TREE_ENTRIES = 300_000;

export type ArchiveFormat = "zip" | "tar" | "tar.gz";

export type TreeSource = {
  rootName: string;
  entries: TreeEntry[];
  /** 圧縮ファイルから読み取った場合の形式 */
  archiveFormat: ArchiveFormat | null;
  /** 上限に達して読み取りを打ち切った場合はtrue */
  truncated: boolean;
};

export class UnsupportedArchiveError extends Error {}

type ProgressCallback = (count: number) => void;

class EntryCollector {
  entries: TreeEntry[] = [];
  truncated = false;
  private onProgress?: ProgressCallback;

  constructor(onProgress?: ProgressCallback) {
    this.onProgress = onProgress;
  }

  /** 追加できた場合はtrue。上限に達した場合はfalse */
  add(entry: TreeEntry): boolean {
    if (this.entries.length >= MAX_TREE_ENTRIES) {
      this.truncated = true;
      return false;
    }
    this.entries.push(entry);
    if (this.onProgress && this.entries.length % 500 === 0) this.onProgress(this.entries.length);
    return true;
  }
}

// ---------------------------------------------------------------------------
// フォルダ
// ---------------------------------------------------------------------------

/** <input webkitdirectory> で選択されたファイル一覧から読み取る */
export function readFileList(files: FileList | File[]): TreeSource {
  const collector = new EntryCollector();
  let rootName = "";
  for (const file of Array.from(files)) {
    const relative = file.webkitRelativePath || file.name;
    const slash = relative.indexOf("/");
    if (!rootName) rootName = slash > 0 ? relative.slice(0, slash) : ".";
    const path = slash > 0 ? relative.slice(slash + 1) : relative;
    if (!collector.add({ path, isDir: false, size: file.size })) break;
  }
  return { rootName: rootName || ".", entries: collector.entries, archiveFormat: null, truncated: collector.truncated };
}

function readAllDirectoryEntries(directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = directory.createReader();
  const all: FileSystemEntry[] = [];
  return new Promise((resolve, reject) => {
    // readEntriesは一度に一部しか返さないため、空になるまで繰り返し呼び出す
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
          return;
        }
        all.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

function getFileSize(entry: FileSystemFileEntry): Promise<number> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file.size),
      () => resolve(0)
    );
  });
}

/**
 * ドラッグ＆ドロップされたフォルダ・ファイルを再帰的に読み取る。
 * <input webkitdirectory> と違い、空のフォルダも取得できる。
 */
export async function readDroppedEntries(
  roots: FileSystemEntry[],
  onProgress?: ProgressCallback
): Promise<TreeSource> {
  const collector = new EntryCollector(onProgress);
  const singleDirectory = roots.length === 1 && roots[0].isDirectory ? roots[0] : null;

  const visit = async (entry: FileSystemEntry, path: string): Promise<void> => {
    if (collector.truncated) return;
    if (entry.isDirectory) {
      if (path && !collector.add({ path, isDir: true, size: 0 })) return;
      const children = await readAllDirectoryEntries(entry as FileSystemDirectoryEntry);
      for (const child of children) {
        await visit(child, path ? `${path}/${child.name}` : child.name);
      }
    } else {
      const size = await getFileSize(entry as FileSystemFileEntry);
      collector.add({ path, isDir: false, size });
    }
  };

  if (singleDirectory) {
    await visit(singleDirectory, "");
  } else {
    for (const root of roots) await visit(root, root.name);
  }

  return {
    rootName: singleDirectory ? singleDirectory.name : ".",
    entries: collector.entries,
    archiveFormat: null,
    truncated: collector.truncated,
  };
}

// ---------------------------------------------------------------------------
// 圧縮ファイル
// ---------------------------------------------------------------------------

async function readSlice(file: Blob, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

/** ファイル先頭のバイト列から圧縮形式を判定する */
export async function detectArchiveFormat(file: Blob): Promise<ArchiveFormat | null> {
  const head = await readSlice(file, 0, 512);
  if (head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05) && (head[3] === 0x04 || head[3] === 0x06)) {
    return "zip";
  }
  if (head[0] === 0x1f && head[1] === 0x8b) return "tar.gz";
  if (head.length >= 262 && String.fromCharCode(...head.subarray(257, 262)) === "ustar") return "tar";
  // 古いV7形式のtarはマジックがないため、ヘッダーのチェックサムで判定する
  if (head.length === 512 && isValidTarHeader(head)) return "tar";
  return null;
}

/** 圧縮ファイルに含まれるパスの一覧を読み取る */
export async function readArchive(file: File, onProgress?: ProgressCallback): Promise<TreeSource> {
  const format = await detectArchiveFormat(file);
  if (!format) throw new UnsupportedArchiveError("unsupported archive");

  const collector = new EntryCollector(onProgress);
  if (format === "zip") {
    await readZipEntries(file, collector);
  } else {
    await readTarEntries(file, format === "tar.gz", collector);
  }

  return {
    rootName: file.name,
    entries: collector.entries,
    archiveFormat: format,
    truncated: collector.truncated,
  };
}

// --- ZIP -------------------------------------------------------------------

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

/** UTF-8フラグがないZIPのファイル名は、UTF-8として不正ならShift_JIS（日本語Windows）とみなす */
function decodeZipName(bytes: Uint8Array, isUtf8: boolean): string {
  try {
    return utf8Decoder.decode(bytes);
  } catch {
    if (!isUtf8) {
      try {
        return new TextDecoder("shift_jis").decode(bytes);
      } catch {
        // shift_jisに対応していない環境ではUTF-8として置換文字付きで読む
      }
    }
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function readUint64(view: DataView, offset: number): number {
  return view.getUint32(offset, true) + view.getUint32(offset + 4, true) * 2 ** 32;
}

/**
 * ZIPの末尾にある中央ディレクトリだけを読み取る。
 * ファイル全体を読み込まないため、大きなZIPでもすぐに一覧を取得できる。
 */
async function readZipEntries(file: File, collector: EntryCollector): Promise<void> {
  // 終端レコード（EOCD）は末尾22バイト＋コメント（最大65535バイト）の範囲にある
  const tailStart = Math.max(0, file.size - 22 - 0xffff);
  const tail = await readSlice(file, tailStart, file.size);
  const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);

  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i -= 1) {
    if (tailView.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new UnsupportedArchiveError("zip end of central directory not found");

  let entryCount = tailView.getUint16(eocd + 10, true);
  let cdSize = tailView.getUint32(eocd + 12, true);
  let cdOffset = tailView.getUint32(eocd + 16, true);

  // ZIP64: 値が上限に達している場合はZIP64終端レコードから読み直す
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff || entryCount === 0xffff) {
    const locator = eocd - 20;
    if (locator >= 0 && tailView.getUint32(locator, true) === 0x07064b50) {
      const zip64EocdOffset = readUint64(tailView, locator + 8);
      const record = await readSlice(file, zip64EocdOffset, zip64EocdOffset + 56);
      const recordView = new DataView(record.buffer, record.byteOffset, record.byteLength);
      if (recordView.getUint32(0, true) === 0x06064b50) {
        entryCount = readUint64(recordView, 32);
        cdSize = readUint64(recordView, 40);
        cdOffset = readUint64(recordView, 48);
      }
    }
  }

  const cd = await readSlice(file, cdOffset, cdOffset + cdSize);
  const view = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  let offset = 0;
  for (let index = 0; index < entryCount && offset + 46 <= cd.length; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const flags = view.getUint16(offset + 8, true);
    let size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = decodeZipName(cd.subarray(offset + 46, offset + 46 + nameLength), (flags & 0x800) !== 0);

    if (size === 0xffffffff) {
      // ZIP64拡張フィールド（ID 0x0001）の先頭に元のサイズが入っている
      let extra = offset + 46 + nameLength;
      const extraEnd = extra + extraLength;
      while (extra + 4 <= extraEnd) {
        const id = view.getUint16(extra, true);
        const length = view.getUint16(extra + 2, true);
        if (id === 0x0001 && length >= 8) {
          size = readUint64(view, extra + 4);
          break;
        }
        extra += 4 + length;
      }
    }

    // Windowsで作られたZIPは区切りが "\" の場合がある
    const path = name.replace(/\\/g, "/");
    const isDir = path.endsWith("/");
    if (!collector.add({ path, isDir, size: isDir ? 0 : size })) return;
    offset += 46 + nameLength + extraLength + commentLength;
  }
}

// --- TAR / TAR.GZ -----------------------------------------------------------

const TAR_BLOCK = 512;

function readTarString(block: Uint8Array, start: number, length: number): string {
  const bytes = block.subarray(start, start + length);
  const end = bytes.indexOf(0);
  return new TextDecoder("utf-8").decode(end >= 0 ? bytes.subarray(0, end) : bytes);
}

function readTarNumber(block: Uint8Array, start: number, length: number): number {
  // 先頭ビットが立っている場合はGNU形式の256進数（8GB超のファイル）
  if (block[start] & 0x80) {
    let value = block[start] & 0x7f;
    for (let i = 1; i < length; i += 1) value = value * 256 + block[start + i];
    return value;
  }
  const text = readTarString(block, start, length).trim();
  return text ? parseInt(text, 8) || 0 : 0;
}

function isValidTarHeader(block: Uint8Array): boolean {
  const expected = readTarNumber(block, 148, 8);
  let sum = 0;
  for (let i = 0; i < TAR_BLOCK; i += 1) sum += i >= 148 && i < 156 ? 0x20 : block[i];
  return sum === expected && block[0] !== 0;
}

/** PAX拡張ヘッダー（"長さ key=value\n" の繰り返し）から path を取り出す */
function parsePaxPath(data: Uint8Array): string | null {
  const text = new TextDecoder("utf-8").decode(data);
  for (const line of text.split("\n")) {
    const match = /^\d+ path=(.*)$/.exec(line);
    if (match) return match[1];
  }
  return null;
}

/** チャンク単位で受け取ったtarのバイト列から、ヘッダーだけを読み取るパーサー */
class TarHeaderParser {
  private buffer = new Uint8Array(TAR_BLOCK);
  private buffered = 0;
  private need = TAR_BLOCK;
  private skip = 0;
  /** ヘッダー以外に中身を読み取る必要がある拡張ヘッダーの種類 */
  private collecting: "longname" | "pax" | null = null;
  private collectPadding = 0;
  private nextName: string | null = null;
  done = false;
  private collector: EntryCollector;

  constructor(collector: EntryCollector) {
    this.collector = collector;
  }

  push(chunk: Uint8Array): void {
    let offset = 0;
    while (offset < chunk.length && !this.done) {
      if (this.skip > 0) {
        const count = Math.min(this.skip, chunk.length - offset);
        this.skip -= count;
        offset += count;
        continue;
      }
      if (this.buffer.length < this.need) {
        const grown = new Uint8Array(this.need);
        grown.set(this.buffer.subarray(0, this.buffered));
        this.buffer = grown;
      }
      const count = Math.min(this.need - this.buffered, chunk.length - offset);
      this.buffer.set(chunk.subarray(offset, offset + count), this.buffered);
      this.buffered += count;
      offset += count;
      if (this.buffered === this.need) {
        const data = this.buffer.subarray(0, this.need);
        this.buffered = 0;
        if (this.collecting) this.handleExtended(data);
        else this.handleHeader(data);
      }
    }
  }

  private handleExtended(data: Uint8Array) {
    const name =
      this.collecting === "pax" ? parsePaxPath(data) : readTarString(data, 0, data.length);
    if (name) this.nextName = name;
    this.collecting = null;
    this.need = TAR_BLOCK;
    this.skip = this.collectPadding;
  }

  private handleHeader(block: Uint8Array) {
    if (block.every((byte) => byte === 0)) {
      // 終端（ゼロ埋めブロック）。続くブロックは読み飛ばす
      this.done = true;
      return;
    }
    if (!isValidTarHeader(block)) throw new UnsupportedArchiveError("invalid tar header");

    const size = readTarNumber(block, 124, 12);
    const type = String.fromCharCode(block[156]);
    const padded = Math.ceil(size / TAR_BLOCK) * TAR_BLOCK;

    if (type === "L" || type === "x") {
      // GNUの長いファイル名・PAX拡張ヘッダーは次のエントリの名前を持つ
      this.collecting = type === "L" ? "longname" : "pax";
      this.need = Math.max(size, 1);
      this.collectPadding = padded - size;
      if (size === 0) {
        this.collecting = null;
        this.need = TAR_BLOCK;
      }
      return;
    }

    this.skip = padded;
    if (type === "g" || type === "K") return; // グローバル拡張ヘッダー・長いリンク先名は無視

    let name = this.nextName;
    this.nextName = null;
    if (!name) {
      name = readTarString(block, 0, 100);
      const isUstar = readTarString(block, 257, 6).startsWith("ustar");
      const prefix = isUstar ? readTarString(block, 345, 155) : "";
      if (prefix) name = `${prefix}/${name}`;
    }

    const isDir = type === "5" || name.endsWith("/");
    // ハードリンク（1）・シンボリックリンク（2）はサイズ0のファイルとして扱う
    const fileSize = type === "0" || type === "\0" || type === "7" ? size : 0;
    if (!this.collector.add({ path: name, isDir, size: isDir ? 0 : fileSize })) this.done = true;
  }
}

async function readTarEntries(file: File, gzipped: boolean, collector: EntryCollector): Promise<void> {
  const parser = new TarHeaderParser(collector);
  const reader = file.stream().getReader();

  let push: (chunk: Uint8Array, final: boolean) => void;
  if (gzipped) {
    const { Gunzip } = await import("fflate");
    const gunzip = new Gunzip((data) => {
      if (!parser.done) parser.push(data);
    });
    push = (chunk, final) => gunzip.push(chunk, final);
  } else {
    push = (chunk) => parser.push(chunk);
  }

  try {
    while (!parser.done) {
      const { value, done } = await reader.read();
      if (done) {
        push(new Uint8Array(0), true);
        break;
      }
      push(value, false);
    }
  } catch (error) {
    if (error instanceof UnsupportedArchiveError) throw error;
    // gzipの展開に失敗した場合（tar以外の.gzなど）
    throw new UnsupportedArchiveError(error instanceof Error ? error.message : "invalid archive");
  } finally {
    reader.cancel().catch(() => {});
  }

  if (collector.entries.length === 0 && !parser.done) {
    throw new UnsupportedArchiveError("empty or invalid tar");
  }
}
