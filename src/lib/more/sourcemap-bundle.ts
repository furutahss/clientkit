import { eachMapping, TraceMap } from "@jridgewell/trace-mapping";

export type BundleEntry = { name: string; bytes: number; percent: number };

/** ソース名をまとめる単位にする（node_modules/パッケージ名、またはファイルのパス） */
export function groupName(source: string, mode: "package" | "file"): string {
  const s = source.replace(/^webpack:\/\/[^/]*\//, "").replace(/^\.\//, "").replace(/\?.*$/, "").replace(/^.*?(?=node_modules\/)/, "");
  const nm = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(s);
  if (nm) return mode === "package" ? nm[1] : s;
  return mode === "package" ? "(your code)" : s;
}

/**
 * Source Map のマッピングから、生成後のコードの各部分がどのソースに由来するかを集計する。
 * 生成ファイルがある場合はバイト数（UTF-8）、ない場合は、マッピングの文字数で按分する。
 */
export function analyzeBundle(mapJson: string, generated: string | undefined, mode: "package" | "file"): { entries: BundleEntry[]; total: number; unit: "bytes" | "chars"; unmapped: number } {
  const map = new TraceMap(mapJson);
  const lines = generated?.split("\n");
  const segs: { line: number; col: number; source: string }[] = [];
  eachMapping(map, (m) => { if (m.source) segs.push({ line: m.generatedLine, col: m.generatedColumn, source: m.source }); });
  segs.sort((a, b) => a.line - b.line || a.col - b.col);
  const enc = new TextEncoder();
  const sizes = new Map<string, number>();
  let mapped = 0;
  const lineLen = (l: number) => (lines ? lines[l - 1]?.length ?? 0 : Infinity);
  segs.forEach((s, i) => {
    const next = segs[i + 1];
    const end = next && next.line === s.line ? next.col : lineLen(s.line);
    let len = end - s.col;
    if (!Number.isFinite(len)) len = 1; // 生成ファイルがない場合は、マッピングの個数で按分する
    if (len <= 0) return;
    const bytes = lines ? enc.encode(lines[s.line - 1].slice(s.col, s.col + len)).length : len;
    const name = groupName(s.source, mode);
    sizes.set(name, (sizes.get(name) ?? 0) + bytes);
    mapped += bytes;
  });
  const total = lines ? enc.encode(generated!).length : mapped;
  const entries = [...sizes].map(([name, bytes]) => ({ name, bytes, percent: total ? (bytes / total) * 100 : 0 })).sort((a, b) => b.bytes - a.bytes);
  return { entries, total, unit: lines ? "bytes" : "chars", unmapped: lines ? Math.max(0, total - mapped) : 0 };
}
