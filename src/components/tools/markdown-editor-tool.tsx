"use client";

import * as React from "react";
import { Download, FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { markdownToHtml, wrapHtmlDocument } from "@/lib/markdown";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

type Tab = "preview" | "html";

const MARKDOWN_FILE_ACCEPT =
  ".md,.markdown,.mdown,.mkd,.mdx,.txt,text/markdown,text/x-markdown,text/plain";

/** 読み込んだファイル名から拡張子を除いたベース名を取り出す */
function getBaseName(filename: string): string {
  const base = filename.replace(/\.[^./\\]+$/, "");
  return base || "document";
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function MarkdownEditorTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.markdownEditor;
  const [markdown, setMarkdown] = React.useState(dict.sampleMarkdown);
  const [tab, setTab] = React.useState<Tab>("preview");
  const [sanitizedHtml, setSanitizedHtml] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const baseName = fileName ? getBaseName(fileName) : "document";

  function handleFile(file: File) {
    file.text().then(
      (text) => {
        setMarkdown(text);
        setFileName(file.name);
        setFileError(null);
      },
      () => setFileError(dict.readError)
    );
  }

  React.useEffect(() => {
    const pending = takePendingToolFile("markdown-editor");
    if (pending) handleFile(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- マウント時に一度だけ引き継ぎファイルを確認する
  }, []);

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

  React.useEffect(() => {
    let cancelled = false;

    import("dompurify").then(({ default: DOMPurify }) => {
      if (cancelled) return;
      const rawHtml = markdownToHtml(markdown);
      setSanitizedHtml(DOMPurify.sanitize(rawHtml));
    });

    return () => {
      cancelled = true;
    };
  }, [markdown]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium">{dict.inputLabel}</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="size-4" />
              {dict.chooseFile}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={MARKDOWN_FILE_ACCEPT}
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={handleDrop}
            className={cn(
              "rounded-md transition-colors",
              isDragActive && "ring-2 ring-primary ring-offset-2"
            )}
          >
            <Textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              spellCheck={false}
              className={cn(
                "min-h-96 font-mono text-sm",
                isDragActive && "bg-primary/5"
              )}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {fileName
              ? formatTemplate(dict.loadedFile, { name: fileName })
              : dict.dropHint}
          </p>
          {fileError && (
            <p className="text-sm text-destructive">{fileError}</p>
          )}
          <ToolActions
            onClear={() => {
              setMarkdown("");
              setFileName(null);
              setFileError(null);
            }}
            clearDisabled={!markdown}
            getCopyText={() => markdown}
            copyDisabled={!markdown}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => downloadFile(
                `${baseName}.md`,
                markdown,
                "text/markdown;charset=utf-8"
              )}
            disabled={!markdown}
          >
            <Download className="size-4" />
            {dict.downloadMd}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit rounded-md border p-1">
            {(
              [
                { value: "preview", label: dict.tabPreview },
                { value: "html", label: dict.tabHtml },
              ] as { value: Tab; label: string }[]
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === item.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "preview" ? (
            <div
              className="prose prose-sm dark:prose-invert min-h-96 max-w-none overflow-auto rounded-md border p-4"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <Textarea
              value={sanitizedHtml}
              readOnly
              spellCheck={false}
              className="min-h-96 font-mono text-sm"
            />
          )}

          <div className="flex flex-wrap gap-2">
            <ToolActions
              getCopyText={() => sanitizedHtml}
              copyDisabled={!sanitizedHtml}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadFile(
                  `${baseName}.html`,
                  wrapHtmlDocument(sanitizedHtml, baseName),
                  "text/html;charset=utf-8"
                )
              }
              disabled={!sanitizedHtml}
            >
              <Download className="size-4" />
              {dict.downloadHtml}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
