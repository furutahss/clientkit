"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { csvTableErrorText } from "@/components/tools/csv-reconcile-tool";
import { SafetyNote, TextInputPanel } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import {
  buildInsertSql,
  csvToSqlSource,
  jsonToSqlSource,
  type InsertError,
  type JsonSourceError,
  type MissingKeyMode,
} from "@/lib/sql-insert";
import { downloadBytes } from "@/lib/download";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

type Format = "csv" | "json";
type Dict = ReturnType<typeof getDictionary>["tools"]["sqlInsertGenerator"];

const MAX_ERRORS = 30;

function jsonErrorText(dict: Dict, error: JsonSourceError): string {
  return formatTemplate(dict.jsonErrors[error.type], {
    path: "path" in error ? error.path : "",
    message: "message" in error ? error.message : "",
  });
}

function insertErrorText(dict: Dict, error: InsertError): string {
  return formatTemplate(dict.insertErrors[error.type], {
    row: "row" in error ? error.row : "",
    column: "column" in error ? error.column : "",
    where: "where" in error ? error.where : "",
  });
}

function ErrorList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="list-disc space-y-0.5 rounded-lg border border-destructive/40 py-3 pl-8 pr-4 text-sm text-destructive">
      {items.slice(0, MAX_ERRORS).map((item, index) => (
        <li key={index}>{item}</li>
      ))}
      {items.length > MAX_ERRORS && <li>…（+{items.length - MAX_ERRORS}）</li>}
    </ul>
  );
}

