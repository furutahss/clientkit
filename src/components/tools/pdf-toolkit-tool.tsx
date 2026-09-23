"use client";

import * as React from "react";
import {
  Download,
  FileText,
  FileUp,
  GripVertical,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/format-bytes";
import { createZip, downloadBytes } from "@/lib/download";
import {
  baseName,
  buildPdf,
  chunkPages,
  formatPageGroup,
  normalizeRotation,
  parsePageSpec,
  PdfLoadError,
  readPdfPageCount,
  type PdfPageItem,
  type PdfSourceFile,
} from "@/lib/pdf-pages";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

type Mode = "merge" | "split" | "extract";
type SplitMethod = "ranges" | "every";

/** これを超えるPDFは処理に時間がかかる旨を表示する */
const LARGE_FILE_BYTES = 100 * 1024 * 1024;

function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

export function PdfToolkitTool() {
  const locale = useLocale();
  const dict = React.useMemo(
    () => getDictionary(locale).tools.pdfToolkit,
    [locale]
  );

  const [files, setFiles] = React.useState<PdfSourceFile[]>([]);
  const [pages, setPages] = React.useState<PdfPageItem[]>([]);
  const [mode, setMode] = React.useState<Mode>("merge");
  const [splitMethod, setSplitMethod] = React.useState<SplitMethod>("ranges");
  const [rangeSpec, setRangeSpec] = React.useState("");
  const [everyCount, setEveryCount] = React.useState(1);
  const [extractSpec, setExtractSpec] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [loadErrors, setLoadErrors] = React.useState<string[]>([]);
  const [processError, setProcessError] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const nextIdRef = React.useRef(0);
  const dragPageIndexRef = React.useRef<number | null>(null);

  const MODES: { value: Mode; label: string }[] = [
    { value: "merge", label: dict.modeMerge },
    { value: "split", label: dict.modeSplit },
    { value: "extract", label: dict.modeExtract },
  ];

  const handleFiles = React.useCallback(
    async (selected: File[]) => {
      const errors: string[] = [];
      const loaded: PdfSourceFile[] = [];
      setIsLoading(true);
      setProcessError(null);

      for (const file of selected) {
        if (!isPdfFile(file)) {
          errors.push(formatTemplate(dict.invalidFileType, { name: file.name }));
          continue;
        }
        try {
          const bytes = await file.arrayBuffer();
          const pageCount = await readPdfPageCount(bytes);
          loaded.push({
            id: `f${nextIdRef.current++}`,
            name: file.name,
            size: file.size,
            pageCount,
            bytes,
          });
        } catch (error) {
          errors.push(
            formatTemplate(
              error instanceof PdfLoadError && error.code === "encrypted"
                ? dict.encryptedError
                : dict.loadError,
              { name: file.name }
            )
          );
        }
      }

      setLoadErrors(errors);
      if (loaded.length > 0) {
        setFiles((prev) => [...prev, ...loaded]);
        setPages((prev) => [
          ...prev,
          ...loaded.flatMap((file) =>
            Array.from({ length: file.pageCount }, (_, pageIndex) => ({
              key: `${file.id}-${pageIndex}`,
              fileId: file.id,
              pageIndex,
              rotation: 0,
            }))
          ),
        ]);
      }
      setIsLoading(false);
    },
    [dict]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("pdf-toolkit");
    if (!pending) return;
    const timer = window.setTimeout(() => {
      void handleFiles([pending]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [handleFiles]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    if (selected.length > 0) void handleFiles(selected);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    const dropped = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (dropped.length > 0) void handleFiles(dropped);
  }

  function handleReset() {
    setFiles([]);
    setPages([]);
    setLoadErrors([]);
    setProcessError(null);
    setRangeSpec("");
    setExtractSpec("");
    setEveryCount(1);
  }

  function handleRemoveFile(fileId: string) {
    setFiles((prev) => prev.filter((file) => file.id !== fileId));
    setPages((prev) => prev.filter((page) => page.fileId !== fileId));
  }

  function handleRestoreOrder() {
    setPages(
      files.flatMap((file) =>
        Array.from({ length: file.pageCount }, (_, pageIndex) => ({
          key: `${file.id}-${pageIndex}`,
          fileId: file.id,
          pageIndex,
          rotation: 0,
        }))
      )
    );
  }

  function rotatePage(key: string, delta: number) {
    setPages((prev) =>
      prev.map((page) =>
        page.key === key
          ? { ...page, rotation: normalizeRotation(page.rotation + delta) }
          : page
      )
    );
  }

  function rotateAll(delta: number) {
    setPages((prev) =>
      prev.map((page) => ({
        ...page,
        rotation: normalizeRotation(page.rotation + delta),
      }))
    );
  }

  function removePage(key: string) {
    setPages((prev) => prev.filter((page) => page.key !== key));
  }

  function movePage(from: number, to: number) {
    if (to < 0 || to >= pages.length || from === to) return;
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handlePageDrop(index: number) {
    const from = dragPageIndexRef.current;
    dragPageIndexRef.current = null;
    if (from === null) return;
    movePage(from, index);
  }

  const fileById = React.useMemo(
    () => new Map(files.map((file) => [file.id, file])),
    [files]
  );

  const outputBaseName =
    files.length === 1 ? baseName(files[0].name) : dict.mergedBaseName;

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  const splitGroups = React.useMemo(() => {
    if (mode !== "split" || pages.length === 0) return null;
    if (splitMethod === "every") {
      return { ok: true as const, groups: chunkPages(pages.length, everyCount) };
    }
    if (!rangeSpec.trim()) return null;
    return parsePageSpec(rangeSpec, pages.length);
  }, [mode, splitMethod, rangeSpec, everyCount, pages.length]);

  const extractGroups = React.useMemo(() => {
    if (mode !== "extract" || pages.length === 0 || !extractSpec.trim()) {
      return null;
    }
    return parsePageSpec(extractSpec, pages.length);
  }, [mode, extractSpec, pages.length]);

  function specErrorMessage(
    result: ReturnType<typeof parsePageSpec> | null
  ): string | null {
    if (!result || result.ok) return null;
    if (result.error === "out-of-range") {
      return formatTemplate(dict.specOutOfRange, {
        token: result.token ?? "",
        total: pages.length,
      });
    }
    if (result.error === "invalid") {
      return formatTemplate(dict.specInvalid, { token: result.token ?? "" });
    }
    return dict.specEmpty;
  }

  async function runProcessing(task: () => Promise<void>) {
    setIsProcessing(true);
    setProcessError(null);
    try {
      await task();
    } catch {
      setProcessError(dict.processError);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleDownloadMerged() {
    void runProcessing(async () => {
      const bytes = await buildPdf(files, pages);
      downloadBytes(bytes, `${outputBaseName}.pdf`, "application/pdf");
    });
  }

  function handleDownloadExtract() {
    if (!extractGroups?.ok) return;
    const selected = extractGroups.groups.flat().map((index) => pages[index]);
    void runProcessing(async () => {
      const bytes = await buildPdf(files, selected);
      downloadBytes(
        bytes,
        `${outputBaseName}_extract.pdf`,
        "application/pdf"
      );
    });
  }

  function handleDownloadSplit() {
    if (!splitGroups?.ok) return;
    const groups = splitGroups.groups;
    void runProcessing(async () => {
      const entries: { name: string; data: Uint8Array }[] = [];
      for (const group of groups) {
        const data = await buildPdf(
          files,
          group.map((index) => pages[index])
        );
        entries.push({
          name: `${outputBaseName}_p${formatPageGroup(group).replace(/, /g, "_")}.pdf`,
          data,
        });
      }
      if (entries.length === 1) {
        downloadBytes(entries[0].data, entries[0].name, "application/pdf");
        return;
      }
      const zip = await createZip(entries);
      downloadBytes(zip, `${outputBaseName}_split.zip`, "application/zip");
    });
  }

  const splitError = specErrorMessage(splitGroups);
  const extractError = specErrorMessage(extractGroups);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      {files.length === 0 ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          className={cn(
            "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-accent/30"
          )}
        >
          {isLoading ? (
            <Loader2 className="size-10 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : (
            <FileUp className="size-10 text-muted-foreground" aria-hidden="true" />
          )}
          <div className="flex flex-col gap-1">
            <p className="font-medium">{isLoading ? dict.loading : dict.dropLabel}</p>
            <p className="text-sm text-muted-foreground">{dict.dropHint}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {formatTemplate(dict.summary, {
                  files: files.length,
                  pages: pages.length,
                  size: formatBytes(totalSize),
                })}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  {dict.addFiles}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                  <RefreshCw className="size-4" />
                  {dict.startOver}
                </Button>
              </div>
            </div>
            <ul className="flex flex-col gap-1.5">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatTemplate(dict.fileMeta, {
                      pages: file.pageCount,
                      size: formatBytes(file.size),
                    })}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => handleRemoveFile(file.id)}
                    aria-label={formatTemplate(dict.removeFile, { name: file.name })}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            {totalSize > LARGE_FILE_BYTES && (
              <p className="text-xs text-muted-foreground">{dict.largeFileNote}</p>
            )}
          </div>

          <div className="inline-flex w-fit rounded-md border p-1">
            {MODES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setMode(item.value)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === item.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-4">
            {mode === "merge" && (
              <>
                <p className="text-sm text-muted-foreground">{dict.mergeHint}</p>
                <Button
                  type="button"
                  className="w-fit"
                  onClick={handleDownloadMerged}
                  disabled={isProcessing || pages.length === 0}
                >
                  {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {isProcessing ? dict.processing : dict.downloadMerged}
                </Button>
              </>
            )}

            {mode === "split" && (
              <>
                <div className="inline-flex w-fit rounded-md border p-1">
                  {(
                    [
                      { value: "ranges", label: dict.splitByRanges },
                      { value: "every", label: dict.splitEvery },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSplitMethod(item.value)}
                      className={cn(
                        "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                        splitMethod === item.value
                          ? "bg-secondary text-secondary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {splitMethod === "ranges" ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="pdf-split-spec" className="text-sm font-medium">
                      {dict.rangesLabel}
                    </label>
                    <Input
                      id="pdf-split-spec"
                      value={rangeSpec}
                      onChange={(e) => setRangeSpec(e.target.value)}
                      placeholder={dict.rangesPlaceholder}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">{dict.rangesHint}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label htmlFor="pdf-split-every" className="text-sm font-medium">
                      {dict.everyLabel}
                    </label>
                    <Input
                      id="pdf-split-every"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={pages.length}
                      value={everyCount}
                      onChange={(e) =>
                        setEveryCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                      }
                      className="h-8 w-24 text-right"
                    />
                    <span className="text-sm text-muted-foreground">{dict.everyUnit}</span>
                  </div>
                )}
                {splitError && <p className="text-sm text-destructive">{splitError}</p>}
                {splitGroups?.ok && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      {formatTemplate(dict.splitPreview, { count: splitGroups.groups.length })}
                    </span>
                    <ul className="flex max-h-40 flex-col gap-0.5 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-xs">
                      {splitGroups.groups.slice(0, 200).map((group, index) => (
                        <li key={index}>
                          {formatTemplate(dict.splitPreviewItem, {
                            n: index + 1,
                            pages: formatPageGroup(group),
                          })}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  type="button"
                  className="w-fit"
                  onClick={handleDownloadSplit}
                  disabled={isProcessing || !splitGroups?.ok}
                >
                  {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {isProcessing ? dict.processing : dict.downloadSplit}
                </Button>
              </>
            )}

            {mode === "extract" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pdf-extract-spec" className="text-sm font-medium">
                    {dict.extractLabel}
                  </label>
                  <Input
                    id="pdf-extract-spec"
                    value={extractSpec}
                    onChange={(e) => setExtractSpec(e.target.value)}
                    placeholder={dict.extractPlaceholder}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">{dict.extractHint}</p>
                </div>
                {extractError && <p className="text-sm text-destructive">{extractError}</p>}
                {extractGroups?.ok && (
                  <p className="text-xs text-muted-foreground">
                    {formatTemplate(dict.extractPreview, {
                      count: extractGroups.groups.flat().length,
                    })}
                  </p>
                )}
                <Button
                  type="button"
                  className="w-fit"
                  onClick={handleDownloadExtract}
                  disabled={isProcessing || !extractGroups?.ok}
                >
                  {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {isProcessing ? dict.processing : dict.downloadExtract}
                </Button>
              </>
            )}

            {processError && <p className="text-sm text-destructive">{processError}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{dict.pagesHeading}</span>
                <span className="text-xs text-muted-foreground">{dict.pagesHint}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => rotateAll(-90)}>
                  <RotateCcw className="size-4" />
                  {dict.rotateAllLeft}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => rotateAll(90)}>
                  <RotateCw className="size-4" />
                  {dict.rotateAllRight}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleRestoreOrder}>
                  <Undo2 className="size-4" />
                  {dict.restoreOrder}
                </Button>
              </div>
            </div>

            {pages.length === 0 ? (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                {dict.noPages}
              </p>
            ) : (
              <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {pages.map((page, index) => {
                  const file = fileById.get(page.fileId);
                  return (
                    <li
                      key={page.key}
                      draggable
                      onDragStart={() => {
                        dragPageIndexRef.current = index;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handlePageDrop(index)}
                      className="flex flex-col gap-2 rounded-md border bg-background p-2"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                          <GripVertical className="size-3.5 cursor-grab text-muted-foreground" aria-hidden="true" />
                          {index + 1}
                        </span>
                        {page.rotation !== 0 && (
                          <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground tabular-nums">
                            {page.rotation}°
                          </span>
                        )}
                      </div>
                      <div className="flex h-20 items-center justify-center">
                        <div
                          className="flex h-16 w-12 items-center justify-center rounded-sm border bg-muted/40 transition-transform"
                          style={{ transform: `rotate(${page.rotation}deg)` }}
                          aria-hidden="true"
                        >
                          <span className="text-[10px] text-muted-foreground">
                            P{page.pageIndex + 1}
                          </span>
                        </div>
                      </div>
                      <span className="truncate text-[11px] text-muted-foreground" title={file?.name}>
                        {formatTemplate(dict.pageSource, {
                          name: file?.name ?? "",
                          page: page.pageIndex + 1,
                        })}
                      </span>
                      <div className="flex items-center justify-between">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => rotatePage(page.key, -90)}
                          aria-label={dict.rotateLeft}
                          title={dict.rotateLeft}
                        >
                          <RotateCcw className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => rotatePage(page.key, 90)}
                          aria-label={dict.rotateRight}
                          title={dict.rotateRight}
                        >
                          <RotateCw className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => movePage(index, index - 1)}
                          disabled={index === 0}
                          aria-label={dict.moveBefore}
                          title={dict.moveBefore}
                        >
                          <span aria-hidden="true">←</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => movePage(index, index + 1)}
                          disabled={index === pages.length - 1}
                          aria-label={dict.moveAfter}
                          title={dict.moveAfter}
                        >
                          <span aria-hidden="true">→</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => removePage(page.key)}
                          aria-label={dict.removePage}
                          title={dict.removePage}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}

      {loadErrors.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-destructive">
          {loadErrors.map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
