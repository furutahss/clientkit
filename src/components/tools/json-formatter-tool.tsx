"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { generateTypeScriptTypes, type JsonValue } from "@/lib/json-to-typescript";
import { locateJsonError, type JsonErrorLocation } from "@/lib/json-error";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";

type Tab = "format" | "typescript";
type IndentOption = "2" | "4" | "minify";

export function JsonFormatterTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.jsonFormatter;
  const [input, setInput] = React.useState("");
  const [tab, setTab] = React.useState<Tab>("format");
  const [indent, setIndent] = React.useState<IndentOption>("2");

  const TABS: { value: Tab; label: string }[] = [
    { value: "format", label: dict.tabFormat },
    { value: "typescript", label: dict.tabTypescript },
  ];

  const INDENT_OPTIONS: { value: IndentOption; label: string }[] = [
    { value: "2", label: dict.indent2 },
    { value: "4", label: dict.indent4 },
    { value: "minify", label: dict.indentMinify },
  ];

  const parsed = React.useMemo<{
    data: JsonValue | undefined;
    error: JsonErrorLocation | null;
  }>(() => {
    if (!input.trim()) return { data: undefined, error: null };

    try {
      return { data: JSON.parse(input) as JsonValue, error: null };
    } catch (error) {
      return { data: undefined, error: locateJsonError(input, error) };
    }
  }, [input]);

  const output = React.useMemo(() => {
    if (parsed.error || parsed.data === undefined) return "";

    if (tab === "format") {
      return indent === "minify"
        ? JSON.stringify(parsed.data)
        : JSON.stringify(parsed.data, null, indent === "4" ? 4 : 2);
    }

    return generateTypeScriptTypes(parsed.data);
  }, [tab, indent, parsed]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium">{dict.inputLabel}</label>
            {parsed.error ? (
              <span className="text-xs font-medium text-destructive">
                {dict.syntaxError}
              </span>
            ) : input.trim() ? (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {dict.validJson}
              </span>
            ) : null}
          </div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={dict.placeholder}
            spellCheck={false}
            className="min-h-80 font-mono text-sm"
            aria-label={dict.inputLabel}
            aria-invalid={parsed.error ? true : undefined}
          />
          {parsed.error && (
            <p className="text-sm text-destructive">
              {formatTemplate(dict.errorLocation, {
                line: parsed.error.line,
                column: parsed.error.column,
                message: parsed.error.message,
              })}
            </p>
          )}
          <ToolActions onClear={() => setInput("")} clearDisabled={!input} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex w-fit rounded-md border p-1">
              {TABS.map((item) => (
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

            {tab === "format" && (
              <div className="inline-flex w-fit rounded-md border p-1">
                {INDENT_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setIndent(item.value)}
                    className={cn(
                      "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                      indent === item.value
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="text-sm font-medium">
            {tab === "format" ? dict.outputLabelFormat : dict.outputLabelTypescript}
          </label>
          <Textarea
            value={output}
            readOnly
            placeholder={
              parsed.error ? dict.outputPlaceholderError : dict.outputPlaceholder
            }
            spellCheck={false}
            className="min-h-80 font-mono text-sm"
            aria-label={
              tab === "format" ? dict.outputLabelFormat : dict.outputLabelTypescript
            }
          />
          <ToolActions getCopyText={() => output} copyDisabled={!output} />
        </div>
      </div>
    </div>
  );
}
