"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { markdownToHtml, wrapHtmlDocument } from "@/lib/markdown";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn } from "@/lib/utils";

type Tab = "preview" | "html";

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
          <label className="text-sm font-medium">{dict.inputLabel}</label>
          <Textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            spellCheck={false}
            className="min-h-96 font-mono text-sm"
          />
          <ToolActions
            onClear={() => setMarkdown("")}
            clearDisabled={!markdown}
            getCopyText={() => markdown}
            copyDisabled={!markdown}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => downloadFile("document.md", markdown, "text/markdown;charset=utf-8")}
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
                  "document.html",
                  wrapHtmlDocument(sanitizedHtml, "document"),
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
