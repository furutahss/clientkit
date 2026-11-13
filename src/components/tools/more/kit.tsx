"use client";

import * as React from "react";
import { Download, FileUp } from "lucide-react";

import { SafetyNote } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/i18n/use-locale";
import { downloadBytes } from "@/lib/download";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import type { Result, ToolSpec, Values } from "@/lib/more/types";

export type { Result, ToolSpec, Values } from "@/lib/more/types";

const SAFETY = {
  ja: "入力した内容はこのブラウザ内だけで処理され、サーバーへ送信・保存されません。",
  en: "Everything is processed in this browser only. Nothing is sent to or stored on a server.",
};

export function useT() {
  const lang = useLocale();
  const t = React.useCallback((ja: string, en: string) => (lang === "ja" ? ja : en), [lang]);
  return { lang, t };
}

const fieldClass =
  "border-input bg-transparent dark:bg-input/30 h-9 rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function SelectField({ id, label, value, onChange, choices }: {
  id: string; label: string; value: string; onChange: (v: string) => void; choices: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
        {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    </div>
  );
}

export function TextField({ id, label, value, onChange, type = "text", placeholder, min, max }: {
  id: string; label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; min?: number; max?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input
        id={id} type={type} value={value} placeholder={placeholder} min={min} max={max}
        autoComplete="off" spellCheck={false} onChange={(e) => onChange(e.target.value)} className={fieldClass}
      />
    </div>
  );
}

