"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { SafetyNote, TextInputPanel } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import {
  inspectUnicode,
  isCombiningMark,
  mergeTextareaEdit,
  normalizeAll,
  toRawIndex,
  type GraphemeInfo,
} from "@/lib/unicode-inspect";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

const MAX_TABLE_GRAPHEMES = 2000;
const MAX_VISUAL_GRAPHEMES = 20000;

/** 不可視文字や特殊な空白を記号付きのバッジで表示し、それ以外はそのまま表示する */
function VisualText({ graphemes, limit }: { graphemes: GraphemeInfo[]; limit: number }) {
  return (
    <>
      {graphemes.slice(0, limit).map((grapheme, index) => {
        const specials = grapheme.codePoints.filter((cp) => cp.special);
        const isLineBreak = grapheme.text === "\n" || grapheme.text === "\r\n" || grapheme.text === "\r";
        if (specials.length === 0) return <span key={index}>{grapheme.text}</span>;
        if (specials.length === 1 && specials[0].special === "SPACE" && grapheme.codePoints.length === 1) {
          return (
            <span key={index} className="text-muted-foreground/60" title="U+0020 SPACE">
              ·
            </span>
          );
        }
        const visible = grapheme.codePoints.filter((cp) => !cp.special).map((cp) => String.fromCodePoint(cp.value));
        return (
          <React.Fragment key={index}>
            {visible.join("")}
            <mark
              className="mx-px rounded-sm bg-amber-200 px-0.5 text-[0.7rem] text-amber-950 dark:bg-amber-500/40 dark:text-amber-50"
              title={specials.map((cp) => `${cp.hex} ${cp.special}`).join(" + ")}
            >
              {isLineBreak ? (grapheme.text === "\r\n" ? "CRLF" : specials[0].special) : specials.map((cp) => cp.special).join("+")}
            </mark>
            {isLineBreak && "\n"}
          </React.Fragment>
        );
      })}
    </>
  );
}

