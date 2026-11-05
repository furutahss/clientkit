"use client";

import * as React from "react";
import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToolActions } from "@/components/tools/tool-actions";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { HEX_PAGE_SIZE, formatHexDump, readHexPage } from "@/lib/hex-viewer";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

type Selection = { file: File; page: number };

export function HexViewerTool() {
  const dict = getDictionary(useLocale()).tools.hexViewer;
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [result, setResult] = React.useState<{ selection: Selection; text: string; failed: boolean } | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pageId = React.useId();

  React.useEffect(() => {
    const file = takePendingToolFile("hex-viewer");
    if (file) Promise.resolve().then(() => setSelection({ file, page: 0 }));
  }, []);

  React.useEffect(() => {
    if (!selection) return;
    let cancelled = false;
    readHexPage(selection.file, selection.page).then(
      (bytes) => {
        if (!cancelled) setResult({ selection, text: formatHexDump(bytes, selection.page * HEX_PAGE_SIZE), failed: false });
      },
      () => {
        if (!cancelled) setResult({ selection, text: "", failed: true });
      },
    );
    return () => { cancelled = true; };
  }, [selection]);

  const currentResult = result?.selection === selection ? result : null;
  const loading = !!selection && !currentResult;
  const pages = selection ? Math.max(1, Math.ceil(selection.file.size / HEX_PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn("flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center", dragActive && "border-primary bg-primary/5")}
        onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const file = event.dataTransfer.files[0];
          if (file) setSelection({ file, page: 0 });
        }}
      >
        <p className="text-sm text-muted-foreground">{dict.dropHint}</p>
        <Button variant="outline" onClick={() => inputRef.current?.click()}>
          <FileUp className="size-4" />{dict.chooseFile}
        </Button>
        <input ref={inputRef} type="file" className="hidden" aria-label={dict.chooseFile} onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setSelection({ file, page: 0 });
          event.target.value = "";
        }} />
      </div>
      <p className="text-xs text-muted-foreground">{dict.localHint}</p>
      {selection && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-sm break-all">
              <span className="font-medium">{selection.file.name}</span>
              {" · "}{formatTemplate(dict.fileSize, { size: selection.file.size })}
            </p>
            <ToolActions onClear={() => { setSelection(null); setResult(null); }} getCopyText={() => currentResult?.text ?? ""} copyDisabled={!currentResult?.text} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={selection.page === 0} onClick={() => setSelection({ ...selection, page: selection.page - 1 })}>{dict.previous}</Button>
            <label htmlFor={pageId} className="text-sm">{dict.page}</label>
            <Input id={pageId} type="number" min={1} max={pages} value={selection.page + 1} className="w-24" onChange={(event) => {
              const page = event.target.valueAsNumber;
              if (Number.isInteger(page) && page >= 1 && page <= pages) setSelection({ ...selection, page: page - 1 });
            }} />
            <span className="text-sm">/ {pages}</span>
            <Button variant="outline" size="sm" disabled={selection.page + 1 >= pages} onClick={() => setSelection({ ...selection, page: selection.page + 1 })}>{dict.next}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{dict.columns}</p>
          <div aria-busy={loading}>
            {loading ? <p role="status" className="text-sm">{dict.loading}</p>
              : currentResult?.failed ? <p role="alert" className="text-sm text-destructive">{dict.readError}</p>
              : selection.file.size === 0 ? <p role="status" className="text-sm">{dict.emptyFile}</p>
              : <pre tabIndex={0} aria-label={dict.outputLabel} className="max-h-[36rem] overflow-auto rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-6">{currentResult?.text}</pre>}
          </div>
        </>
      )}
    </div>
  );
}
