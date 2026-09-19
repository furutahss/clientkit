"use client";

import * as React from "react";
import { Check, Copy, FileUp, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/lib/format-bytes";
import {
  computeAllHashes,
  normalizeHashForCompare,
  type HashAlgorithm,
} from "@/lib/hash";
import { cn } from "@/lib/utils";

type FileInfo = {
  name: string;
  size: number;
};

function HashRow({
  algorithm,
  value,
  expected,
  isPending,
}: {
  algorithm: HashAlgorithm;
  value: string | null;
  expected: string;
  isPending: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  const isMatch =
    expected.trim() && value
      ? normalizeHashForCompare(expected) === normalizeHashForCompare(value)
      : null;

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードAPIが利用できない環境では何もしない
    }
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {algorithm}
        </span>
        <div className="flex items-center gap-2">
          {isMatch !== null && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                isMatch
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {isMatch ? "Match" : "Mismatch"}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={handleCopy}
            disabled={!value}
            aria-label={`${algorithm}の値をコピー`}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
      <p className="font-mono text-sm break-all">
        {value ?? (
          <span className="text-muted-foreground">
            {isPending ? "計算中..." : "-"}
          </span>
        )}
      </p>
    </div>
  );
}

export function HashGeneratorTool() {
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [fileInfo, setFileInfo] = React.useState<FileInfo | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [hashes, setHashes] = React.useState<Record<HashAlgorithm, string> | null>(
    null
  );
  const [expected, setExpected] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const requestIdRef = React.useRef(0);

  React.useEffect(() => {
    const requestId = ++requestIdRef.current;

    async function run() {
      if (!file && !text) {
        setHashes(null);
        return;
      }

      try {
        const bytes = file
          ? new Uint8Array(await file.arrayBuffer())
          : new TextEncoder().encode(text);
        const result = await computeAllHashes(bytes);
        if (requestId === requestIdRef.current) {
          setHashes(result);
          setError(null);
        }
      } catch (e) {
        if (requestId === requestIdRef.current) {
          setError(
            e instanceof Error ? e.message : "ハッシュの計算に失敗しました。"
          );
        }
      }
    }

    run();
  }, [file, text]);

  function handleFile(newFile: File) {
    setFile(newFile);
    setFileInfo({ name: newFile.name, size: newFile.size });
    setText("");
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
    e.target.value = "";
  }

  function handleReset() {
    setFile(null);
    setFileInfo(null);
    setText("");
    setHashes(null);
    setError(null);
  }

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-4">
      {fileInfo ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{fileInfo.name}</span>
            <span className="text-muted-foreground">
              {formatBytes(fileInfo.size)}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="size-4" />
            別の入力に戻る
          </Button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col gap-2 rounded-lg border-2 border-dashed p-3 transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-border"
          )}
        >
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">テキスト入力</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="size-4" />
              ファイルを選択
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ハッシュを計算したいテキストを入力、またはファイルをこのエリアにドラッグ＆ドロップ"
            spellCheck={false}
            className="min-h-32 font-mono text-sm"
          />
          {text && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => setText("")}
            >
              <X className="size-4" />
              クリア
            </Button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">期待値との照合（任意）</label>
        <Input
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          placeholder="比較したいハッシュ値を貼り付け"
          spellCheck={false}
          className="font-mono text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"] as HashAlgorithm[]).map(
          (algorithm) => (
            <HashRow
              key={algorithm}
              algorithm={algorithm}
              value={hashes ? hashes[algorithm] : null}
              expected={expected}
              isPending={(!!file || !!text) && !hashes}
            />
          )
        )}
      </div>
    </div>
  );
}
