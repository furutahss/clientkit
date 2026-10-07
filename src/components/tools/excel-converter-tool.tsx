"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, FileArchive, FileSpreadsheet, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { getToolPath } from "@/config/tools";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { createZip, downloadBytes } from "@/lib/download";
import { formatBytes } from "@/lib/format-bytes";
import { setPendingToolFile, takePendingToolFile } from "@/lib/pending-tool-file";
import type { DateMode, MergeMode, TableOptions } from "@/lib/spreadsheet";
import type {
  ConvertResult,
  CsvEncoding,
  OutputFormat,
  OutputOptions,
  SheetInfo,
} from "@/lib/spreadsheet-reader";
import { cn, formatTemplate } from "@/lib/utils";
import { WorkerCancelledError, WorkerClient, WorkerTaskError } from "@/lib/worker-client";

const PREVIEW_ROWS = 100;
/** テキストエリアに表示する最大文字数（コピー・ダウンロードは全体） */
const MAX_OUTPUT_CHARS = 200_000;
const LARGE_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPT =
  ".xlsx,.xls,.xlsm,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.oasis.opendocument.spreadsheet";

const DELIMITERS = { comma: ",", tab: "\t", semicolon: ";" } as const;
type DelimiterKey = keyof typeof DELIMITERS;

const HANDOFF_OUTPUT: OutputOptions = {
  format: "csv",
  hasHeader: true,
  encoding: "utf8",
  delimiter: ",",
  quoteAll: false,
  newline: "\n",
};

function createWorker() {
  return new Worker(new URL("../../lib/spreadsheet.worker.ts", import.meta.url), { type: "module" });
}

