"use client";

import * as React from "react";
import { ArrowLeftRight, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SafetyNote, TextInputPanel } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { compareEnv, parseEnv, type EnvParseResult, type EnvSideInfo } from "@/lib/env-compare";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";

type Dict = ReturnType<typeof getDictionary>["tools"]["envCompare"];

function SideCell({ dict, info, showValues }: { dict: Dict; info?: EnvSideInfo; showValues: boolean }) {
  if (!info) {
    return <span className="font-medium text-destructive">{dict.undefinedKey}</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {info.lines.map((line, index) => {
        const value = info.values[index];
        return (
          <div key={line} className="flex flex-wrap items-baseline gap-2">
            <span className="text-muted-foreground tabular-nums">{formatTemplate(dict.lineNumber, { line })}</span>
            {value === "" ? (
              <span className="font-medium text-amber-700 dark:text-amber-400">{dict.emptyValue}</span>
            ) : showValues ? (
              <span className="whitespace-pre-wrap break-all font-mono">{value}</span>
            ) : (
              <span className="font-mono text-muted-foreground">••••••</span>
            )}
          </div>
        );
      })}
      {info.lines.length > 1 && (
        <span className="font-medium text-destructive">{formatTemplate(dict.duplicated, { count: info.lines.length })}</span>
      )}
    </div>
  );
}

function InvalidLines({ dict, side, parsed }: { dict: Dict; side: string; parsed: EnvParseResult | null }) {
  if (!parsed || parsed.invalid.length === 0) return null;
  return (
    <ul className="list-disc space-y-0.5 pl-5 text-sm text-destructive">
      {parsed.invalid.map((item) => (
        <li key={item.line}>
          {formatTemplate(dict.invalidLine, { side, line: item.line, reason: dict.invalidReasons[item.reason] })}
        </li>
      ))}
    </ul>
  );
}

export function EnvCompareTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.envCompare;

  // 機密情報を含むため、入力はどこにも保存しない（React の state のみ）
  const [left, setLeft] = React.useState("");
  const [right, setRight] = React.useState("");
  const [showValues, setShowValues] = React.useState(false);
  const [onlyProblems, setOnlyProblems] = React.useState(false);
  const [fileError, setFileError] = React.useState(false);
  const deferredLeft = React.useDeferredValue(left);
  const deferredRight = React.useDeferredValue(right);

  const leftParsed = React.useMemo(() => (deferredLeft.trim() ? parseEnv(deferredLeft) : null), [deferredLeft]);
  const rightParsed = React.useMemo(() => (deferredRight.trim() ? parseEnv(deferredRight) : null), [deferredRight]);
  const rows = React.useMemo(
    () => (leftParsed && rightParsed ? compareEnv(leftParsed, rightParsed) : null),
    [leftParsed, rightParsed]
  );

  const isProblem = (info?: EnvSideInfo) => !info || info.lines.length > 1 || info.values.includes("");
  const visibleRows = rows?.filter((row) => !onlyProblems || isProblem(row.left) || isProblem(row.right));
  const counts = rows && {
    leftOnly: rows.filter((row) => row.left && !row.right).length,
    rightOnly: rows.filter((row) => !row.left && row.right).length,
    duplicated: rows.filter((row) => (row.left?.lines.length ?? 0) > 1 || (row.right?.lines.length ?? 0) > 1).length,
    empty: rows.filter((row) => row.left?.values.includes("") || row.right?.values.includes("")).length,
  };

  function getReportText(): string {
    if (!rows) return "";
    // コピーする内容にも値は含めない
    return rows
      .filter((row) => isProblem(row.left) || isProblem(row.right))
      .map((row) => {
        const describe = (info?: EnvSideInfo) =>
          !info
            ? dict.undefinedKey
            : [
                info.lines.length > 1 ? formatTemplate(dict.duplicated, { count: info.lines.length }) : "",
                info.values.includes("") ? dict.emptyValue : "",
              ]
                .filter(Boolean)
                .join(" / ") || "OK";
        return `${row.key}\t${dict.leftLabel}: ${describe(row.left)}\t${dict.rightLabel}: ${describe(row.right)}`;
      })
      .join("\n");
  }

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>
      <details className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">{dict.syntaxHeading}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {dict.syntaxRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </details>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <TextInputPanel
            id="env-left"
            label={dict.leftLabel}
            value={left}
            onChange={setLeft}
            placeholder={dict.leftPlaceholder}
            openFileLabel={dict.openFile}
            onFileError={() => setFileError(true)}
            className={showValues ? undefined : "[-webkit-text-security:disc]"}
          />
          <InvalidLines dict={dict} side={dict.leftLabel} parsed={leftParsed} />
        </div>
        <div className="flex flex-col gap-2">
          <TextInputPanel
            id="env-right"
            label={dict.rightLabel}
            value={right}
            onChange={setRight}
            placeholder={dict.rightPlaceholder}
            openFileLabel={dict.openFile}
            onFileError={() => setFileError(true)}
            className={showValues ? undefined : "[-webkit-text-security:disc]"}
          />
          <InvalidLines dict={dict} side={dict.rightLabel} parsed={rightParsed} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowValues((value) => !value)}>
          {showValues ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {showValues ? dict.hideValues : dict.showValues}
        </Button>
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
        <div className="flex items-center gap-2">
          <Checkbox id="env-only-problems" checked={onlyProblems} onCheckedChange={(value) => setOnlyProblems(value === true)} />
          <label htmlFor="env-only-problems" className="text-sm">
            {dict.onlyProblems}
          </label>
        </div>
      </div>
      {fileError && <p className="text-sm text-destructive">{dict.fileReadError}</p>}

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{dict.resultHeading}</span>
            {counts && (
              <>
                <span className="tabular-nums">{formatTemplate(dict.leftOnlyCount, { count: counts.leftOnly })}</span>
                <span className="tabular-nums">{formatTemplate(dict.rightOnlyCount, { count: counts.rightOnly })}</span>
                <span className="tabular-nums">{formatTemplate(dict.duplicatedCount, { count: counts.duplicated })}</span>
                <span className="tabular-nums">{formatTemplate(dict.emptyCount, { count: counts.empty })}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{dict.copyHint}</span>
            <ToolActions getCopyText={getReportText} copyDisabled={!rows} />
          </div>
        </div>

        {!rows || !visibleRows ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{dict.emptyState}</p>
        ) : visibleRows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-emerald-600 dark:text-emerald-400">
            {dict.noProblems}
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-lg border">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{dict.columnKey}</th>
                  <th className="px-3 py-2 font-medium">{dict.leftLabel}</th>
                  <th className="px-3 py-2 font-medium">{dict.rightLabel}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={row.key}
                    className={cn(
                      "border-t align-top",
                      (isProblem(row.left) || isProblem(row.right)) && "bg-amber-50/60 dark:bg-amber-500/5"
                    )}
                  >
                    <td className="break-all px-3 py-1.5 font-mono font-medium">{row.key}</td>
                    <td className="px-3 py-1.5">
                      <SideCell dict={dict} info={row.left} showValues={showValues} />
                    </td>
                    <td className="px-3 py-1.5">
                      <SideCell dict={dict} info={row.right} showValues={showValues} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
