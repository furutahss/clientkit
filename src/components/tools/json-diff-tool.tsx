"use client";

import * as React from "react";
import { ArrowLeftRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SafetyNote, TextInputPanel } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { diffJson, type JsonDiffEntry } from "@/lib/json-structure-diff";
import { locateJsonError, type JsonErrorLocation } from "@/lib/json-error";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

const MAX_RENDER_ROWS = 2000;

const KIND_CLASS: Record<JsonDiffEntry["kind"], string> = {
  added: "text-emerald-700 dark:text-emerald-400",
  removed: "text-destructive",
  changed: "text-amber-700 dark:text-amber-400",
};

function parse(text: string): { value?: unknown; error?: JsonErrorLocation } {
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: locateJsonError(text, error) };
  }
}

function formatValue(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function JsonDiffTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.jsonDiff;

  const [left, setLeft] = React.useState("");
  const [right, setRight] = React.useState("");
  const [fileError, setFileError] = React.useState(false);
  const deferredLeft = React.useDeferredValue(left);
  const deferredRight = React.useDeferredValue(right);

  React.useEffect(() => {
    takePendingToolFile("json-diff")
      ?.text()
      .then(setLeft)
      .catch(() => setFileError(true));
  }, []);

  const ready = deferredLeft.trim() !== "" && deferredRight.trim() !== "";
  const outcome = React.useMemo(() => {
    if (!ready) return null;
    const a = parse(deferredLeft);
    const b = parse(deferredRight);
    if (a.error || b.error) return { leftError: a.error, rightError: b.error };
    return { entries: diffJson(a.value, b.value) };
  }, [ready, deferredLeft, deferredRight]);

  const entries = outcome && "entries" in outcome ? outcome.entries : undefined;
  const counts = entries
    ? {
        added: entries.filter((e) => e.kind === "added").length,
        removed: entries.filter((e) => e.kind === "removed").length,
        changed: entries.filter((e) => e.kind === "changed").length,
      }
    : undefined;

  function getCopyText(): string {
    if (!entries) return "";
    return entries
      .map((e) => {
        const before = e.kind === "added" ? "" : formatValue(e.before);
        const after = e.kind === "removed" ? "" : formatValue(e.after);
        return `${dict.kinds[e.kind]}\t${e.path}\t${before}\t${after}`;
      })
      .join("\n");
  }

  function errorText(side: string, error?: JsonErrorLocation) {
    if (!error) return null;
    return (
      <p className="text-sm text-destructive">
        {formatTemplate(dict.parseError, { side, line: error.line, column: error.column, message: error.message })}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <TextInputPanel
            id="json-diff-left"
            label={dict.leftLabel}
            value={left}
            onChange={setLeft}
            placeholder={dict.leftPlaceholder}
            openFileLabel={dict.openFile}
            onFileError={() => setFileError(true)}
            accept=".json,application/json"
            invalid={!!outcome && "leftError" in outcome && !!outcome.leftError}
          />
          {outcome && "leftError" in outcome && errorText(dict.leftLabel, outcome.leftError)}
        </div>
        <div className="flex flex-col gap-2">
          <TextInputPanel
            id="json-diff-right"
            label={dict.rightLabel}
            value={right}
            onChange={setRight}
            placeholder={dict.rightPlaceholder}
            openFileLabel={dict.openFile}
            onFileError={() => setFileError(true)}
            accept=".json,application/json"
            invalid={!!outcome && "rightError" in outcome && !!outcome.rightError}
          />
          {outcome && "rightError" in outcome && errorText(dict.rightLabel, outcome.rightError)}
        </div>
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
            setFileError(false);
          }}
          clearDisabled={!left && !right}
        />
      </div>
      {fileError && <p className="text-sm text-destructive">{dict.fileReadError}</p>}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{dict.resultHeading}</span>
            {counts && entries!.length > 0 && (
              <>
                <span className={cn("font-medium tabular-nums", KIND_CLASS.added)}>
                  {formatTemplate(dict.addedCount, { count: counts.added })}
                </span>
                <span className={cn("font-medium tabular-nums", KIND_CLASS.removed)}>
                  {formatTemplate(dict.removedCount, { count: counts.removed })}
                </span>
                <span className={cn("font-medium tabular-nums", KIND_CLASS.changed)}>
                  {formatTemplate(dict.changedCount, { count: counts.changed })}
                </span>
              </>
            )}
          </div>
          <ToolActions getCopyText={getCopyText} copyDisabled={!entries || entries.length === 0} />
        </div>

        {!ready ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {dict.emptyState}
          </p>
        ) : !entries ? (
          <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{dict.fixInput}</p>
        ) : entries.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-emerald-600 dark:text-emerald-400">
            {dict.identical}
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-lg border">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{dict.columnKind}</th>
                  <th className="px-3 py-2 font-medium">{dict.columnPath}</th>
                  <th className="px-3 py-2 font-medium">{dict.columnBefore}</th>
                  <th className="px-3 py-2 font-medium">{dict.columnAfter}</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, MAX_RENDER_ROWS).map((entry, index) => (
                  <tr key={index} className="border-t align-top">
                    <td className={cn("whitespace-nowrap px-3 py-1.5 font-medium", KIND_CLASS[entry.kind])}>
                      {dict.kinds[entry.kind]}
                    </td>
                    <td className="break-all px-3 py-1.5 font-mono">{entry.path}</td>
                    <td className="px-3 py-1.5">
                      {entry.kind !== "added" && (
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono">
                          {formatValue(entry.before)}
                        </pre>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {entry.kind !== "removed" && (
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono">
                          {formatValue(entry.after)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {entries && entries.length > MAX_RENDER_ROWS && (
          <p className="text-xs text-muted-foreground">
            {formatTemplate(dict.truncatedNote, { count: MAX_RENDER_ROWS })}
          </p>
        )}
      </div>
    </div>
  );
}
