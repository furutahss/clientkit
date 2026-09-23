"use client";

import * as React from "react";
import { FileUp, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { locateJsonError } from "@/lib/json-error";
import { loadJsonPathLibrary, runJsonPath } from "@/lib/jsonpath-query";
import { useLazyModule } from "@/lib/lazy-module";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

type View = "values" | "paths";

/** 結果表示の最大文字数（コピーには全体が含まれる） */
const MAX_PREVIEW_CHARS = 200_000;

const SAMPLE_JSON = `{
  "store": {
    "book": [
      { "category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95 },
      { "category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99 },
      { "category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99 }
    ],
    "bicycle": { "color": "red", "price": 19.95 }
  }
}`;

const EXAMPLES = [
  "$.store.book[*].author",
  "$..price",
  "$.store.book[?(@.price < 10)].title",
  "$.store.book[-1:]",
  "$..book[?(@.isbn)]",
  "$.store.*",
];

export function JsonPathTesterTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.jsonpathTester;

  const [input, setInput] = React.useState("");
  const [path, setPath] = React.useState("$.store.book[*].author");
  const [view, setView] = React.useState<View>("values");
  const [fileError, setFileError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { module: jsonPath, error: libraryError } = useLazyModule(loadJsonPathLibrary);
  const deferredInput = React.useDeferredValue(input);
  const deferredPath = React.useDeferredValue(path);

  const loadFile = React.useCallback(
    (file: File) => {
      setFileError(null);
      file
        .text()
        .then(setInput)
        .catch(() => setFileError(dict.fileReadError));
    },
    [dict]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("jsonpath-tester");
    if (pending) Promise.resolve().then(() => loadFile(pending));
  }, [loadFile]);

  const parsed = React.useMemo(() => {
    if (!deferredInput.trim()) return null;
    try {
      return { ok: true as const, data: JSON.parse(deferredInput) as unknown };
    } catch (error) {
      return { ok: false as const, error: locateJsonError(deferredInput, error) };
    }
  }, [deferredInput]);

  const result = React.useMemo(() => {
    if (!parsed?.ok || !deferredPath.trim() || !jsonPath) return null;
    return runJsonPath(jsonPath, parsed.data, deferredPath.trim());
  }, [jsonPath, parsed, deferredPath]);

  const outputText = React.useMemo(() => {
    if (!result?.ok || result.matches.length === 0) return "";
    if (view === "paths") return result.matches.map((match) => match.path).join("\n");
    return JSON.stringify(
      result.matches.map((match) => match.value),
      null,
      2
    );
  }, [result, view]);

  const preview =
    outputText.length > MAX_PREVIEW_CHARS ? outputText.slice(0, MAX_PREVIEW_CHARS) : outputText;

  const VIEWS: { value: View; label: string }[] = [
    { value: "values", label: dict.viewValues },
    { value: "paths", label: dict.viewPaths },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="jsonpath-query" className="text-sm font-medium">
          {dict.queryLabel}
        </label>
        <Input
          id="jsonpath-query"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder={dict.queryPlaceholder}
          spellCheck={false}
          className="h-11 font-mono"
          aria-invalid={result && !result.ok ? true : undefined}
        />
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setPath(example)}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-xs transition-colors hover:bg-accent",
                path === example && "border-primary bg-primary/5"
              )}
            >
              {example}
            </button>
          ))}
        </div>
        {result && !result.ok && (
          <p className="text-sm text-destructive">
            {formatTemplate(dict.queryError, { message: result.message })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="jsonpath-input" className="text-sm font-medium">
              {dict.inputLabel}
            </label>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setInput(SAMPLE_JSON)}>
                {dict.loadSample}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                <FileUp className="size-4" />
                {dict.openFile}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFile(file);
                e.target.value = "";
              }}
            />
          </div>
          <Textarea
            id="jsonpath-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const file = e.dataTransfer.files?.[0];
              if (!file) return;
              e.preventDefault();
              loadFile(file);
            }}
            placeholder={dict.inputPlaceholder}
            spellCheck={false}
            className="min-h-96 font-mono text-sm"
            aria-invalid={parsed && !parsed.ok ? true : undefined}
          />
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          {parsed && !parsed.ok && (
            <p className="text-sm text-destructive">
              {formatTemplate(dict.jsonError, {
                line: parsed.error.line,
                column: parsed.error.column,
                message: parsed.error.message,
              })}
            </p>
          )}
          <ToolActions onClear={() => setInput("")} clearDisabled={!input} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{dict.outputLabel}</span>
              {result?.ok && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    result.matches.length > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  {formatTemplate(dict.matchCount, { count: result.matches.length })}
                </span>
              )}
            </div>
            <div className="inline-flex w-fit rounded-md border p-1">
              {VIEWS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setView(item.value)}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                    view === item.value
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            value={preview}
            readOnly
            placeholder={
              libraryError
                ? dict.libraryLoadError
                : !parsed
                ? dict.outputPlaceholder
                : !parsed.ok
                  ? dict.outputPlaceholderJsonError
                  : result?.ok && result.matches.length === 0
                    ? dict.noMatches
                    : dict.outputPlaceholder
            }
            spellCheck={false}
            className="min-h-96 font-mono text-sm"
            aria-label={dict.outputLabel}
          />
          {outputText.length > MAX_PREVIEW_CHARS && (
            <p className="text-xs text-muted-foreground">{dict.previewTruncated}</p>
          )}
          <ToolActions
            getCopyText={() => outputText}
            copyDisabled={!result?.ok || result.matches.length === 0}
          />
        </div>
      </div>
    </div>
  );
}
