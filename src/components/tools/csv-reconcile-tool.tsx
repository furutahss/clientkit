"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SafetyNote, TextInputPanel } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { parseCsvTable, type CsvTableError } from "@/lib/csv";
import { reconcileCsv, reconcileResultToCsv, type KeyIssue } from "@/lib/csv-reconcile";
import { downloadBytes } from "@/lib/download";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { formatTemplate } from "@/lib/utils";

const MAX_RENDER_ROWS = 1000;
const DELIMITERS = [
  { value: ",", key: "comma" },
  { value: "\t", key: "tab" },
  { value: ";", key: "semicolon" },
] as const;

type Dict = ReturnType<typeof getDictionary>["tools"]["csvReconcile"];

export function csvTableErrorText(dict: { csvErrors: Record<CsvTableError["type"], string> }, error: CsvTableError): string {
  return formatTemplate(dict.csvErrors[error.type], {
    column: "column" in error ? error.column : "",
    index: "index" in error ? error.index : "",
    record: "record" in error ? error.record : "",
    expected: "expected" in error ? error.expected : "",
    actual: "actual" in error ? error.actual : "",
  });
}

function keyIssueText(dict: Dict, issue: KeyIssue): string {
  return formatTemplate(issue.type === "empty" ? dict.keyEmpty : dict.keyDuplicate, {
    side: issue.side === "left" ? dict.leftLabel : dict.rightLabel,
    key: issue.key,
    records: issue.records.join(", "),
  });
}

function Cell({ value }: { value: string }) {
  return <span className="whitespace-pre-wrap break-all font-mono">{value === "" ? "\u00a0" : value}</span>;
}

