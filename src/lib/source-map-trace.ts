/**
 * Source Map v3 を使って、圧縮後のJavaScriptのスタックトレースを元のソースの位置に戻す。
 * 単一の非分割Mapのみ対象（sections を持つインデックスMapは対象外）。外部のMap・ソースは取得しない。
 */
import { originalPositionFor, sourceContentFor, TraceMap } from "@jridgewell/trace-mapping";

import { locateJsonError, type JsonErrorLocation } from "@/lib/json-error";

export type MapLoadResult =
  | { status: "ok"; map: TraceMap; file?: string }
  | { status: "syntax"; error: JsonErrorLocation }
  | { status: "notObject" }
  | { status: "version"; version: unknown }
  | { status: "indexed" }
  | { status: "invalid"; message: string };

export function loadSourceMap(text: string): MapLoadResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { status: "syntax", error: locateJsonError(text, error) };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return { status: "notObject" };
  const raw = value as Record<string, unknown>;
  if (raw.version !== 3) return { status: "version", version: raw.version };
  if ("sections" in raw) return { status: "indexed" };
  if (typeof raw.mappings !== "string" || !Array.isArray(raw.sources)) {
    return { status: "invalid", message: "mappings / sources" };
  }
  try {
    const map = new TraceMap(raw as unknown as ConstructorParameters<typeof TraceMap>[0]);
    return { status: "ok", map, file: typeof raw.file === "string" ? raw.file : undefined };
  } catch (error) {
    return { status: "invalid", message: error instanceof Error ? error.message : String(error) };
  }
}

export type StackFrame = {
  /** スタックトレースの元の行 */
  text: string;
  location?: { url: string; line: number; column: number; prefix: string };
};

/** Chrome（at fn (url:1:2)）とFirefox・Safari（fn@url:1:2）の形式から位置を取り出す */
export function parseStack(text: string): StackFrame[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const match = line.match(/^(.*?)([^\s()@]+):(\d+):(\d+)\)?\s*$/);
      if (!match) return { text: line };
      return { text: line, location: { prefix: match[1], url: match[2], line: Number(match[3]), column: Number(match[4]) } };
    });
}

function baseName(url: string): string {
  return url.replace(/[?#].*$/, "").split("/").pop() ?? "";
}

export type ResolvedFrame =
  | { frame: StackFrame; status: "noLocation" | "otherFile" | "unmapped" }
  | {
      frame: StackFrame;
      status: "mapped";
      source: string;
      /** 1始まりの行・列 */
      line: number;
      column: number;
      name: string | null;
      /** 該当行の前後（sourcesContent がある場合のみ） */
      snippet?: { line: number; text: string }[];
    };

/**
 * columnBase はスタックトレースの列番号の基準。ブラウザのスタックトレースは1始まり、
 * Source Mapの内部表現は0始まりのため、ここで変換する。
 */
export function resolveStack(
  map: TraceMap,
  frames: StackFrame[],
  generatedFile: string,
  columnBase: 0 | 1
): ResolvedFrame[] {
  const target = baseName(generatedFile.trim());
  return frames.map((frame): ResolvedFrame => {
    const location = frame.location;
    if (!location) return { frame, status: "noLocation" };
    if (target !== "" && baseName(location.url) !== target) return { frame, status: "otherFile" };

    const column = location.column - columnBase;
    if (location.line < 1 || column < 0) return { frame, status: "unmapped" };
    const position = originalPositionFor(map, { line: location.line, column });
    if (position.source === null) return { frame, status: "unmapped" };

    const content = sourceContentFor(map, position.source);
    const lines = content?.split(/\r?\n/);
    const snippet = lines
      ?.map((text, index) => ({ line: index + 1, text }))
      .slice(Math.max(0, position.line - 3), position.line + 2);
    return {
      frame,
      status: "mapped",
      source: position.source,
      line: position.line,
      column: position.column + 1,
      name: position.name,
      snippet,
    };
  });
}
