"use client";

import * as React from "react";
import { format, type FormatOptionsWithLanguage } from "sql-formatter";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { minifySql } from "@/lib/sql-minify";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn } from "@/lib/utils";

type Dialect = NonNullable<FormatOptionsWithLanguage["language"]>;
type KeywordCase = NonNullable<FormatOptionsWithLanguage["keywordCase"]>;
type Mode = "format" | "minify";

const SAMPLE_SQL =
  "select u.id, u.name, count(o.id) as order_count from users u left join orders o on o.user_id = u.id where u.created_at >= '2024-01-01' group by u.id, u.name having count(o.id) > 0 order by order_count desc limit 10;";

export function SqlFormatterTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.sqlFormatter;

  const DIALECT_OPTIONS: { value: Dialect; label: string }[] = [
    { value: "sql", label: dict.dialectStandard },
    { value: "mysql", label: dict.dialectMysql },
    { value: "postgresql", label: dict.dialectPostgresql },
    { value: "sqlite", label: dict.dialectSqlite },
    { value: "mariadb", label: dict.dialectMariadb },
    { value: "transactsql", label: dict.dialectTransactsql },
    { value: "bigquery", label: dict.dialectBigquery },
  ];

  const KEYWORD_CASE_OPTIONS: { value: KeywordCase; label: string }[] = [
    { value: "preserve", label: dict.casePreserve },
    { value: "upper", label: dict.caseUpper },
    { value: "lower", label: dict.caseLower },
  ];

  const [input, setInput] = React.useState("");
  const [dialect, setDialect] = React.useState<Dialect>("sql");
  const [keywordCase, setKeywordCase] = React.useState<KeywordCase>("upper");
  const [mode, setMode] = React.useState<Mode>("format");

  const { output, error } = React.useMemo(() => {
    if (!input.trim()) return { output: "", error: null as string | null };

    try {
      if (mode === "minify") {
        return { output: minifySql(input), error: null };
      }
      const formatted = format(input, { language: dialect, keywordCase });
      return { output: formatted, error: null };
    } catch (e) {
      return {
        output: "",
        error: e instanceof Error ? e.message : dict.formatError,
      };
    }
  }, [input, dialect, keywordCase, mode, dict.formatError]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex w-fit rounded-md border p-1">
          {(
            [
              { value: "format", label: dict.tabFormat },
              { value: "minify", label: dict.tabMinify },
            ] as { value: Mode; label: string }[]
          ).map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setMode(item.value)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                mode === item.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mode === "format" && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{dict.dialectLabel}</span>
              <Select
                value={dialect}
                onValueChange={(value) => setDialect(value as Dialect)}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIALECT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="inline-flex w-fit rounded-md border p-1">
              {KEYWORD_CASE_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setKeywordCase(item.value)}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                    keywordCase === item.value
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{dict.inputLabel}</label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={SAMPLE_SQL}
            spellCheck={false}
            className="min-h-72 font-mono text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            {mode === "format" ? dict.outputLabelFormat : dict.outputLabelMinify}
          </label>
          <Textarea
            value={output}
            readOnly
            placeholder={dict.outputPlaceholder}
            spellCheck={false}
            className="min-h-72 font-mono text-sm"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>

      <ToolActions
        onClear={() => setInput("")}
        clearDisabled={!input}
        getCopyText={() => output}
        copyDisabled={!output}
      />
    </div>
  );
}
