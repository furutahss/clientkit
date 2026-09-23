"use client";

import * as React from "react";
import { AlertTriangle, Download, FileUp, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { downloadBytes } from "@/lib/download";
import {
  convertDdlToPrisma,
  type DdlConvertOptions,
  type DdlWarning,
  type PrismaProvider,
} from "@/lib/sql-ddl-to-prisma";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { formatTemplate } from "@/lib/utils";

const SAMPLE_DDL = `CREATE TYPE user_role AS ENUM ('admin', 'member');

CREATE TABLE users (
  id          BIGSERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  name        TEXT,
  role        user_role NOT NULL DEFAULT 'member',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE posts (
  id          SERIAL PRIMARY KEY,
  author_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  published   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_author ON posts (author_id);`;

const PROVIDERS: { value: PrismaProvider; label: string }[] = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL / MariaDB" },
  { value: "sqlite", label: "SQLite" },
  { value: "sqlserver", label: "SQL Server" },
];

export function SqlToPrismaTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.sqlToPrisma;

  const [input, setInput] = React.useState("");
  const [options, setOptions] = React.useState<DdlConvertOptions>({
    provider: "postgresql",
    renameToConvention: true,
    nativeTypes: true,
    includeHeader: false,
  });
  const [fileError, setFileError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const deferredInput = React.useDeferredValue(input);

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
    const pending = takePendingToolFile("sql-to-prisma");
    if (pending) Promise.resolve().then(() => loadFile(pending));
  }, [loadFile]);

  const result = React.useMemo(
    () => (deferredInput.trim() ? convertDdlToPrisma(deferredInput, options) : null),
    [deferredInput, options]
  );
  const output = result && result.modelCount + result.enumCount > 0 ? result.schema : "";

  function updateOption<K extends keyof DdlConvertOptions>(key: K, value: DdlConvertOptions[K]) {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }

  function warningText(warning: DdlWarning): string {
    switch (warning.type) {
      case "no-primary-key":
        return formatTemplate(dict.warningNoPrimaryKey, { table: warning.table });
      case "unknown-reference":
        return formatTemplate(dict.warningUnknownReference, { table: warning.table, target: warning.target });
      case "unsupported-type":
        return formatTemplate(dict.warningUnsupportedType, {
          table: warning.table,
          column: warning.column,
          type: warning.sqlType,
        });
    }
  }

  const CHECK_OPTIONS: { key: "renameToConvention" | "nativeTypes" | "includeHeader"; label: string; hint: string }[] = [
    { key: "renameToConvention", label: dict.optionRename, hint: dict.optionRenameHint },
    { key: "nativeTypes", label: dict.optionNativeTypes, hint: dict.optionNativeTypesHint },
    { key: "includeHeader", label: dict.optionHeader, hint: dict.optionHeaderHint },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="sql-to-prisma-input" className="text-sm font-medium">
              {dict.inputLabel}
            </label>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setInput(SAMPLE_DDL)}>
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
              accept=".sql,application/sql,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFile(file);
                e.target.value = "";
              }}
            />
          </div>
          <Textarea
            id="sql-to-prisma-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const file = e.dataTransfer.files?.[0];
              if (!file) return;
              e.preventDefault();
              loadFile(file);
            }}
            placeholder={dict.placeholder}
            spellCheck={false}
            className="min-h-96 font-mono text-sm"
          />
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          <ToolActions onClear={() => setInput("")} clearDisabled={!input} />
          {result && result.modelCount + result.enumCount === 0 && (
            <p className="text-sm text-destructive">{dict.noTableFound}</p>
          )}

          <div className="flex flex-col gap-3 rounded-md border p-3">
            <span className="text-sm font-medium">{dict.optionsHeading}</span>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">{dict.providerLabel}</span>
              <Select
                value={options.provider}
                onValueChange={(value) => updateOption("provider", value as PrismaProvider)}
              >
                <SelectTrigger className="w-full" aria-label={dict.providerLabel}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {CHECK_OPTIONS.map((item) => (
              <div key={item.key} className="flex items-start gap-2">
                <Checkbox
                  id={`sql-to-prisma-${item.key}`}
                  checked={options[item.key]}
                  onCheckedChange={(checked) => updateOption(item.key, checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor={`sql-to-prisma-${item.key}`} className="flex flex-col gap-0.5 text-sm">
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.hint}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="sql-to-prisma-output" className="text-sm font-medium">
              {dict.outputLabel}
            </label>
            {output && result && (
              <span className="text-xs text-muted-foreground">
                {formatTemplate(dict.summary, { models: result.modelCount, enums: result.enumCount })}
              </span>
            )}
          </div>
          <Textarea
            id="sql-to-prisma-output"
            value={output}
            readOnly
            placeholder={dict.outputPlaceholder}
            spellCheck={false}
            className="min-h-96 font-mono text-sm"
          />
          {result && result.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              {result.warnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {warningText(warning)}
                </li>
              ))}
            </ul>
          )}
          {result && result.skipped.length > 0 && (
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span>{formatTemplate(dict.skippedHeading, { count: result.skipped.length })}</span>
              <ul className="list-inside list-disc font-mono">
                {result.skipped.slice(0, 10).map((statement, index) => (
                  <li key={index} className="truncate">
                    {statement}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <ToolActions getCopyText={() => output} copyDisabled={!output} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!output}
              onClick={() => downloadBytes(new TextEncoder().encode(output), "schema.prisma", "text/plain")}
            >
              <Download className="size-4" />
              {dict.download}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