export function ExcelConverterTool() {
  const locale = useLocale();
  const router = useRouter();
  const dict = React.useMemo(() => getDictionary(locale).tools.excelConverter, [locale]);

  const clientRef = React.useRef<WorkerClient | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const convertSeq = React.useRef(0);

  const [file, setFile] = React.useState<File | null>(null);
  const [sheets, setSheets] = React.useState<SheetInfo[] | null>(null);
  const [activeSheet, setActiveSheet] = React.useState(0);
  const [busy, setBusy] = React.useState<"load" | "convert" | "zip" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [result, setResult] = React.useState<ConvertResult | null>(null);

  const [format, setFormat] = React.useState<OutputFormat>("csv");
  const [hasHeader, setHasHeader] = React.useState(true);
  const [startRow, setStartRow] = React.useState(1);
  const [removeEmptyRows, setRemoveEmptyRows] = React.useState(true);
  const [removeEmptyCols, setRemoveEmptyCols] = React.useState(false);
  const [mergeMode, setMergeMode] = React.useState<MergeMode>("topLeft");
  const [dateMode, setDateMode] = React.useState<DateMode>("iso");
  const [outputFormulas, setOutputFormulas] = React.useState(false);
  const [delimiterKey, setDelimiterKey] = React.useState<DelimiterKey>("comma");
  const [quoteAll, setQuoteAll] = React.useState(false);
  const [newline, setNewline] = React.useState<"\r\n" | "\n">("\r\n");
  const [encoding, setEncoding] = React.useState<CsvEncoding>("utf8bom");

  const tableOptions = React.useMemo<TableOptions>(
    () => ({ startRow, removeEmptyRows, removeEmptyCols, mergeMode, dateMode, outputFormulas }),
    [startRow, removeEmptyRows, removeEmptyCols, mergeMode, dateMode, outputFormulas]
  );
  const outputOptions = React.useMemo<OutputOptions>(
    () => ({ format, hasHeader, encoding, delimiter: DELIMITERS[delimiterKey], quoteAll, newline }),
    [format, hasHeader, encoding, delimiterKey, quoteAll, newline]
  );

  function getClient() {
    clientRef.current ??= new WorkerClient(createWorker);
    return clientRef.current;
  }

  React.useEffect(() => () => clientRef.current?.cancel(), []);

  const describeError = React.useCallback(
    (e: unknown) => {
      if (e instanceof WorkerTaskError && e.code === "password") return dict.passwordError;
      return dict.parseError;
    },
    [dict]
  );

  const loadFile = React.useCallback(
    async (next: File) => {
      setFile(next);
      setSheets(null);
      setResult(null);
      setError(null);
      setActiveSheet(0);
      setBusy("load");
      try {
        const data = await next.arrayBuffer();
        const info = await getClient().request<SheetInfo[]>({ type: "load", data }, [data]);
        if (info.length === 0) throw new WorkerTaskError("parse");
        setSheets(info);
      } catch (e) {
        if (!(e instanceof WorkerCancelledError)) setError(describeError(e));
        setFile(null);
      } finally {
        setBusy(null);
      }
    },
    [describeError]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("excel-converter");
    if (pending) Promise.resolve().then(() => loadFile(pending));
  }, [loadFile]);

  React.useEffect(() => {
    if (!sheets) return;
    const seq = ++convertSeq.current;
    const timer = window.setTimeout(() => {
      setBusy("convert");
      getClient()
        .request<ConvertResult>({
          type: "convert",
          sheet: activeSheet,
          table: tableOptions,
          output: outputOptions,
          previewRows: PREVIEW_ROWS,
        })
        .then((next) => {
          if (seq === convertSeq.current) setResult(next);
        })
        .catch((e) => {
          if (seq === convertSeq.current && !(e instanceof WorkerCancelledError)) setError(describeError(e));
        })
        .finally(() => {
          if (seq === convertSeq.current) setBusy(null);
        });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [sheets, activeSheet, tableOptions, outputOptions, describeError]);

  function reset() {
    clientRef.current?.cancel();
    convertSeq.current++;
    setFile(null);
    setSheets(null);
    setResult(null);
    setBusy(null);
    setError(null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) void loadFile(dropped);
  }

  const baseName = (file?.name ?? "sheet").replace(/\.[^.]+$/, "");
  const sheetName = sheets?.[activeSheet]?.name ?? "sheet";
  const extension = format === "csv" ? (delimiterKey === "tab" ? "tsv" : "csv") : "json";
  const mimeType =
    format === "csv"
      ? `text/csv;charset=${encoding === "sjis" ? "shift_jis" : "utf-8"}`
      : "application/json";

  async function handleZip() {
    setBusy("zip");
    try {
      const files = await getClient().request<{ name: string; data: Uint8Array }[]>({
        type: "convertAll",
        table: tableOptions,
        output: outputOptions,
      });
      const entries = files.map((entry) => ({
        name: extension === "tsv" ? entry.name.replace(/\.csv$/, ".tsv") : entry.name,
        data: entry.data,
      }));
      downloadBytes(await createZip(entries), `${baseName}.zip`, "application/zip");
    } catch (e) {
      if (!(e instanceof WorkerCancelledError)) setError(describeError(e));
    } finally {
      setBusy(null);
    }
  }

  async function openInTool(toolId: "csv-editor" | "csv-json-converter") {
    try {
      const handoff = await getClient().request<ConvertResult>({
        type: "convert",
        sheet: activeSheet,
        table: tableOptions,
        output: HANDOFF_OUTPUT,
        previewRows: 0,
      });
      setPendingToolFile(toolId, new File([handoff.text], `${baseName}-${sheetName}.csv`, { type: "text/csv" }));
      router.push(getToolPath(locale, toolId));
    } catch (e) {
      if (!(e instanceof WorkerCancelledError)) setError(describeError(e));
    }
  }

  const displayText =
    result && result.text.length > MAX_OUTPUT_CHARS ? result.text.slice(0, MAX_OUTPUT_CHARS) : (result?.text ?? "");
  const preview = result?.preview ?? [];
  const previewHeader = hasHeader ? preview[0] : null;
  const previewBody = hasHeader ? preview.slice(1) : preview;
  const previewWidth = preview.reduce((max, row) => Math.max(max, row.length), 0);

  const checkbox = (id: string, checked: boolean, onChange: (value: boolean) => void, label: string) => (
    <div className="flex items-start gap-2">
      <Checkbox
        id={`excel-${id}`}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5"
      />
      <label htmlFor={`excel-${id}`} className="text-sm">
        {label}
      </label>
    </div>
  );

  const select = <T extends string>(
    id: string,
    label: string,
    value: T,
    onChange: (value: T) => void,
    options: [T, string][]
  ) => (
    <div className="flex flex-col gap-1.5">
      <label id={`excel-${id}-label`} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger className="w-full" aria-labelledby={`excel-${id}-label`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) void loadFile(selected);
          e.target.value = "";
        }}
      />

      {file && busy !== "load" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium break-all">{file.name}</span>
              <span className="text-muted-foreground">
                {formatBytes(file.size)}
                {sheets && ` ・ ${formatTemplate(dict.sheetCount, { count: sheets.length })}`}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            <RefreshCw className="size-4" />
            {dict.loadAnother}
          </Button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-border"
          )}
        >
          {busy === "load" ? (
            <>
              <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground" role="status">
                {formatTemplate(dict.loading, { name: file?.name ?? "" })}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={reset}>
                <X className="size-4" />
                {dict.cancel}
              </Button>
            </>
          ) : (
            <>
              <FileSpreadsheet className="size-8 text-muted-foreground" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{dict.dropLabel}</p>
                <p className="text-xs text-muted-foreground">{dict.dropHint}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <FileSpreadsheet className="size-4" />
                {dict.chooseFile}
              </Button>
            </>
          )}
        </div>
      )}

      {file && file.size >= LARGE_FILE_BYTES && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {formatTemplate(dict.largeFileWarning, { size: formatBytes(file.size) })}
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {sheets && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" id="excel-sheet-label">
              {dict.sheetLabel}
            </span>
            <div role="tablist" aria-labelledby="excel-sheet-label" className="flex flex-wrap gap-1.5">
              {sheets.map((sheet, index) => (
                <button
                  key={`${index}-${sheet.name}`}
                  type="button"
                  role="tab"
                  aria-selected={index === activeSheet}
                  onClick={() => setActiveSheet(index)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition-colors",
                    index === activeSheet
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {sheet.name}
                  <span className="ml-1.5 text-xs opacity-75 tabular-nums">
                    {formatTemplate(dict.sheetSize, { rows: sheet.rows, cols: sheet.cols })}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <div className="flex h-fit flex-col gap-4 rounded-md border p-3">
              <span className="text-sm font-medium">{dict.optionsHeading}</span>

              {select("format", dict.formatLabel, format, setFormat, [
                ["csv", dict.formatCsv],
                ["jsonObjects", dict.formatJsonObjects],
                ["jsonArrays", dict.formatJsonArrays],
              ])}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="excel-start-row" className="text-xs text-muted-foreground">
                  {dict.startRowLabel}
                </label>
                <Input
                  id="excel-start-row"
                  type="number"
                  min={1}
                  value={startRow}
                  onChange={(e) => setStartRow(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
                  className="w-28"
                />
              </div>

              <div className="flex flex-col gap-2">
                {checkbox("header", hasHeader, setHasHeader, dict.hasHeader)}
                {checkbox("empty-rows", removeEmptyRows, setRemoveEmptyRows, dict.removeEmptyRows)}
                {checkbox("empty-cols", removeEmptyCols, setRemoveEmptyCols, dict.removeEmptyCols)}
                {checkbox("formulas", outputFormulas, setOutputFormulas, dict.outputFormulas)}
              </div>

              {select("merge", dict.mergeLabel, mergeMode, setMergeMode, [
                ["topLeft", dict.mergeTopLeft],
                ["fill", dict.mergeFill],
              ])}
              {select("date", dict.dateLabel, dateMode, setDateMode, [
                ["iso", dict.dateIso],
                ["formatted", dict.dateFormatted],
                ["serial", dict.dateSerial],
              ])}

              {format === "csv" && (
                <>
                  {select("delimiter", dict.delimiterLabel, delimiterKey, setDelimiterKey, [
                    ["comma", dict.delimiterComma],
                    ["tab", dict.delimiterTab],
                    ["semicolon", dict.delimiterSemicolon],
                  ])}
                  {select("newline", dict.newlineLabel, newline === "\r\n" ? "crlf" : "lf", (value) =>
                    setNewline(value === "crlf" ? "\r\n" : "\n"),
                  [
                    ["crlf", "CRLF (Windows)"],
                    ["lf", "LF (macOS / Linux)"],
                  ])}
                  {select("encoding", dict.encodingLabel, encoding, setEncoding, [
                    ["utf8bom", dict.encodingUtf8Bom],
                    ["utf8", dict.encodingUtf8],
                    ["sjis", dict.encodingSjis],
                  ])}
                  {checkbox("quote-all", quoteAll, setQuoteAll, dict.quoteAll)}
                </>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{dict.previewLabel}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums" role="status">
                    {busy === "convert" && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                    {result && formatTemplate(dict.rowCount, { count: result.rowCount.toLocaleString() })}
                  </span>
                </div>
                {preview.length > 0 ? (
                  <div className="max-h-80 overflow-auto rounded-md border">
                    <table className="w-full border-collapse text-sm">
                      {previewHeader && (
                        <thead className="sticky top-0 bg-muted">
                          <tr>
                            {Array.from({ length: previewWidth }, (_, c) => (
                              <th key={c} className="border-b px-3 py-2 text-left font-medium whitespace-nowrap">
                                {String(previewHeader[c] ?? "")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {previewBody.map((row, r) => (
                          <tr key={r} className="odd:bg-muted/30">
                            {Array.from({ length: previewWidth }, (_, c) => (
                              <td key={c} className="border-b px-3 py-1.5 whitespace-nowrap">
                                {row[c] === null || row[c] === undefined ? "" : String(row[c])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  result && <p className="text-sm text-muted-foreground">{dict.emptySheet}</p>
                )}
                {result && result.rowCount > PREVIEW_ROWS && (
                  <p className="text-xs text-muted-foreground">
                    {formatTemplate(dict.previewNotice, { count: PREVIEW_ROWS })}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="excel-output" className="text-sm font-medium">
                  {dict.outputLabel}
                </label>
                <Textarea
                  id="excel-output"
                  value={displayText}
                  readOnly
                  wrap="off"
                  spellCheck={false}
                  className="min-h-64 font-mono text-xs"
                />
                {result && result.text.length > MAX_OUTPUT_CHARS && (
                  <p className="text-xs text-muted-foreground">{dict.outputTruncated}</p>
                )}
                {result && result.unencodable > 0 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    {formatTemplate(dict.unencodableWarning, { count: result.unencodable })}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <ToolActions getCopyText={() => result?.text ?? ""} copyDisabled={!result?.text} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!result}
                    onClick={() =>
                      result && downloadBytes(result.bytes, `${baseName}-${sheetName}.${extension}`, mimeType)
                    }
                  >
                    <Download className="size-4" />
                    {dict.download}
                  </Button>
                  {sheets.length > 1 && (
                    <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={handleZip}>
                      {busy === "zip" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <FileArchive className="size-4" />
                      )}
                      {dict.downloadZip}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" disabled={!result} onClick={() => openInTool("csv-editor")}>
                    {dict.openCsvEditor}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!result}
                    onClick={() => openInTool("csv-json-converter")}
                  >
                    {dict.openCsvJsonConverter}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