export function CsvReconcileTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.csvReconcile;

  const [left, setLeft] = React.useState("");
  const [right, setRight] = React.useState("");
  const [delimiter, setDelimiter] = React.useState<string>(",");
  const [keyColumn, setKeyColumn] = React.useState("");
  const [fileError, setFileError] = React.useState(false);
  const deferredLeft = React.useDeferredValue(left);
  const deferredRight = React.useDeferredValue(right);

  React.useEffect(() => {
    takePendingToolFile("csv-reconcile")
      ?.text()
      .then(setLeft)
      .catch(() => setFileError(true));
  }, []);

  const leftParsed = React.useMemo(
    () => (deferredLeft.trim() ? parseCsvTable(deferredLeft, delimiter) : null),
    [deferredLeft, delimiter]
  );
  const rightParsed = React.useMemo(
    () => (deferredRight.trim() ? parseCsvTable(deferredRight, delimiter) : null),
    [deferredRight, delimiter]
  );
  const leftTable = leftParsed?.table;
  const rightTable = rightParsed?.table;
  const commonColumns = React.useMemo(
    () => (leftTable && rightTable ? leftTable.headers.filter((h) => rightTable.headers.includes(h)) : []),
    [leftTable, rightTable]
  );
  const activeKey = commonColumns.includes(keyColumn) ? keyColumn : (commonColumns[0] ?? "");

  const outcome = React.useMemo(
    () => (leftTable && rightTable && activeKey ? reconcileCsv(leftTable, rightTable, activeKey) : null),
    [leftTable, rightTable, activeKey]
  );
  const result = outcome?.result;

  function renderParseErrors(side: string, errors?: CsvTableError[]) {
    if (!errors || errors.length === 0) return null;
    return (
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-destructive">
        {errors.slice(0, 20).map((error, index) => (
          <li key={index}>
            {side}: {csvTableErrorText(dict, error)}
          </li>
        ))}
        {errors.length > 20 && <li>{formatTemplate(dict.moreErrors, { count: errors.length - 20 })}</li>}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <TextInputPanel
            id="csv-reconcile-left"
            label={dict.leftLabel}
            value={left}
            onChange={setLeft}
            placeholder={dict.leftPlaceholder}
            openFileLabel={dict.openFile}
            onFileError={() => setFileError(true)}
            accept=".csv,.tsv,.txt,text/csv"
          />
          {renderParseErrors(dict.leftLabel, leftParsed?.errors)}
        </div>
        <div className="flex flex-col gap-2">
          <TextInputPanel
            id="csv-reconcile-right"
            label={dict.rightLabel}
            value={right}
            onChange={setRight}
            placeholder={dict.rightPlaceholder}
            openFileLabel={dict.openFile}
            onFileError={() => setFileError(true)}
            accept=".csv,.tsv,.txt,text/csv"
          />
          {renderParseErrors(dict.rightLabel, rightParsed?.errors)}
        </div>
      </div>
      {fileError && <p className="text-sm text-destructive">{dict.fileReadError}</p>}

      <div className="flex flex-wrap items-end gap-4 rounded-lg border p-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{dict.delimiterLabel}</span>
          <Select value={delimiter} onValueChange={setDelimiter}>
            <SelectTrigger className="w-40" aria-label={dict.delimiterLabel}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELIMITERS.map((item) => (
                <SelectItem key={item.key} value={item.value}>
                  {dict.delimiters[item.key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{dict.keyLabel}</span>
          <Select value={activeKey} onValueChange={setKeyColumn} disabled={commonColumns.length === 0}>
            <SelectTrigger className="w-56" aria-label={dict.keyLabel}>
              <SelectValue placeholder={dict.keyPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {commonColumns.map((column) => (
                <SelectItem key={column} value={column}>
                  {column}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!result}
            onClick={() => {
              if (!result) return;
              const csv = reconcileResultToCsv(result, activeKey, delimiter);
              downloadBytes(new TextEncoder().encode(`\uFEFF${csv}`), "csv-diff.csv", "text/csv");
            }}
          >
            <Download className="size-4" />
            {dict.download}
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
      </div>

      {!leftTable || !rightTable ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {dict.emptyState}
        </p>
      ) : commonColumns.length === 0 ? (
        <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{dict.noCommonColumns}</p>
      ) : outcome && !result ? (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          <p className="font-medium">{dict.keyIssuesHeading}</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {outcome.keyIssues.slice(0, 50).map((issue, index) => (
              <li key={index}>{keyIssueText(dict, issue)}</li>
            ))}
          </ul>
        </div>
      ) : result ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
              {formatTemplate(dict.addedCount, { count: result.added.length })}
            </span>
            <span className="font-medium text-destructive tabular-nums">
              {formatTemplate(dict.removedCount, { count: result.removed.length })}
            </span>
            <span className="font-medium text-amber-700 tabular-nums dark:text-amber-400">
              {formatTemplate(dict.updatedCount, { count: result.updated.length })}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {formatTemplate(dict.unchangedCount, { count: result.unchanged })}
            </span>
          </div>

          {(result.leftOnlyColumns.length > 0 || result.rightOnlyColumns.length > 0) && (
            <div className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <p className="font-medium">{dict.columnMismatch}</p>
              {result.leftOnlyColumns.length > 0 && (
                <p>{formatTemplate(dict.leftOnlyColumns, { columns: result.leftOnlyColumns.join(", ") })}</p>
              )}
              {result.rightOnlyColumns.length > 0 && (
                <p>{formatTemplate(dict.rightOnlyColumns, { columns: result.rightOnlyColumns.join(", ") })}</p>
              )}
            </div>
          )}

          {result.added.length + result.removed.length + result.updated.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-emerald-600 dark:text-emerald-400">
              {dict.identical}
            </p>
          ) : (
            <div className="max-h-[70vh] overflow-auto rounded-lg border">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{dict.columnKind}</th>
                    <th className="px-3 py-2 font-medium">{activeKey}</th>
                    <th className="px-3 py-2 font-medium">{dict.columnColumn}</th>
                    <th className="px-3 py-2 font-medium">{dict.columnBefore}</th>
                    <th className="px-3 py-2 font-medium">{dict.columnAfter}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...result.removed.map((row) => ({ kind: "removed" as const, key: row.key, values: row.values })),
                    ...result.added.map((row) => ({ kind: "added" as const, key: row.key, values: row.values })),
                  ]
                    .slice(0, MAX_RENDER_ROWS)
                    .map((row) => (
                      <tr key={`${row.kind}-${row.key}`} className="border-t align-top">
                        <td
                          className={
                            row.kind === "added"
                              ? "px-3 py-1.5 font-medium text-emerald-700 dark:text-emerald-400"
                              : "px-3 py-1.5 font-medium text-destructive"
                          }
                        >
                          {dict.kinds[row.kind]}
                        </td>
                        <td className="px-3 py-1.5">
                          <Cell value={row.key} />
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground" colSpan={3}>
                          <span className="whitespace-pre-wrap break-all font-mono">
                            {Object.entries(row.values)
                              .map(([column, value]) => `${column}: ${value}`)
                              .join("\n")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  {result.updated.slice(0, MAX_RENDER_ROWS).flatMap((row) =>
                    row.changes.map((change, index) => (
                      <tr key={`u-${row.key}-${change.column}`} className="border-t align-top">
                        <td className="px-3 py-1.5 font-medium text-amber-700 dark:text-amber-400">
                          {index === 0 ? dict.kinds.updated : ""}
                        </td>
                        <td className="px-3 py-1.5">{index === 0 && <Cell value={row.key} />}</td>
                        <td className="px-3 py-1.5">{change.column}</td>
                        <td className="bg-red-50 px-3 py-1.5 dark:bg-red-500/10">
                          <Cell value={change.before} />
                        </td>
                        <td className="bg-emerald-50 px-3 py-1.5 dark:bg-emerald-500/10">
                          <Cell value={change.after} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {Math.max(result.added.length + result.removed.length, result.updated.length) > MAX_RENDER_ROWS && (
            <p className="text-xs text-muted-foreground">{formatTemplate(dict.truncatedNote, { count: MAX_RENDER_ROWS })}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
