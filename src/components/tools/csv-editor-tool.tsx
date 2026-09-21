"use client";

import * as React from "react";
import { Download, FileUp, Plus, RefreshCw, Trash2 } from "lucide-react";

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
import { csvRowsToTable, parseCsv, tableToCsvText } from "@/lib/csv";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

type DelimiterKey = "comma" | "tab" | "semicolon";

const DELIMITERS: Record<DelimiterKey, string> = {
  comma: ",",
  tab: "\t",
  semicolon: ";",
};

type Row = { id: number; cells: string[] };

export function CsvEditorTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.csvEditor;

  const [delimiterKey, setDelimiterKey] = React.useState<DelimiterKey>("comma");
  const [hasHeader, setHasHeader] = React.useState(true);
  const [importText, setImportText] = React.useState("");
  const [importError, setImportError] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);

  const [columns, setColumns] = React.useState<string[] | null>(null);
  const [rows, setRows] = React.useState<Row[]>([]);
  const nextRowId = React.useRef(0);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const DELIMITER_OPTIONS: { value: DelimiterKey; label: string }[] = [
    { value: "comma", label: dict.delimiterComma },
    { value: "tab", label: dict.delimiterTab },
    { value: "semicolon", label: dict.delimiterSemicolon },
  ];

  function loadTable(text: string) {
    if (!text.trim()) {
      setImportError(dict.emptyInputError);
      return;
    }
    try {
      const delimiter = DELIMITERS[delimiterKey];
      const parsedRows = parseCsv(text, delimiter);
      const table = csvRowsToTable(parsedRows, hasHeader);
      const headers =
        table.headers.length > 0
          ? table.headers
          : [formatTemplate(dict.columnNameTemplate, { n: 1 })];
      nextRowId.current = 0;
      setColumns(headers);
      setRows(
        table.rows.map((cells) => ({
          id: nextRowId.current++,
          cells: headers.map((_, index) => cells[index] ?? ""),
        }))
      );
      setImportError(null);
    } catch {
      setImportError(dict.csvParseError);
    }
  }

  function handleFile(file: File) {
    file.text().then((text) => {
      setImportText(text);
      loadTable(text);
    });
  }

  React.useEffect(() => {
    const pending = takePendingToolFile("csv-editor");
    if (pending) handleFile(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- マウント時に一度だけ引き継ぎファイルを確認する
  }, []);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
    e.target.value = "";
  }

  function handleReset() {
    setColumns(null);
    setRows([]);
    setImportText("");
    setImportError(null);
  }

  function updateHeader(index: number, value: string) {
    setColumns((cols) =>
      cols ? cols.map((col, i) => (i === index ? value : col)) : cols
    );
  }

  function updateCell(rowId: number, colIndex: number, value: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              cells: row.cells.map((cell, i) => (i === colIndex ? value : cell)),
            }
          : row
      )
    );
  }

  function addColumn() {
    setColumns((cols) => {
      const next = cols ?? [];
      return [
        ...next,
        formatTemplate(dict.columnNameTemplate, { n: next.length + 1 }),
      ];
    });
    setRows((prev) => prev.map((row) => ({ ...row, cells: [...row.cells, ""] })));
  }

  function removeColumn(index: number) {
    setColumns((cols) => (cols ? cols.filter((_, i) => i !== index) : cols));
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        cells: row.cells.filter((_, i) => i !== index),
      }))
    );
  }

  function addRow() {
    const columnCount = columns?.length ?? 0;
    setRows((prev) => [
      ...prev,
      { id: nextRowId.current++, cells: Array(columnCount).fill("") },
    ]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  const csvOutput = React.useMemo(() => {
    if (!columns) return "";
    return tableToCsvText(
      columns,
      rows.map((row) => row.cells),
      DELIMITERS[delimiterKey]
    );
  }, [columns, rows, delimiterKey]);

  function handleDownload() {
    if (!csvOutput) return;
    const blob = new Blob(["﻿" + csvOutput], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "edited.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (!columns) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {dict.delimiterLabel}
            </span>
            <Select
              value={delimiterKey}
              onValueChange={(value) => setDelimiterKey(value as DelimiterKey)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIMITER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="csv-editor-has-header"
              checked={hasHeader}
              onCheckedChange={(checked) => setHasHeader(checked === true)}
            />
            <label
              htmlFor="csv-editor-has-header"
              className="text-sm text-muted-foreground"
            >
              {dict.hasHeaderLabel}
            </label>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col gap-2 rounded-lg border-2 border-dashed p-3 transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-border"
          )}
        >
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{dict.importLabel}</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="size-4" />
              {dict.chooseFile}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={dict.importPlaceholder}
            spellCheck={false}
            className="min-h-64 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">{dict.dropHint}</p>
          {importError && (
            <p className="text-sm text-destructive">{importError}</p>
          )}
        </div>

        <div>
          <Button type="button" onClick={() => loadTable(importText)}>
            {dict.loadButton}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="size-4" />
            {dict.addRow}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addColumn}>
            <Plus className="size-4" />
            {dict.addColumn}
          </Button>
          <span className="text-sm text-muted-foreground">
            {formatTemplate(dict.statsLabel, {
              rows: rows.length,
              columns: columns.length,
            })}
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleReset}>
          <RefreshCw className="size-4" />
          {dict.resetButton}
        </Button>
      </div>

      {columns.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.noColumnsMessage}</p>
      ) : (
        <div className="max-h-[32rem] overflow-auto rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="w-10 border-b px-2 py-2 text-left font-medium">
                  {dict.rowNumberHeader}
                </th>
                {columns.map((header, colIndex) => (
                  <th
                    key={colIndex}
                    className="min-w-32 border-b px-1 py-1 text-left font-medium"
                  >
                    <div className="flex items-center gap-1">
                      <input
                        value={header}
                        onChange={(e) => updateHeader(colIndex, e.target.value)}
                        placeholder={dict.headerPlaceholder}
                        className="w-full min-w-0 rounded bg-transparent px-1.5 py-1 font-medium outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button
                        type="button"
                        aria-label={dict.deleteColumnLabel}
                        onClick={() => removeColumn(colIndex)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.id} className="odd:bg-muted/30">
                  <td className="border-b px-2 py-1 text-muted-foreground">
                    {rowIndex + 1}
                  </td>
                  {columns.map((_, colIndex) => (
                    <td key={colIndex} className="border-b px-1 py-1">
                      <input
                        value={row.cells[colIndex] ?? ""}
                        onChange={(e) =>
                          updateCell(row.id, colIndex, e.target.value)
                        }
                        className="w-full min-w-0 rounded bg-transparent px-1.5 py-1 outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                  ))}
                  <td className="border-b px-1 py-1">
                    <button
                      type="button"
                      aria-label={dict.deleteRowLabel}
                      onClick={() => removeRow(row.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <ToolActions getCopyText={() => csvOutput} copyDisabled={!csvOutput} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={!csvOutput}
        >
          <Download className="size-4" />
          {dict.downloadCsv}
        </Button>
      </div>
    </div>
  );
}