export function ResultView({ result, lang, outputLabel }: { result: Result | null; lang: Locale; outputLabel?: [string, string] }) {
  if (!result) return null;
  const t = (ja: string, en: string) => (lang === "ja" ? ja : en);
  const label = outputLabel ? (lang === "ja" ? outputLabel[0] : outputLabel[1]) : t("結果", "Result");
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      {result.error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{result.error}</p>}
      {result.notes && result.notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm">{result.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
      )}
      {result.preview}
      {result.tables?.map((table, ti) => (
        <div key={ti} className="flex flex-col gap-1">
          {table.title && <h3 className="text-sm font-semibold">{table.title}</h3>}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50"><tr>{table.head.map((h, i) => <th key={i} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri} className="border-t align-top">
                    {row.map((cell, ci) => <td key={ci} className="px-3 py-1.5 font-mono text-xs break-all whitespace-pre-wrap">{String(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {result.text !== undefined && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium">{label}</label>
            <ToolActions getCopyText={() => result.text ?? ""} copyDisabled={!result.text} />
          </div>
          <Textarea readOnly value={result.text} spellCheck={false} aria-label={label} className="min-h-48 font-mono text-sm" />
        </div>
      )}
      {result.downloads && result.downloads.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.downloads.map((d, i) => (
            <Button key={i} type="button" variant="outline" size="sm" onClick={() => downloadBytes(typeof d.data === "string" ? new TextEncoder().encode(d.data) : d.data, d.name, d.mime)}>
              <Download className="size-4" />{d.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * テキスト／ファイル入力 → 結果表示という形のツールを、設定だけで作るための共通コンポーネント。
 * 結果は入力が変わるたびに再計算する（manualの場合は実行ボタンで計算する）。
 */
export function SpecTool({ id, spec }: { id: string; spec: ToolSpec }) {
  const { lang, t } = useT();
  const inputs = spec.inputs ?? [];
  const [texts, setTexts] = React.useState<Record<string, string>>(() => Object.fromEntries(inputs.map((i) => [i.id, ""])));
  const [opts, setOpts] = React.useState<Values>(() => Object.fromEntries((spec.options ?? []).map((o) => [o.id, o.default])));
  const [files, setFiles] = React.useState<{ name: string; bytes: Uint8Array }[]>([]);
  const [result, setResult] = React.useState<Result | null>(null);
  const [runCount, setRunCount] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const loadFiles = React.useCallback(async (list: File[]) => {
    const loaded = await Promise.all(list.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
    setFiles(spec.files?.multiple ? (prev) => [...prev, ...loaded] : loaded);
  }, [spec.files?.multiple]);

  React.useEffect(() => {
    if (!spec.files) return;
    const pending = takePendingToolFile(id);
    if (pending) Promise.resolve().then(() => loadFiles([pending]));
  }, [id, spec.files, loadFiles]);

  const hasInput = inputs.some((i) => texts[i.id]?.trim()) || files.length > 0;
  const trigger = spec.manual ? runCount : 1;

  React.useEffect(() => {
    if (spec.manual && runCount === 0) return;
    if (!hasInput && !spec.runWithoutInput) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => { if (spec.manual) setBusy(true); })
      .then(() => spec.run({ inputs: texts, opts, files, t, lang }))
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((e: unknown) => { if (!cancelled) setResult({ error: e instanceof Error ? e.message : String(e) }); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts, opts, files, trigger, lang]);

  const shown = hasInput || spec.runWithoutInput ? result : null;
  const sample = spec.sample;

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{spec.safetyNote ? t(spec.safetyNote[0], spec.safetyNote[1]) : t(SAFETY.ja, SAFETY.en)}</SafetyNote>
      {spec.files && (
        <div
          className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-5 text-center text-sm"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void loadFiles(Array.from(e.dataTransfer.files)); }}
        >
          <p className="text-muted-foreground">{spec.files.label ? t(spec.files.label[0], spec.files.label[1]) : t("ファイルをドラッグ＆ドロップ", "Drag and drop a file here")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileUp className="size-4" />{t("ファイルを選択", "Choose file")}</Button>
          <input ref={fileRef} type="file" className="hidden" accept={spec.files.accept} multiple={spec.files.multiple} onChange={(e) => { void loadFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
          {files.length > 0 && <p className="font-mono text-xs">{files.map((f) => `${f.name} (${f.bytes.length.toLocaleString()} B)`).join(", ")}</p>}
        </div>
      )}
      {inputs.map((input) => (
        <div key={input.id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`${id}-${input.id}`} className="text-sm font-medium">{t(input.label[0], input.label[1])}</label>
            {sample && inputs[0]?.id === input.id && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setTexts({ ...texts, ...sample })}>{t("サンプルを入力", "Insert sample")}</Button>
            )}
          </div>
          <Textarea
            id={`${id}-${input.id}`} value={texts[input.id] ?? ""} spellCheck={false} autoComplete="off"
            placeholder={input.placeholder} onChange={(e) => setTexts({ ...texts, [input.id]: e.target.value })}
            className={`${input.mono === false ? "" : "font-mono"} text-sm`} style={{ minHeight: `${(input.rows ?? 8) * 1.5}rem` }}
          />
        </div>
      ))}
      {spec.options && spec.options.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spec.options.map((o) => {
            if (o.hidden?.(opts)) return null;
            const label = t(o.label[0], o.label[1]);
            const fid = `${id}-opt-${o.id}`;
            if (o.kind === "select") {
              return <SelectField key={o.id} id={fid} label={label} value={String(opts[o.id])} onChange={(v) => setOpts({ ...opts, [o.id]: v })} choices={o.choices.map((c) => ({ value: c.value, label: Array.isArray(c.label) ? t(c.label[0], c.label[1]) : c.label }))} />;
            }
            if (o.kind === "checkbox") {
              return (
                <label key={o.id} className="flex items-center gap-2 self-end text-sm" htmlFor={fid}>
                  <input id={fid} type="checkbox" checked={Boolean(opts[o.id])} onChange={(e) => setOpts({ ...opts, [o.id]: e.target.checked })} className="size-4" />{label}
                </label>
              );
            }
            if (o.kind === "number") {
              return <TextField key={o.id} id={fid} label={label} type="number" min={o.min} max={o.max} value={String(opts[o.id])} onChange={(v) => setOpts({ ...opts, [o.id]: v === "" ? o.default : Number(v) })} />;
            }
            return <TextField key={o.id} id={fid} label={label} type={o.secret ? "password" : "text"} placeholder={o.placeholder} value={String(opts[o.id])} onChange={(v) => setOpts({ ...opts, [o.id]: v })} />;
          })}
        </div>
      )}
      {spec.manual && (
        <div><Button type="button" disabled={busy || (!hasInput && !spec.runWithoutInput)} onClick={() => setRunCount((n) => n + 1)}>{spec.manual[lang === "ja" ? 0 : 1]}</Button></div>
      )}
      <ResultView result={shown} lang={lang} outputLabel={spec.outputLabel} />
    </div>
  );
}
