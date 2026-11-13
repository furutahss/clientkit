"use client";

import * as React from "react";

import { SafetyNote } from "@/components/tools/text-input-panel";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/tools/more/kit";

type Entry = { id: number; type: string; key: string; code: string; keyCode: number; location: number; mods: string; repeat: boolean; composing: boolean };
const LOCATION = ["standard", "left", "right", "numpad"];

export function KeyboardInspectorTool() {
  const { t } = useT();
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [focused, setFocused] = React.useState(false);
  const counter = React.useRef(0);

  function handle(e: React.KeyboardEvent) {
    // フォーカス移動などブラウザ操作を妨げないよう、Tab と Escape だけは通常動作に任せる
    if (e.key !== "Tab" && e.key !== "Escape") e.preventDefault();
    const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Meta"].filter(Boolean).join("+");
    const entry: Entry = { id: counter.current++, type: e.type, key: e.key, code: e.code, keyCode: e.keyCode, location: e.location, mods, repeat: e.repeat, composing: e.nativeEvent.isComposing };
    setEntries((prev) => [entry, ...prev].slice(0, 40));
  }

  const last = entries[0];
  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{t("入力したキーはこのページの中だけで表示され、送信・保存されません。", "Pressed keys are shown only on this page and never sent or stored.")}</SafetyNote>
      <div
        tabIndex={0}
        role="textbox"
        aria-label={t("キー入力エリア。ここにフォーカスしてキーを押してください", "Key input area. Focus here and press keys")}
        onKeyDown={handle}
        onKeyUp={handle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center outline-none ${focused ? "border-primary bg-primary/5" : ""}`}
      >
        {last ? (
          <>
            <div className="text-5xl font-semibold">{last.key === " " ? "␣" : last.key}</div>
            <div className="font-mono text-sm text-muted-foreground">code: {last.code} · keyCode: {last.keyCode}</div>
          </>
        ) : (
          <p className="text-muted-foreground">{focused ? t("キーを押してください…", "Press a key…") : t("ここをクリックしてフォーカスし、キーを押してください", "Click here to focus, then press a key")}</p>
        )}
      </div>
      {last && (
        <dl className="grid gap-2 rounded-lg border p-4 text-sm sm:grid-cols-2">
          {([["event.key", last.key === " " ? '" "' : last.key], ["event.code", last.code], ["event.keyCode (deprecated)", String(last.keyCode)], ["event.location", `${last.location} (${LOCATION[last.location] ?? "?"})`], [t("修飾キー", "Modifiers"), last.mods || "-"], ["event.repeat", String(last.repeat)], ["event.isComposing (IME)", String(last.composing)]] as const).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="font-mono break-all">{v}</dd></div>
          ))}
        </dl>
      )}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("履歴", "History")}</h2>
        <Button type="button" variant="outline" size="sm" disabled={!entries.length} onClick={() => setEntries([])}>{t("クリア", "Clear")}</Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50"><tr>{["type", "key", "code", "keyCode", t("修飾", "mods"), "repeat", "IME"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t font-mono text-xs">
                <td className="px-3 py-1.5">{e.type}</td><td className="px-3 py-1.5">{e.key === " " ? "␣" : e.key}</td><td className="px-3 py-1.5">{e.code}</td><td className="px-3 py-1.5">{e.keyCode}</td><td className="px-3 py-1.5">{e.mods || "-"}</td><td className="px-3 py-1.5">{String(e.repeat)}</td><td className="px-3 py-1.5">{String(e.composing)}</td>
              </tr>
            ))}
            {!entries.length && <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">{t("まだ入力がありません", "No input yet")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
