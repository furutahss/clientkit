"use client";

import * as React from "react";
import { Download } from "lucide-react";

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
import {
  csvRowsToJson,
  csvRowsToTable,
  jsonValueToCsv,
  parseCsv,
} from "@/lib/csv";
import { locateJsonError, type JsonErrorLocation } from "@/lib/json-error";
import { cn } from "@/lib/utils";

type Mode = "csvToJson" | "jsonToCsv";
type DelimiterKey = "comma" | "tab" | "semicolon";
type JsonFormat = "pretty" | "minify";

const DELIMITERS: Record<DelimiterKey, string> = {
  comma: ",",
  tab: "\t",
  semicolon: ";",
};

const DELIMITER_OPTIONS: { value: DelimiterKey; label: string }[] = [
  { value: "comma", label: "カンマ (,)" },
  { value: "tab", label: "タブ" },
  { value: "semicolon", label: "セミコロン (;)" },
];

const SAMPLE_CSV = "name,age,city\n田中太郎,28,東京\n鈴木花子,34,大阪";

export function CsvJsonConverterTool() {
  const [mode, setMode] = React.useState<Mode>("csvToJson");
  const [input, setInput] = React.useState("");
  const [delimiterKey, setDelimiterKey] = React.useState<DelimiterKey>("comma");
  const [hasHeader, setHasHeader] = React.useState(true);
  const [jsonFormat, setJsonFormat] = React.useState<JsonFormat>("pretty");

  const delimiter = DELIMITERS[delimiterKey];

  const csvToJsonResult = React.useMemo(() => {
    if (mode !== "csvToJson" || !input.trim()) {
      return { output: "", table: null as { headers: string[]; rows: string[][] } | null, error: null as string | null };
    }
    try {
      const rows = parseCsv(input, delimiter);
      const table = csvRowsToTable(rows, hasHeader);
      const json = csvRowsToJson(rows, hasHeader);
      const output =
        jsonFormat === "minify"
          ? JSON.stringify(json)
          : JSON.stringify(json, null, 2);
      return { output, table, error: null };
    } catch {
      return {
        output: "",
        table: null,
        error: "CSVの解析に失敗しました。",
      };
    }
  }, [mode, input, delimiter, hasHeader, jsonFormat]);

  const jsonToCsvResult = React.useMemo(() => {
    if (mode !== "jsonToCsv" || !input.trim()) {
      return {
        output: "",
        table: null as { headers: string[]; rows: string[][] } | null,
        error: null as JsonErrorLocation | null,
      };
    }
    try {
      const parsed = JSON.parse(input);
      const csv = jsonValueToCsv(parsed, delimiter);
      const rows = parseCsv(csv, delimiter);
      const table = csvRowsToTable(rows, true);
      return { output: csv, table, error: null };
    } catch (error) {
      return {
        output: "",
        table: null,
        error: locateJsonError(input, error),
      };
    }
  }, [mode, input, delimiter]);

  const output = mode === "csvToJson" ? csvToJsonResult.output : jsonToCsvResult.output;
  const table = mode === "csvToJson" ? csvToJsonResult.table : jsonToCsvResult.table;

  function handleDownloadCsv() {
    if (!output) return;
    const blob = new Blob(["﻿" + output], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "converted.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex w-fit rounded-md border p-1">
          {(
            [
              { value: "csvToJson", label: "CSV → JSON" },
              { value: "jsonToCsv", label: "JSON → CSV" },
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

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">区切り文字</span>
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

        {mode === "csvToJson" && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="has-header"
              checked={hasHeader}
              onCheckedChange={(checked) => setHasHeader(checked === true)}
            />
            <label htmlFor="has-header" className="text-sm text-muted-foreground">
              1行目をヘッダーとして扱う
            </label>
          </div>
        )}

        {mode === "csvToJson" && (
          <div className="inline-flex w-fit rounded-md border p-1">
            {(
              [
                { value: "pretty", label: "整形" },
                { value: "minify", label: "1行化" },
              ] as { value: JsonFormat; label: string }[]
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setJsonFormat(item.value)}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  jsonFormat === item.value
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            {mode === "csvToJson" ? "CSV入力" : "JSON入力"}
          </label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "csvToJson" ? SAMPLE_CSV : '[{"name":"田中太郎","age":28}]'}
            spellCheck={false}
            className="min-h-64 font-mono text-sm"
          />
          {mode === "jsonToCsv" && jsonToCsvResult.error && (
            <p className="text-sm text-destructive">
              {jsonToCsvResult.error.line}行目 {jsonToCsvResult.error.column}
              列目: {jsonToCsvResult.error.message}
            </p>
          )}
          {mode === "csvToJson" && csvToJsonResult.error && (
            <p className="text-sm text-destructive">{csvToJsonResult.error}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            {mode === "csvToJson" ? "JSON出力" : "CSV出力"}
          </label>
          <Textarea
            value={output}
            readOnly
            placeholder="結果がここに表示されます"
            spellCheck={false}
            className="min-h-64 font-mono text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <ToolActions
              onClear={() => setInput("")}
              clearDisabled={!input}
              getCopyText={() => output}
              copyDisabled={!output}
            />
            {mode === "jsonToCsv" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadCsv}
                disabled={!output}
              >
                <Download className="size-4" />
                CSVをダウンロード
              </Button>
            )}
          </div>
        </div>
      </div>

      {table && table.headers.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">テーブルプレビュー</label>
          <div className="max-h-80 overflow-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {table.headers.map((header, index) => (
                    <th
                      key={index}
                      className="border-b px-3 py-2 text-left font-medium whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, 200).map((row, rowIndex) => (
                  <tr key={rowIndex} className="odd:bg-muted/30">
                    {table.headers.map((_, colIndex) => (
                      <td
                        key={colIndex}
                        className="border-b px-3 py-1.5 whitespace-nowrap"
                      >
                        {row[colIndex] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.rows.length > 200 && (
            <p className="text-xs text-muted-foreground">
              最初の200行のみプレビュー表示しています（全{table.rows.length}行）。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
