"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SafetyNote, TextInputPanel } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { checkTranslations, type PlaceholderIssue } from "@/lib/i18n-placeholder";
import { locateJsonError, type JsonErrorLocation } from "@/lib/json-error";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";

const SAMPLE_BASE = `{
  "home": {
    "greeting": "こんにちは、{name}さん",
    "summary": "{count}件のうち{done}件が完了",
    "notice": "'{name}' の形式で名前を入力してください"
  },
  "cart": {
    "items": "{count, plural, other {# 個の商品}}",
    "total": "合計 {price}"
  },
  "limit": 10
}`;

const SAMPLE_TARGET = `{
  "home": {
    "greeting": "Hello!",
    "summary": "{done} of {count} completed",
    "notice": "Enter your name as '{name}'"
  },
  "cart": {
    "items": "{count, plural, one {# item} other {# items}}",
    "total": "Total {amount}",
    "empty": "Your cart is empty"
  },
  "limit": "10"
}`;

type Dict = ReturnType<typeof getDictionary>["tools"]["i18nPlaceholderChecker"];

const SEVERITY: Record<PlaceholderIssue["kind"], string> = {
  missingKey: "text-destructive",
  extraKey: "text-amber-700 dark:text-amber-400",
  typeMismatch: "text-destructive",
  placeholders: "text-destructive",
  syntax: "text-destructive",
  unsupported: "text-amber-700 dark:text-amber-400",
  nonString: "text-muted-foreground",
};

function parse(text: string): { value?: unknown; error?: JsonErrorLocation } {
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: locateJsonError(text, error) };
  }
}

const isObject = (value: unknown) => value !== null && typeof value === "object" && !Array.isArray(value);

function describe(dict: Dict, issue: PlaceholderIssue): string {
  const list = (names: string[]) => names.map((name) => `{${name}}`).join(" ");
  switch (issue.kind) {
    case "placeholders":
      return [
        issue.missing.length > 0 ? formatTemplate(dict.missingVars, { names: list(issue.missing) }) : "",
        issue.extra.length > 0 ? formatTemplate(dict.extraVars, { names: list(issue.extra) }) : "",
        issue.missing.length > 0 && issue.extra.length > 0 ? dict.renamedHint : "",
      ]
        .filter(Boolean)
        .join(" ");
    case "typeMismatch":
      return formatTemplate(dict.typeMismatchDetail, { base: issue.baseType, target: issue.targetType });
    case "nonString":
      return formatTemplate(dict.nonStringDetail, { type: issue.type });
    case "unsupported":
    case "syntax":
      return formatTemplate(dict.sideDetail, { side: issue.side === "base" ? dict.baseLabel : dict.targetLabel });
    default:
      return "";
  }
}

export function I18nPlaceholderCheckerTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.i18nPlaceholderChecker;

  const [base, setBase] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [fileError, setFileError] = React.useState(false);
  const deferredBase = React.useDeferredValue(base);
  const deferredTarget = React.useDeferredValue(target);

  const ready = deferredBase.trim() !== "" && deferredTarget.trim() !== "";
  const outcome = React.useMemo(() => {
    if (!ready) return null;
    const a = parse(deferredBase);
    const b = parse(deferredTarget);
    if (a.error || b.error) return { baseError: a.error, targetError: b.error };
    if (!isObject(a.value) || !isObject(b.value)) return { notObject: true };
    return { report: checkTranslations(a.value, b.value) };
  }, [ready, deferredBase, deferredTarget]);

  const report = outcome && "report" in outcome ? outcome.report : undefined;
  const problems = report?.issues.filter((issue) => issue.kind !== "nonString").length ?? 0;

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
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
        {dict.syntaxNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <TextInputPanel
            id="i18n-base"
            label={dict.baseLabel}
            value={base}
            onChange={setBase}
            placeholder={'{"greeting": "こんにちは、{name}さん"}'}
            openFileLabel={dict.openFile}
            onFileError={() => setFileError(true)}
            accept=".json,application/json"
            invalid={!!outcome && "baseError" in outcome && !!outcome.baseError}
          />
          {outcome && "baseError" in outcome && errorText(dict.baseLabel, outcome.baseError)}
        </div>
        <div className="flex flex-col gap-2">
          <TextInputPanel
            id="i18n-target"
            label={dict.targetLabel}
            value={target}
            onChange={setTarget}
            placeholder={'{"greeting": "Hello, {name}"}'}
            openFileLabel={dict.openFile}
            onFileError={() => setFileError(true)}
            accept=".json,application/json"
            invalid={!!outcome && "targetError" in outcome && !!outcome.targetError}
          />
          {outcome && "targetError" in outcome && errorText(dict.targetLabel, outcome.targetError)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setBase(SAMPLE_BASE);
            setTarget(SAMPLE_TARGET);
          }}
        >
          <FlaskConical className="size-4" />
          {dict.loadSample}
        </Button>
        <ToolActions
          onClear={() => {
            setBase("");
            setTarget("");
            setFileError(false);
          }}
          clearDisabled={!base && !target}
          getCopyText={() =>
            (report?.issues ?? []).map((issue) => `${dict.kinds[issue.kind]}\t${issue.path}\t${describe(dict, issue)}`).join("\n")
          }
          copyDisabled={!report || report.issues.length === 0}
        />
      </div>
      {fileError && <p className="text-sm text-destructive">{dict.fileReadError}</p>}

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <h2 className="font-medium">{dict.resultHeading}</h2>
          {report && (
            <span className="text-muted-foreground">
              {formatTemplate(dict.summary, { checked: report.checkedStrings, problems })}
            </span>
          )}
        </div>
        {!ready ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{dict.emptyState}</p>
        ) : !outcome || !report ? (
          <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
            {outcome && "notObject" in outcome ? dict.notObject : dict.fixInput}
          </p>
        ) : report.issues.length === 0 ? (
          <p className="rounded-lg border border-emerald-500/40 p-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {dict.noIssues}
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-lg border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{dict.columnKind}</th>
                  <th className="px-3 py-2 font-medium">{dict.columnPath}</th>
                  <th className="px-3 py-2 font-medium">{dict.columnDetail}</th>
                </tr>
              </thead>
              <tbody>
                {report.issues.map((issue, index) => (
                  <tr key={index} className="border-t align-top">
                    <td className={cn("whitespace-nowrap px-3 py-1.5 font-medium", SEVERITY[issue.kind])}>{dict.kinds[issue.kind]}</td>
                    <td className="break-all px-3 py-1.5 font-mono">{issue.path}</td>
                    <td className="px-3 py-1.5">{describe(dict, issue)}</td>
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
