"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SafetyNote, TextInputPanel } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { SAMPLE_SOURCE_MAP, SAMPLE_STACK } from "@/lib/source-map-sample";
import { loadSourceMap, parseStack, resolveStack, type ResolvedFrame } from "@/lib/source-map-trace";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";

type Dict = ReturnType<typeof getDictionary>["tools"]["sourceMapResolver"];

function frameText(frame: ResolvedFrame): string {
  if (frame.status !== "mapped") return frame.frame.text;
  const name = frame.name ? `${frame.name} ` : "";
  return `    at ${name}(${frame.source}:${frame.line}:${frame.column})`;
}

function FrameRow({ dict, frame }: { dict: Dict; frame: ResolvedFrame }) {
  return (
    <li className="flex flex-col gap-1 border-t px-3 py-2 first:border-t-0">
      <span className={cn("break-all font-mono text-xs", frame.status === "mapped" && "text-muted-foreground line-through")}>
        {frame.frame.text}
      </span>
      {frame.status === "mapped" ? (
        <>
          <span className="break-all font-mono text-sm">
            {frame.source}:{frame.line}:{frame.column}
            {frame.name && <span className="ml-2 text-muted-foreground">({frame.name})</span>}
          </span>
          {frame.snippet ? (
            <pre className="overflow-x-auto rounded-md bg-muted/40 p-2 font-mono text-xs">
              {frame.snippet.map((line) => (
                <div key={line.line} className={cn(line.line === frame.line && "bg-amber-500/15 font-medium")}>
                  <span className="mr-3 inline-block w-8 select-none text-right text-muted-foreground">{line.line}</span>
                  {line.text}
                  {line.line === frame.line && (
                    <div aria-hidden="true">
                      <span className="mr-3 inline-block w-8" />
                      {" ".repeat(frame.column - 1)}^
                    </div>
                  )}
                </div>
              ))}
            </pre>
          ) : (
            <span className="text-xs text-muted-foreground">{dict.noSourcesContent}</span>
          )}
        </>
      ) : (
        <span className={cn("text-xs", frame.status === "unmapped" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
          {dict.frameStatus[frame.status]}
        </span>
      )}
    </li>
  );
}

export function SourceMapResolverTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.sourceMapResolver;

  const [mapText, setMapText] = React.useState("");
  const [stack, setStack] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [columnBase, setColumnBase] = React.useState<0 | 1>(1);
  const [fileError, setFileError] = React.useState(false);
  const deferredMap = React.useDeferredValue(mapText);

  React.useEffect(() => {
    takePendingToolFile("source-map-resolver")
      ?.text()
      .then(setMapText)
      .catch(() => setFileError(true));
  }, []);

  const loaded = React.useMemo(() => (deferredMap.trim() === "" ? null : loadSourceMap(deferredMap)), [deferredMap]);
  const target = fileName.trim() || (loaded?.status === "ok" ? (loaded.file ?? "") : "");
  const frames = React.useMemo(
    () => (loaded?.status === "ok" && stack.trim() !== "" ? resolveStack(loaded.map, parseStack(stack), target, columnBase) : null),
    [loaded, stack, target, columnBase]
  );

  function mapError() {
    if (!loaded || loaded.status === "ok") return null;
    const message =
      loaded.status === "syntax"
        ? formatTemplate(dict.mapErrors.syntax, { line: loaded.error.line, column: loaded.error.column, message: loaded.error.message })
        : loaded.status === "version"
          ? formatTemplate(dict.mapErrors.version, { version: String(loaded.version) })
          : loaded.status === "invalid"
            ? formatTemplate(dict.mapErrors.invalid, { message: loaded.message })
            : dict.mapErrors[loaded.status];
    return <p className="text-sm text-destructive">{message}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>
      <p className="text-sm text-muted-foreground">{dict.scopeNote}</p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <TextInputPanel
            id="source-map-input"
            label={dict.mapLabel}
            value={mapText}
            onChange={setMapText}
            placeholder={'{"version": 3, "sources": [...], "mappings": "..."}'}
            openFileLabel={dict.openFile}
            onFileError={() => setFileError(true)}
            accept=".map,.json,application/json"
            invalid={!!loaded && loaded.status !== "ok"}
          />
          {mapError()}
        </div>
        <TextInputPanel
          id="source-map-stack"
          label={dict.stackLabel}
          value={stack}
          onChange={setStack}
          placeholder={"Error: ...\n    at fn (https://example.com/app.min.js:1:24050)"}
          openFileLabel={dict.openFile}
          onFileError={() => setFileError(true)}
        />
      </div>
      {fileError && <p className="text-sm text-destructive">{dict.fileReadError}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="source-map-file" className="text-sm font-medium">
            {dict.fileLabel}
          </label>
          <Input
            id="source-map-file"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder={loaded?.status === "ok" && loaded.file ? loaded.file : "app.min.js"}
            spellCheck={false}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">{target ? formatTemplate(dict.fileHint, { file: target }) : dict.fileHintAll}</p>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{dict.columnBaseLabel}</legend>
          {([1, 0] as const).map((base) => (
            <label key={base} className="flex items-center gap-2 text-sm">
              <input type="radio" name="column-base" checked={columnBase === base} onChange={() => setColumnBase(base)} />
              {dict.columnBase[base]}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setMapText(SAMPLE_SOURCE_MAP);
            setStack(SAMPLE_STACK);
            setFileName("");
            setColumnBase(1);
          }}
        >
          <FlaskConical className="size-4" />
          {dict.loadSample}
        </Button>
        <ToolActions
          onClear={() => {
            setMapText("");
            setStack("");
            setFileName("");
            setFileError(false);
          }}
          clearDisabled={!mapText && !stack && !fileName}
          getCopyText={() => (frames ?? []).map(frameText).join("\n")}
          copyDisabled={!frames}
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{dict.resultHeading}</h2>
        {!frames ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{dict.emptyState}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {formatTemplate(dict.summary, {
                mapped: frames.filter((f) => f.status === "mapped").length,
                total: frames.filter((f) => f.status !== "noLocation").length,
              })}
            </p>
            <ol className="rounded-lg border">
              {frames.map((frame, index) => (
                <FrameRow key={index} dict={dict} frame={frame} />
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}
