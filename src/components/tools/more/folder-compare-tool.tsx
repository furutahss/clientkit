"use client";

import * as React from "react";
import { FolderOpen } from "lucide-react";

import { ResultView, useT } from "@/components/tools/more/kit";
import { SafetyNote } from "@/components/tools/text-input-panel";
import { Button } from "@/components/ui/button";
import { bytesToHex } from "@/lib/more/util";
import { compareFolders, relativePath, type CompareRow, type FileInfo } from "@/lib/more/folder-compare";

const MAX_FILES = 3000;
const MAX_BYTES = 200 * 1024 * 1024;

async function describeFolder(files: File[]): Promise<FileInfo[]> {
  const out: FileInfo[] = [];
  for (const f of files) {
    // 大きなファイルはサイズと更新日時で代用し、全体を読み込まない
    const hash = f.size > MAX_BYTES / 4 ? `large:${f.size}:${f.lastModified}` : bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", await f.arrayBuffer())));
    out.push({ path: relativePath(f.webkitRelativePath || f.name), size: f.size, hash });
  }
  return out;
}

function FolderPicker({ label, files, onPick }: { label: string; files: File[] | null; onPick: (f: File[]) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const { t } = useT();
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border p-4">
      <span className="text-sm font-medium">{label}</span>
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}><FolderOpen className="size-4" />{t("フォルダを選択", "Choose folder")}</Button>
      <input ref={(el) => { ref.current = el; if (el) el.setAttribute("webkitdirectory", ""); }} type="file" multiple className="hidden" onChange={(e) => { onPick(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      <span className="text-xs text-muted-foreground">{files ? t(`${files.length} ファイル`, `${files.length} file(s)`) : t("未選択", "Not selected")}</span>
    </div>
  );
}

export function FolderCompareTool() {
  const { lang, t } = useT();
  const [a, setA] = React.useState<File[] | null>(null);
  const [b, setB] = React.useState<File[] | null>(null);
  const [rows, setRows] = React.useState<CompareRow[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showSame, setShowSame] = React.useState(false);

  async function run() {
    if (!a || !b) return;
    setBusy(true); setError(""); setRows(null);
    try {
      if (a.length > MAX_FILES || b.length > MAX_FILES) throw new Error(t(`ファイルが多すぎます（上限 ${MAX_FILES} 件）。`, `Too many files (limit ${MAX_FILES}).`));
      const [ia, ib] = await Promise.all([describeFolder(a), describeFolder(b)]);
      setRows(compareFolders(ia, ib));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const count = (s: CompareRow["status"]) => rows?.filter((r) => r.status === s).length ?? 0;
  const label: Record<CompareRow["status"], string> = { same: t("同一", "same"), modified: t("変更", "modified"), "only-a": t("Aのみ", "only in A"), "only-b": t("Bのみ", "only in B") };
  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{t("フォルダの中身はこのブラウザ内だけで読み込み、比較します（アップロードされません）。ファイル内容はSHA-256で比較します。", "Folder contents are read and compared only in this browser (nothing is uploaded). File contents are compared with SHA-256.")}</SafetyNote>
      <div className="grid gap-3 sm:grid-cols-2">
        <FolderPicker label={t("フォルダ A（元）", "Folder A (original)")} files={a} onPick={setA} />
        <FolderPicker label={t("フォルダ B（比較先）", "Folder B (compare to)")} files={b} onPick={setB} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={!a || !b || busy} onClick={run}>{busy ? t("比較中…", "Comparing…") : t("比較する", "Compare")}</Button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showSame} onChange={(e) => setShowSame(e.target.checked)} className="size-4" />{t("同一のファイルも表示", "Show identical files")}</label>
      </div>
      <ResultView lang={lang} result={error ? { error } : rows ? { notes: [t(`変更 ${count("modified")} ／ Aのみ ${count("only-a")} ／ Bのみ ${count("only-b")} ／ 同一 ${count("same")}。大きなファイル（50MB超）は内容を読まず、サイズと更新日時で比べます。`, `${count("modified")} modified, ${count("only-a")} only in A, ${count("only-b")} only in B, ${count("same")} identical. Files over 50 MB are compared by size and modification time instead of contents.`)], tables: [{ head: [t("状態", "Status"), t("パス", "Path"), t("サイズ A", "Size A"), t("サイズ B", "Size B")], rows: rows.filter((r) => showSame || r.status !== "same").map((r) => [label[r.status], r.path, r.sizeA ?? "-", r.sizeB ?? "-"]) }] } : null} />
    </div>
  );
}
