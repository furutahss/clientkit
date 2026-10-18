"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SafetyNote, TextInputPanel } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { checkPaths, parseGitignore, type GitignoreResult } from "@/lib/gitignore";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";

const SAMPLE_RULES = `# Build output
dist/
build/**
!build/config.json

# Logs (keep only the important one)
*.log
!important.log

/.env
node_modules/
docs/**/*.tmp
\\#notes.txt`;

const SAMPLE_PATHS = `dist/
dist/index.js
build/output.js
build/config.json
logs/debug.log
important.log
.env
config/.env
node_modules/react/index.js
docs/a/b/draft.tmp
#notes.txt
src/app.ts`;

type Dict = ReturnType<typeof getDictionary>["tools"]["gitignoreTester"];

function reason(dict: Dict, result: Extract<GitignoreResult, { status: "checked" }>): string {
  if (result.excludedParent) return formatTemplate(dict.reasonParent, { dir: `${result.excludedParent}/` });
  if (!result.rule) return dict.reasonNoRule;
  return result.rule.negated ? dict.reasonNegated : dict.reasonMatched;
}

export function GitignoreTesterTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.gitignoreTester;

  const [rules, setRules] = React.useState("");
  const [paths, setPaths] = React.useState("");
  const [fileError, setFileError] = React.useState(false);

  const results = React.useMemo(() => checkPaths(parseGitignore(rules), paths.split("\n")), [rules, paths]);

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
        {dict.scopeNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TextInputPanel
          id="gitignore-rules"
          label={dict.rulesLabel}
          value={rules}
          onChange={setRules}
          placeholder={"node_modules/\n*.log\n!keep.log"}
          openFileLabel={dict.openFile}
          onFileError={() => setFileError(true)}
        />
        <TextInputPanel
          id="gitignore-paths"
          label={dict.pathsLabel}
          value={paths}
          onChange={setPaths}
          placeholder={"src/index.ts\ndist/\ndist/app.js"}
          openFileLabel={dict.openFile}
          onFileError={() => setFileError(true)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setRules(SAMPLE_RULES);
            setPaths(SAMPLE_PATHS);
          }}
        >
          <FlaskConical className="size-4" />
          {dict.loadSample}
        </Button>
        <ToolActions
          onClear={() => {
            setRules("");
            setPaths("");
            setFileError(false);
          }}
          clearDisabled={!rules && !paths}
          getCopyText={() =>
            results
              .map((r) =>
                r.status === "invalidPath"
                  ? `${r.input}\t${dict.invalidPath}`
                  : `${r.input}\t${r.ignored ? dict.ignored : dict.notIgnored}\t${r.rule ? `${r.rule.line}: ${r.rule.text}` : ""}`
              )
              .join("\n")
          }
          copyDisabled={results.length === 0}
        />
      </div>
      {fileError && <p className="text-sm text-destructive">{dict.fileReadError}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{dict.resultHeading}</h2>
        {results.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{dict.emptyState}</p>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-lg border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{dict.columnPath}</th>
                  <th className="px-3 py-2 font-medium">{dict.columnResult}</th>
                  <th className="px-3 py-2 font-medium">{dict.columnRule}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index} className="border-t align-top">
                    <td className="whitespace-pre-wrap break-all px-3 py-1.5 font-mono">
                      {result.input}
                      {result.status === "checked" && result.isDir && (
                        <span className="ml-2 font-sans text-xs text-muted-foreground">{dict.directory}</span>
                      )}
                    </td>
                    {result.status === "invalidPath" ? (
                      <td colSpan={2} className="px-3 py-1.5 text-destructive">
                        {dict.invalidPath}
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-1.5">
                          <span
                            className={cn(
                              "font-medium",
                              result.ignored ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                            )}
                          >
                            {result.ignored ? dict.ignored : dict.notIgnored}
                          </span>
                          <p className="text-xs text-muted-foreground">{reason(dict, result)}</p>
                          {result.ineffectiveNegation && (
                            <p className="text-xs text-destructive">
                              {formatTemplate(dict.ineffectiveNegation, { line: result.ineffectiveNegation.line })}
                            </p>
                          )}
                        </td>
                        <td className="break-all px-3 py-1.5 font-mono">
                          {result.rule && (
                            <>
                              <span className="text-muted-foreground">{formatTemplate(dict.lineNumber, { line: result.rule.line })} </span>
                              <span className="whitespace-pre-wrap">{result.rule.text}</span>
                            </>
                          )}
                        </td>
                      </>
                    )}
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
