"use client";

import * as React from "react";
import { ResultView, useT } from "@/components/tools/more/kit";
import { SafetyNote } from "@/components/tools/text-input-panel";
import { Textarea } from "@/components/ui/textarea";
import { decodeCalendar, MAX_INPUT, parseCalendar, validDate, type Property } from "@/lib/more/icalendar";
import { takePendingToolFile } from "@/lib/pending-tool-file";

export function IcalendarInspectorTool() {
  const { lang, t } = useT();
  const [input, setInput] = React.useState("");
  const [fileError, setFileError] = React.useState("");
  const request = React.useRef(0);
  const load = React.useCallback(async (file: File) => {
    const id = ++request.current; setInput(""); setFileError("");
    try {
      if (file.size > MAX_INPUT) throw new Error(`Input limit: ${MAX_INPUT} bytes`);
      const value = decodeCalendar(new Uint8Array(await file.arrayBuffer()));
      if (!value.trim()) throw new Error(t("ファイルが空です。", "The file is empty."));
      if (id === request.current) setInput(value);
    } catch (error) {
      if (id === request.current) setFileError(error instanceof Error && (error.message.includes("limit") || error.message.includes("UTF-8") || error.message.includes("empty") || error.message.includes("空")) ? error.message : t("読み込みに失敗しました。ファイルを再選択してください。", "Could not read the file. Please select it again."));
    }
  }, [t]);
  React.useEffect(() => { const file = takePendingToolFile("icalendar-inspector"); if (file) void Promise.resolve().then(() => load(file)); }, [load]);
  let result: ReturnType<typeof parseCalendar> | null = null; let error = fileError;
  if (input.trim() && !error) { try { result = parseCalendar(input); } catch (e) { error = e instanceof Error ? e.message : String(e); } }
  const missing = t("未指定", "Not specified");
  const display = (p: Property, name: string) => {
    if (!["DTSTART", "DTEND", "DTSTAMP", "RECURRENCE-ID"].includes(name) || !validDate(p)) return validDate(p) || !["DTSTART", "DTEND", "DTSTAMP", "RECURRENCE-ID"].includes(name) ? p.value : p.source;
    const v = p.value; const date = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    if (p.params.VALUE?.toUpperCase() === "DATE") return `${date} ${t("（終日）", "(all day)")}${name === "DTEND" ? t("（終了日を含まない）", " (end date exclusive)") : ""}`;
    return `${date} ${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)} ${v.endsWith("Z") ? "UTC" : p.params.TZID || t("タイムゾーン指定なし", "No time zone")}`;
  };
  const values = (fields: Record<string, Property[]>, name: string) => fields[name]?.map((p) => display(p, name)).join("\n") ?? missing;
  return <div className="flex flex-col gap-4">
    <SafetyNote>{t("予定はブラウザ内だけで読み取り、送信・保存しません。", "Events are read only in your browser and are not sent or saved.")}</SafetyNote>
    <label className="text-sm font-medium" htmlFor="ics-file">{t(".ics ファイルを選択", "Select an .ics file")}</label>
    <input id="ics-file" type="file" accept=".ics,text/calendar" onChange={(e) => { const file = e.target.files?.[0]; if (file) void load(file); e.target.value = ""; }} />
    <label className="text-sm font-medium" htmlFor="ics-text">{t("または内容を貼り付け", "Or paste the contents")}</label>
    <Textarea id="ics-text" className="min-h-56 font-mono text-sm" value={input} onChange={(e) => { request.current++; setFileError(""); setInput(e.target.value); }} spellCheck={false} />
    {!input.trim() && !error && <p className="text-sm text-muted-foreground">{t("ファイルを選択するか、内容を貼り付けてください。", "Select a file or paste its contents.")}</p>}
    <ResultView lang={lang} result={error ? { error } : result ? { notes: result.events.length ? [] : [t("予定なし", "No events")], tables: result.events.length ? [{ head: [t("件名", "Summary"), t("開始", "Start"), t("終了", "End"), t("場所", "Location")], rows: result.events.map(({ fields }) => [values(fields, "SUMMARY"), values(fields, "DTSTART"), [...(fields.DTEND ?? []).map((p) => display(p, "DTEND")), ...(fields.DURATION ?? []).map((p) => `DURATION: ${p.value}`)].join("\n") || missing, values(fields, "LOCATION")]) }] : [], preview: <div className="space-y-3">{result.events.map((event, i) => <details key={i} className="rounded-md border p-3 text-sm"><summary>{t(`予定 ${i + 1} の詳細`, `Event ${i + 1} details`)}</summary><dl className="mt-2 whitespace-pre-wrap break-all">{["DESCRIPTION", "ATTENDEE", "UID", "DTSTAMP", "RRULE", "RDATE", "EXDATE", "RECURRENCE-ID"].map((name) => <div key={name}><dt className="font-semibold">{name}</dt><dd>{values(event.fields, name)}</dd></div>)}<dt className="font-semibold">METHOD</dt><dd>{result?.method?.value ?? missing}</dd></dl>{event.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-destructive">{event.warnings.map((warning, j) => <li key={j}>{warning}</li>)}</ul>}</details>)}</div> } : null} />
  </div>;
}
