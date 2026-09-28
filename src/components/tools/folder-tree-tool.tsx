"use client";

import * as React from "react";
import { Archive, Download, FolderOpen, FolderTree, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { downloadBytes } from "@/lib/download";
import {
  buildTree,
  parseExcludePatterns,
  renderTree,
  type TreeRenderOptions,
  type TreeStyle,
} from "@/lib/file-tree";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import {
  MAX_TREE_ENTRIES,
  readArchive,
  readDroppedEntries,
  readFileList,
  UnsupportedArchiveError,
  type TreeSource,
} from "@/lib/tree-sources";
import { cn, formatTemplate } from "@/lib/utils";

/** 画面に表示する最大行数（コピー・ダウンロードは全行） */
const MAX_PREVIEW_LINES = 5000;
const DEPTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const STYLES: TreeStyle[] = ["unicode", "ascii", "indent", "markdown"];
const DEFAULT_EXCLUDE = "node_modules, .git, __MACOSX, .DS_Store";

type BooleanOption = "showFiles" | "showHidden" | "dirsFirst" | "showSize" | "dirSlash";

export function FolderTreeTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.folderTree, [locale]);

  const [source, setSource] = React.useState<TreeSource | null>(null);
  const [loadingCount, setLoadingCount] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [options, setOptions] = React.useState<Omit<TreeRenderOptions, "exclude">>({
    maxDepth: null,
    showFiles: true,
    showHidden: true,
    dirsFirst: true,
    showSize: false,
    dirSlash: true,
    style: "unicode",
  });
  const [excludeText, setExcludeText] = React.useState(DEFAULT_EXCLUDE);
  const [showSummary, setShowSummary] = React.useState(true);

  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const archiveInputRef = React.useRef<HTMLInputElement>(null);
  const deferredExclude = React.useDeferredValue(excludeText);

  // webkitdirectory はReactの型定義にないため、属性として直接設定する
  React.useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  const load = React.useCallback(
    async (task: (onProgress: (count: number) => void) => Promise<TreeSource>) => {
      setError(null);
      setLoadingCount(0);
      try {
        setSource(await task((count) => setLoadingCount(count)));
      } catch (e) {
        setSource(null);
        setError(e instanceof UnsupportedArchiveError ? dict.unsupportedFile : dict.loadError);
      } finally {
        setLoadingCount(null);
      }
    },
    [dict]
  );

  const loadArchive = React.useCallback(
    (file: File) => void load((onProgress) => readArchive(file, onProgress)),
    [load]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("folder-tree");
    if (pending) Promise.resolve().then(() => loadArchive(pending));
  }, [loadArchive]);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    // webkitGetAsEntry はドロップイベントの処理中にしか呼び出せないため、先に取り出しておく
    const entries = Array.from(e.dataTransfer.items)
      .map((item) => item.webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => !!entry);
    const files = Array.from(e.dataTransfer.files);

    if (entries.length === 1 && entries[0].isFile && files[0]) {
      loadArchive(files[0]);
    } else if (entries.length > 0) {
      void load((onProgress) => readDroppedEntries(entries, onProgress));
    } else if (files[0]) {
      loadArchive(files[0]);
    }
  }

  const tree = React.useMemo(
    () => (source ? buildTree(source.rootName, source.entries) : null),
    [source]
  );

  const result = React.useMemo(() => {
    if (!tree) return null;
    return renderTree(tree, { ...options, exclude: parseExcludePatterns(deferredExclude) });
  }, [tree, options, deferredExclude]);

  const outputText = React.useMemo(() => {
    if (!result) return "";
    if (!showSummary) return result.text;
    return `${result.text}\n\n${formatTemplate(dict.summary, { dirs: result.dirCount, files: result.fileCount })}`;
  }, [result, showSummary, dict]);

  const previewText = React.useMemo(() => {
    if (!result || result.lineCount <= MAX_PREVIEW_LINES) return outputText;
    return outputText.split("\n", MAX_PREVIEW_LINES).join("\n");
  }, [outputText, result]);

  const baseName = (source?.rootName ?? "tree").replace(/\.(zip|tar|tar\.gz|tgz|gz)$/i, "") || "tree";

  const booleanOptions: [BooleanOption, string][] = [
    ["showFiles", dict.showFiles],
    ["showHidden", dict.showHidden],
    ["dirsFirst", dict.dirsFirst],
    ["showSize", dict.showSize],
    ["dirSlash", dict.dirSlash],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const selected = Array.from(files);
            void load(async () => readFileList(selected));
          }
          e.target.value = "";
        }}
      />
      <input
        ref={archiveInputRef}
        type="file"
        accept=".zip,.tar,.tgz,.gz,application/zip,application/x-tar,application/gzip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadArchive(file);
          e.target.value = "";
        }}
      />

      {source && loadingCount === null ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <div className="flex items-center gap-3">
            {source.archiveFormat ? (
              <Archive className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : (
              <FolderOpen className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="flex flex-col gap-0.5">
              <span className="font-medium break-all">{source.rootName}</span>
              <span className="text-muted-foreground">
                {source.archiveFormat
                  ? formatTemplate(dict.sourceArchive, { format: source.archiveFormat.toUpperCase() })
                  : dict.sourceFolder}
                {" ・ "}
                {formatTemplate(dict.entryCount, { count: source.entries.length.toLocaleString() })}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSource(null);
              setError(null);
            }}
          >
            <RefreshCw className="size-4" />
            {dict.loadAnother}
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
            "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-border"
          )}
        >
          {loadingCount !== null ? (
            <>
              <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {formatTemplate(dict.loading, { count: loadingCount.toLocaleString() })}
              </p>
            </>
          ) : (
            <>
              <FolderTree className="size-8 text-muted-foreground" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{dict.dropLabel}</p>
                <p className="text-xs text-muted-foreground">{dict.dropHint}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => folderInputRef.current?.click()}>
                  <FolderOpen className="size-4" />
                  {dict.chooseFolder}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => archiveInputRef.current?.click()}>
                  <Archive className="size-4" />
                  {dict.chooseArchive}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {source?.truncated && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {formatTemplate(dict.truncated, { count: MAX_TREE_ENTRIES.toLocaleString() })}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex h-fit flex-col gap-4 rounded-md border p-3">
          <span className="text-sm font-medium">{dict.optionsHeading}</span>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">{dict.depthLabel}</label>
            <Select
              value={options.maxDepth === null ? "all" : String(options.maxDepth)}
              onValueChange={(value) =>
                setOptions((prev) => ({ ...prev, maxDepth: value === "all" ? null : Number(value) }))
              }
            >
              <SelectTrigger className="w-full" aria-label={dict.depthLabel}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{dict.depthUnlimited}</SelectItem>
                {DEPTH_OPTIONS.map((depth) => (
                  <SelectItem key={depth} value={String(depth)}>
                    {formatTemplate(dict.depthLevel, { depth })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">{dict.styleLabel}</label>
            <Select
              value={options.style}
              onValueChange={(value) => setOptions((prev) => ({ ...prev, style: value as TreeStyle }))}
            >
              <SelectTrigger className="w-full" aria-label={dict.styleLabel}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((style) => (
                  <SelectItem key={style} value={style}>
                    {dict.styles[style]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            {booleanOptions.map(([key, label]) => (
              <div key={key} className="flex items-start gap-2">
                <Checkbox
                  id={`folder-tree-${key}`}
                  checked={options[key]}
                  onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, [key]: checked === true }))}
                  className="mt-0.5"
                />
                <label htmlFor={`folder-tree-${key}`} className="text-sm">
                  {label}
                </label>
              </div>
            ))}
            <div className="flex items-start gap-2">
              <Checkbox
                id="folder-tree-summary"
                checked={showSummary}
                onCheckedChange={(checked) => setShowSummary(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor="folder-tree-summary" className="text-sm">
                {dict.showSummary}
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="folder-tree-exclude" className="text-xs text-muted-foreground">
              {dict.excludeLabel}
            </label>
            <Input
              id="folder-tree-exclude"
              value={excludeText}
              onChange={(e) => setExcludeText(e.target.value)}
              placeholder={dict.excludePlaceholder}
              spellCheck={false}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">{dict.excludeHint}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="folder-tree-output" className="text-sm font-medium">
              {dict.outputLabel}
            </label>
            {result && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatTemplate(dict.stats, {
                  dirs: result.dirCount.toLocaleString(),
                  files: result.fileCount.toLocaleString(),
                })}
              </span>
            )}
          </div>
          <Textarea
            id="folder-tree-output"
            value={previewText}
            readOnly
            wrap="off"
            placeholder={dict.outputPlaceholder}
            spellCheck={false}
            className="min-h-96 font-mono text-xs leading-relaxed"
          />
          {result && result.lineCount > MAX_PREVIEW_LINES && (
            <p className="text-xs text-muted-foreground">
              {formatTemplate(dict.previewTruncated, { count: MAX_PREVIEW_LINES.toLocaleString() })}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <ToolActions getCopyText={() => outputText} copyDisabled={!outputText} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!outputText}
              onClick={() =>
                downloadBytes(new TextEncoder().encode(`${outputText}\n`), `${baseName}-tree.txt`, "text/plain")
              }
            >
              <Download className="size-4" />
              {dict.download}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