export function SqlInsertGeneratorTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.sqlInsertGenerator;

  const [input, setInput] = React.useState("");
  const [format, setFormat] = React.useState<Format>("csv");
  const [schema, setSchema] = React.useState("");
  const [table, setTable] = React.useState("");
  const [emptyAsNull, setEmptyAsNull] = React.useState(false);
  const [missing, setMissing] = React.useState<MissingKeyMode>("error");
  const [rowsPerStatement, setRowsPerStatement] = React.useState("1");
  const [excluded, setExcluded] = React.useState<string[]>([]);
  const [fileError, setFileError] = React.useState(false);
  const deferredInput = React.useDeferredValue(input);

  React.useEffect(() => {
    const pending = takePendingToolFile("sql-insert-generator");
    pending
      ?.text()
      .then((text) => {
        setInput(text);
        setFormat(pending.name.toLowerCase().endsWith(".json") ? "json" : "csv");
      })
      .catch(() => setFileError(true));
  }, []);

  const source = React.useMemo(() => {
    if (!deferredInput.trim()) return null;
    if (format === "json") {
      const { table, errors } = jsonToSqlSource(deferredInput);
      return { table, errors: errors.map((error) => jsonErrorText(dict, error)) };
    }
    const { table, errors } = csvToSqlSource(deferredInput, ",", emptyAsNull);
    return { table, errors: errors.map((error) => csvTableErrorText(dict, error)) };
  }, [deferredInput, format, emptyAsNull, dict]);

  const columns = React.useMemo(() => source?.table?.columns ?? [], [source]);
  const selected = React.useMemo(() => columns.filter((column) => !excluded.includes(column)), [columns, excluded]);

  const output = React.useMemo(
    () =>
      source?.table
        ? buildInsertSql(source.table, {
            schema,
            table,
            columns: selected,
            missing,
            rowsPerStatement: Number(rowsPerStatement),
          })
        : null,
    [source, schema, table, selected, missing, rowsPerStatement]
  );

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex w-fit rounded-md border p-1" role="radiogroup" aria-label={dict.formatLabel}>
          {(["csv", "json"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={format === value}
              onClick={() => setFormat(value)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                format === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {dict.formats[value]}
            </button>
          ))}
        </div>
      </div>

      <TextInputPanel
        id="sql-insert-input"
        label={dict.inputLabel}
        value={input}
        onChange={setInput}
        placeholder={format === "csv" ? dict.csvPlaceholder : dict.jsonPlaceholder}
        openFileLabel={dict.openFile}
        onFileError={() => setFileError(true)}
        accept=".csv,.json,.txt,text/csv,application/json"
        className="min-h-48"
      />
      {fileError && <p className="text-sm text-destructive">{dict.fileReadError}</p>}
      {source && <ErrorList items={source.errors} />}

      <div className="grid grid-cols-1 gap-4 rounded-lg border p-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sql-insert-table" className="text-sm font-medium">
            {dict.tableLabel}
          </label>
          <div className="flex gap-2">
            <Input
              id="sql-insert-schema"
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              placeholder={dict.schemaPlaceholder}
              aria-label={dict.schemaLabel}
              className="w-1/3"
            />
            <Input
              id="sql-insert-table"
              value={table}
              onChange={(e) => setTable(e.target.value)}
              placeholder={dict.tablePlaceholder}
            />
          </div>
          <span className="text-xs text-muted-foreground">{dict.identifierHint}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{dict.rowsPerStatementLabel}</span>
          <Select value={rowsPerStatement} onValueChange={setRowsPerStatement}>
            <SelectTrigger className="w-56" aria-label={dict.rowsPerStatementLabel}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["1", "100", "1000"].map((value) => (
                <SelectItem key={value} value={value}>
                  {formatTemplate(dict.rowsPerStatement, { count: value })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-medium">{dict.valueRulesHeading}</span>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {(format === "csv" ? dict.csvRules : dict.jsonRules).map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          {format === "csv" ? (
            <div className="flex items-center gap-2">
              <Checkbox id="sql-insert-empty-null" checked={emptyAsNull} onCheckedChange={(v) => setEmptyAsNull(v === true)} />
              <label htmlFor="sql-insert-empty-null" className="text-sm">
                {dict.emptyAsNull}
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm">{dict.missingLabel}</span>
              <Select value={missing} onValueChange={(value) => setMissing(value as MissingKeyMode)}>
                <SelectTrigger className="w-72" aria-label={dict.missingLabel}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["error", "null", "default"] as const).map((value) => (
                    <SelectItem key={value} value={value}>
                      {dict.missingModes[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {columns.length > 0 && (
          <div className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-medium">{dict.columnsLabel}</span>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {columns.map((column, index) => (
                <div key={column} className="flex items-center gap-2">
                  <Checkbox
                    id={`sql-insert-col-${index}`}
                    checked={!excluded.includes(column)}
                    onCheckedChange={(checked) =>
                      setExcluded((current) =>
                        checked === true ? current.filter((c) => c !== column) : [...current, column]
                      )
                    }
                  />
                  <label htmlFor={`sql-insert-col-${index}`} className="font-mono text-sm">
                    {column}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {output && <ErrorList items={output.errors.map((error) => insertErrorText(dict, error))} />}

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{dict.outputLabel}</span>
            {output?.sql !== undefined && (
              <span className="text-muted-foreground tabular-nums">
                {formatTemplate(dict.stats, {
                  rows: output.stats.rows,
                  nulls: output.stats.nulls,
                  quotes: output.stats.quotesEscaped,
                })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <ToolActions getCopyText={() => output?.sql ?? ""} copyDisabled={!output?.sql} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!output?.sql}
              onClick={() => {
                if (!output?.sql) return;
                downloadBytes(new TextEncoder().encode(`${output.sql}\n`), `${table.trim().replace(/[\\/:*?"<>|]/g, "_") || "insert"}.sql`, "application/sql");
              }}
            >
              <Download className="size-4" />
              {dict.download}
            </Button>
            <ToolActions onClear={() => setInput("")} clearDisabled={!input} />
          </div>
        </div>
        <Textarea
          readOnly
          value={output?.sql ?? ""}
          placeholder={dict.outputPlaceholder}
          spellCheck={false}
          aria-label={dict.outputLabel}
          className="min-h-64 font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">{dict.postgresNote}</p>
      </section>
    </div>
  );
}
