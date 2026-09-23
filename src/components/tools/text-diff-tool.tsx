"use client";

import * as React from "react";
import { ArrowLeftRight, FileUp, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import {
  collapseUnchanged,
  computeTextDiff,
  loadDiffLibrary,
  type DiffLine,
  type SplitRow,
} from "@/lib/text-diff";
import { useLazyModule } from "@/lib/lazy-module";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

type ViewMode = "split" | "unified";
type Granularity = "line" | "char";

/** 画面に描画する行数の上限（それ以上は省略表示） */
const MAX_RENDER_ROWS = 5000;
/** 変更箇所のみ表示するときに前後に残す行数 */
const CONTEXT_LINES = 3;

const LINE_CLASS: Record<DiffLine["type"], string> = {
  equal: "",
  removed: "bg-red-50 dark:bg-red-500/10",
  added: "bg-emerald-50 dark:bg-emerald-500/10",
};

const MARK_CLASS: Record<DiffLine["type"], string> = {
  equal: "",
  removed: "rounded-sm bg-red-200 text-red-950 dark:bg-red-500/40 dark:text-red-50",
  added: "rounded-sm bg-emerald-200 text-emerald-950 dark:bg-emerald-500/40 dark:text-emerald-50",
};

function LineText({ line }: { line: DiffLine }) {
  if (!line.segments) {
    return <>{line.text || " "}</>;
  }
  return (
    <>
      {line.segments.map((segment, index) =>
        segment.changed ? (
          <mark key={index} className={MARK_CLASS[line.type]}>
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
      {line.segments.length === 0 && " "}
    </>
  );
}

function prefixFor(type: DiffLine["type"]): string {
  return type === "added" ? "+" : type === "removed" ? "-" : " ";
}

function SkippedRow({ count, colSpan, label }: { count: number; colSpan: number; label: string }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="border-y bg-muted/40 px-3 py-1 text-center text-xs text-muted-foreground"
      >
        {formatTemplate(label, { count })}
      </td>
    </tr>
  );
}

export function TextDiffTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.textDiff;

  const [left, setLeft] = React.useState("");
  const [right, setRight] = React.useState("");
  const [viewMode, setViewMode] = React.useState<ViewMode>("split");
  const [granularity, setGranularity] = React.useState<Granularity>("char");
  const [ignoreWhitespace, setIgnoreWhitespace] = React.useState(false);
  const [onlyChanges, setOnlyChanges] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);

  const leftFileRef = React.useRef<HTMLInputElement>(null);
  const rightFileRef = React.useRef<HTMLInputElement>(null);

  const { module: diffLibrary, error: libraryError } = useLazyModule(loadDiffLibrary);
  const deferredLeft = React.useDeferredValue(left);
  const deferredRight = React.useDeferredValue(right);

  React.useEffect(() => {
    const pending = takePendingToolFile("text-diff");
    if (!pending) return;
    pending
      .text()
      .then((text) => setLeft(text))
      .catch(() => setFileError(dict.fileReadError));
  }, [dict.fileReadError]);

  function loadFile(file: File, setter: (value: string) => void) {
    setFileError(null);
    file
      .text()
      .then(setter)
      .catch(() => setFileError(dict.fileReadError));
  }

  const hasInput = deferredLeft !== "" || deferredRight !== "";

  const result = React.useMemo(() => {
    if (!hasInput || !diffLibrary) return undefined;
    return computeTextDiff(diffLibrary, deferredLeft, deferredRight, {
      ignoreWhitespace,
      charLevel: granularity === "char",
    });
  }, [diffLibrary, deferredLeft, deferredRight, hasInput, ignoreWhitespace, granularity]);

  const unifiedItems = React.useMemo(() => {
    if (!result) return [];
    return onlyChanges
      ? collapseUnchanged(result.lines, (line) => line.type !== "equal", CONTEXT_LINES)
      : result.lines;
  }, [result, onlyChanges]);

  const splitItems = React.useMemo(() => {
    if (!result) return [];
    return onlyChanges
      ? collapseUnchanged(
          result.rows,
          (row: SplitRow) => row.left?.type !== "equal" || row.right?.type !== "equal",
          CONTEXT_LINES
        )
      : result.rows;
  }, [result, onlyChanges]);

  const items = viewMode === "split" ? splitItems : unifiedItems;
  const truncated = items.length > MAX_RENDER_ROWS;
  const visibleItems = truncated ? items.slice(0, MAX_RENDER_ROWS) : items;

  function getPatchText(): string {
    if (!result || result.identical || !diffLibrary) return "";
    return diffLibrary.createTwoFilesPatch(
      dict.leftFileName,
      dict.rightFileName,
      left.replace(/\r\n?/g, "\n"),
      right.replace(/\r\n?/g, "\n"),
      undefined,
      undefined,
      { ignoreWhitespace, context: CONTEXT_LINES }
    );
  }

  const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
    { value: "split", label: dict.viewSplit },
    { value: "unified", label: dict.viewUnified },
  ];
  const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
    { value: "line", label: dict.granularityLine },
    { value: "char", label: dict.granularityChar },
  ];

  function renderEditor(
    id: string,
    label: string,
    value: string,
    setValue: (value: string) => void,
    inputRef: React.RefObject<HTMLInputElement | null>,
    placeholder: string
  ) {
    return (
      <div
        className="flex flex-col gap-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const file = e.dataTransfer.files?.[0];
          if (!file) return;
          e.preventDefault();
          loadFile(file, setValue);
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-sm font-medium">
            {label}
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <FileUp className="size-4" />
            {dict.openFile}
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadFile(file, setValue);
              e.target.value = "";
            }}
          />
        </div>
        <Textarea
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="min-h-56 font-mono text-sm"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {renderEditor("diff-left", dict.leftLabel, left, setLeft, leftFileRef, dict.leftPlaceholder)}
        {renderEditor("diff-right", dict.rightLabel, right, setRight, rightFileRef, dict.rightPlaceholder)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setLeft(right);
            setRight(left);
          }}
          disabled={!left && !right}
        >
          <ArrowLeftRight className="size-4" />
          {dict.swap}
        </Button>
        <ToolActions
          onClear={() => {
            setLeft("");
            setRight("");
            setFileError(null);
          }}
          clearDisabled={!left && !right}
        />
      </div>
      {fileError && <p className="text-sm text-destructive">{fileError}</p>}

      <div className="flex flex-col gap-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex w-fit rounded-md border p-1">
            {VIEW_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setViewMode(item.value)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  viewMode === item.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="inline-flex w-fit rounded-md border p-1">
            {GRANULARITY_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setGranularity(item.value)}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  granularity === item.value
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {(
            [
              ["diff-ignore-ws", dict.ignoreWhitespace, ignoreWhitespace, setIgnoreWhitespace],
              ["diff-only-changes", dict.onlyChanges, onlyChanges, setOnlyChanges],
            ] as const
          ).map(([id, label, checked, setChecked]) => (
            <div key={id} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(value) => setChecked(value === true)}
              />
              <label htmlFor={id} className="text-sm">
                {label}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium">{dict.resultHeading}</span>
            {result && !result.identical && (
              <>
                <span className="font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
                  {formatTemplate(dict.addedCount, { count: result.added })}
                </span>
                <span className="font-medium text-destructive tabular-nums">
                  {formatTemplate(dict.removedCount, { count: result.removed })}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{dict.copyHint}</span>
            <ToolActions
              getCopyText={getPatchText}
              copyDisabled={!result || result.identical}
            />
          </div>
        </div>

        {!hasInput ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {dict.emptyState}
          </p>
        ) : libraryError ? (
          <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
            {dict.libraryLoadError}
          </p>
        ) : result === undefined ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {dict.loading}
          </p>
        ) : result === null ? (
          <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
            {dict.tooLarge}
          </p>
        ) : result?.identical ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-emerald-600 dark:text-emerald-400">
            {dict.identical}
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-lg border">
            <table className="w-full border-collapse font-mono text-xs">
              <tbody>
                {viewMode === "split"
                  ? (visibleItems as (SplitRow | { skipped: number })[]).map((row, index) =>
                      "skipped" in row ? (
                        <SkippedRow key={`s${index}`} count={row.skipped} colSpan={4} label={dict.skippedLines} />
                      ) : (
                        <tr key={index} className="align-top">
                          <td className="w-10 select-none border-r px-2 py-0.5 text-right text-muted-foreground tabular-nums">
                            {row.left?.oldNumber ?? ""}
                          </td>
                          <td
                            className={cn(
                              "w-1/2 whitespace-pre-wrap break-all border-r px-2 py-0.5",
                              row.left ? LINE_CLASS[row.left.type] : "bg-muted/30"
                            )}
                          >
                            {row.left && <LineText line={row.left} />}
                          </td>
                          <td className="w-10 select-none border-r px-2 py-0.5 text-right text-muted-foreground tabular-nums">
                            {row.right?.newNumber ?? ""}
                          </td>
                          <td
                            className={cn(
                              "w-1/2 whitespace-pre-wrap break-all px-2 py-0.5",
                              row.right ? LINE_CLASS[row.right.type] : "bg-muted/30"
                            )}
                          >
                            {row.right && <LineText line={row.right} />}
                          </td>
                        </tr>
                      )
                    )
                  : (visibleItems as (DiffLine | { skipped: number })[]).map((line, index) =>
                      "skipped" in line ? (
                        <SkippedRow key={`s${index}`} count={line.skipped} colSpan={4} label={dict.skippedLines} />
                      ) : (
                        <tr key={index} className={cn("align-top", LINE_CLASS[line.type])}>
                          <td className="w-10 select-none border-r px-2 py-0.5 text-right text-muted-foreground tabular-nums">
                            {line.oldNumber ?? ""}
                          </td>
                          <td className="w-10 select-none border-r px-2 py-0.5 text-right text-muted-foreground tabular-nums">
                            {line.newNumber ?? ""}
                          </td>
                          <td className="w-4 select-none px-1 py-0.5 text-center text-muted-foreground">
                            {prefixFor(line.type)}
                          </td>
                          <td className="whitespace-pre-wrap break-all px-2 py-0.5">
                            <LineText line={line} />
                          </td>
                        </tr>
                      )
                    )}
              </tbody>
            </table>
          </div>
        )}
        {truncated && (
          <p className="text-xs text-muted-foreground">
            {formatTemplate(dict.truncatedNote, { count: MAX_RENDER_ROWS })}
          </p>
        )}
      </div>
    </div>
  );
}