export function UnicodeInspectorTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.unicodeInspector;

  // 改行コード（CR・CRLF）を保持するため、textarea の値ではなく元の文字列を state に持つ
  const [input, setInput] = React.useState("");
  const [fileError, setFileError] = React.useState(false);
  const [onlySpecial, setOnlySpecial] = React.useState(false);
  const deferred = React.useDeferredValue(input);

  React.useEffect(() => {
    takePendingToolFile("unicode-inspector")
      ?.text()
      .then(setInput)
      .catch(() => setFileError(true));
  }, []);

  const { graphemes, stats } = React.useMemo(() => inspectUnicode(deferred), [deferred]);
  const normalized = React.useMemo(() => normalizeAll(deferred), [deferred]);
  const normalizedGraphemes = React.useMemo(
    () => normalized.map((item) => (item.changed ? inspectUnicode(item.text).graphemes : null)),
    [normalized]
  );

  const tableGraphemes = React.useMemo(() => {
    const rows = onlySpecial
      ? graphemes.filter((g) => g.codePoints.length > 1 || g.codePoints.some((cp) => cp.special && cp.special !== "SPACE"))
      : graphemes;
    return rows;
  }, [graphemes, onlySpecial]);

  const statItems = [
    [dict.stats.graphemes, stats.graphemes],
    [dict.stats.codePoints, stats.codePoints],
    [dict.stats.utf16Units, stats.utf16Units],
    [dict.stats.utf8Bytes, stats.utf8Bytes],
    [dict.stats.specials, stats.specials],
    ["LF", stats.lf],
    ["CRLF", stats.crlf],
    ["CR", stats.cr],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>

      <div className="flex flex-col gap-2">
        <TextInputPanel
          id="unicode-input"
          label={dict.inputLabel}
          value={input}
          onChange={(next) => setInput((current) => mergeTextareaEdit(current, next))}
          onPaste={(e) => {
            // 貼り付け時はクリップボードの文字列をそのまま挿入し、CRを失わないようにする
            const text = e.clipboardData.getData("text/plain");
            if (!/\r/.test(text)) return;
            e.preventDefault();
            const target = e.currentTarget;
            const { selectionStart, selectionEnd } = target;
            setInput((current) =>
              current.slice(0, toRawIndex(current, selectionStart)) + text + current.slice(toRawIndex(current, selectionEnd))
            );
            const caret = selectionStart + text.replace(/\r\n?/g, "\n").length;
            requestAnimationFrame(() => target.setSelectionRange(caret, caret));
          }}
          placeholder={dict.inputPlaceholder}
          openFileLabel={dict.openFile}
          onFileError={() => setFileError(true)}
          className="min-h-40"
        />
        <p className="text-xs text-muted-foreground">{dict.lineEndingHint}</p>
        {fileError && <p className="text-sm text-destructive">{dict.fileReadError}</p>}
        <ToolActions
          onClear={() => {
            setInput("");
            setFileError(false);
          }}
          clearDisabled={!input}
        />
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {statItems.map(([label, value]) => (
          <div key={label} className="rounded-lg border px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {[stats.lf, stats.crlf, stats.cr].filter((count) => count > 0).length > 1 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">{dict.mixedLineEndings}</p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{dict.visualHeading}</h2>
        {input === "" ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {dict.emptyState}
          </p>
        ) : (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-3 font-mono text-sm">
            <VisualText graphemes={graphemes} limit={MAX_VISUAL_GRAPHEMES} />
          </pre>
        )}
        <p className="text-xs text-muted-foreground">{dict.visualHint}</p>
      </section>

      {input !== "" && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium">{dict.tableHeading}</h2>
            <div className="flex items-center gap-2">
              <Checkbox
                id="unicode-only-special"
                checked={onlySpecial}
                onCheckedChange={(value) => setOnlySpecial(value === true)}
              />
              <label htmlFor="unicode-only-special" className="text-sm">
                {dict.onlySpecial}
              </label>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{dict.columns.char}</th>
                  <th className="px-3 py-2 font-medium">{dict.columns.index}</th>
                  <th className="px-3 py-2 font-medium">{dict.columns.position}</th>
                  <th className="px-3 py-2 font-medium">{dict.columns.codePoint}</th>
                  <th className="px-3 py-2 font-medium">{dict.columns.kind}</th>
                </tr>
              </thead>
              <tbody>
                {tableGraphemes.slice(0, MAX_TABLE_GRAPHEMES).map((grapheme) =>
                  grapheme.codePoints.map((cp, index) => (
                    <tr key={cp.index} className={cn("align-top", index === 0 && "border-t")}>
                      {index === 0 && (
                        <td rowSpan={grapheme.codePoints.length} className="border-r px-3 py-1 text-base">
                          <span className="font-mono">
                            {grapheme.codePoints.some((c) => c.special) ? (
                              <span className="text-xs text-muted-foreground">{grapheme.codePoints.map((c) => c.symbol ?? "").join("")}</span>
                            ) : (
                              grapheme.text
                            )}
                          </span>
                          {grapheme.codePoints.length > 1 && (
                            <span className="block text-[0.65rem] text-muted-foreground">
                              {formatTemplate(dict.clusterNote, { count: grapheme.codePoints.length })}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-1 tabular-nums">{cp.index}</td>
                      <td className="px-3 py-1 tabular-nums">
                        {cp.line}:{cp.column}
                      </td>
                      <td className="px-3 py-1 font-mono">{cp.hex}</td>
                      <td className="px-3 py-1">
                        {cp.special ? (
                          <span className="font-mono text-amber-700 dark:text-amber-400">{cp.special}</span>
                        ) : isCombiningMark(String.fromCodePoint(cp.value)) ? (
                          dict.combiningMark
                        ) : grapheme.codePoints.length > 1 ? (
                          <span className="font-mono">{String.fromCodePoint(cp.value)}</span>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {tableGraphemes.length > MAX_TABLE_GRAPHEMES && (
            <p className="text-xs text-muted-foreground">
              {formatTemplate(dict.truncatedNote, { count: MAX_TABLE_GRAPHEMES })}
            </p>
          )}
        </section>
      )}

      {input !== "" && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{dict.normalizeHeading}</h2>
          <p className="text-xs text-muted-foreground">{dict.normalizeHint}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {normalized.map((item, index) => (
              <div key={item.form} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono font-semibold">{item.form}</span>
                    <span
                      className={
                        item.changed
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {item.changed
                        ? formatTemplate(dict.normalizeChanged, { before: stats.codePoints, after: item.codePoints })
                        : dict.normalizeUnchanged}
                    </span>
                  </div>
                  <ToolActions getCopyText={() => item.text} />
                </div>
                {normalizedGraphemes[index] && (
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/40 p-2 font-mono text-sm">
                    <VisualText graphemes={normalizedGraphemes[index]} limit={MAX_VISUAL_GRAPHEMES} />
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
