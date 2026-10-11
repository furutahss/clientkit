"use client";

import * as React from "react";
import { UploadCloud, X } from "lucide-react";

import { ToolCard } from "@/components/home/tool-card";
import { Button } from "@/components/ui/button";
import { getToolsForFile } from "@/config/tools";
import { formatBytes } from "@/lib/format-bytes";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { setPendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

export function SmartDrop() {
  const locale = useLocale();
  const dict = getDictionary(locale).smartDrop;
  const discovery = getDictionary(locale).discovery;

  const [file, setFile] = React.useState<File | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const matches = React.useMemo(
    () => (file ? getToolsForFile(file) : []),
    [file],
  );

  function handleDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setIsDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
    e.target.value = "";
  }

  function handleClear() {
    setFile(null);
  }

  return (
    <section className="flex flex-col gap-3" aria-label={dict.heading}>
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{file.name}</span>
            <span className="text-muted-foreground">
              {formatBytes(file.size)}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleClear}>
            <X className="size-4" />
            {dict.clear}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex min-h-16 cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-dashed p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
            isDragActive ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          <UploadCloud
            className={cn(
              "size-5 shrink-0",
              isDragActive ? "text-primary" : "text-muted-foreground",
            )}
            aria-hidden="true"
          />
          <span className="text-sm font-medium">
            {isDragActive ? dict.dropActive : discovery.dropCompact}
          </span>
          <span className="ml-auto text-xs text-muted-foreground underline underline-offset-4">
            {dict.chooseFile}
          </span>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
        aria-label={dict.chooseFile}
      />

      {file &&
        (matches.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-muted-foreground">
                {formatTemplate(dict.resultsHeading, { fileName: file.name })}
              </h3>
              <p className="text-xs text-muted-foreground">
                {dict.resultsHint}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  lang={locale}
                  onSelect={() => setPendingToolFile(tool.id, file)}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {dict.noResults}
          </p>
        ))}
    </section>
  );
}
