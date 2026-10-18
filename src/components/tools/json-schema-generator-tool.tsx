"use client";

import * as React from "react";
import { Download, FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SafetyNote, TextInputPanel } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { downloadBytes } from "@/lib/download";
import { locateJsonError, type JsonErrorLocation } from "@/lib/json-error";
import { generateJsonSchema } from "@/lib/json-schema-generate";
import { loadAjv2020, validateWithSchema } from "@/lib/json-schema-validate";
import { useLazyModule } from "@/lib/lazy-module";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { formatTemplate } from "@/lib/utils";

const SAMPLE = `{
  "id": 101,
  "name": "Taro",
  "score": 82.5,
  "active": true,
  "nickname": null,
  "tags": ["admin", "beta"],
  "history": [],
  "settings": {},
  "addresses": [
    { "zip": "100-0001", "primary": true },
    { "zip": "530-0001", "note": "office" }
  ],
  "values": [1, "two", null]
}`;

export function JsonSchemaGeneratorTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.jsonSchemaGenerator;

  const [input, setInput] = React.useState("");
  const [fileError, setFileError] = React.useState(false);
  const { module: Ajv2020 } = useLazyModule(loadAjv2020);
  const deferred = React.useDeferredValue(input);

  React.useEffect(() => {
    takePendingToolFile("json-schema-generator")
      ?.text()
      .then(setInput)
      .catch(() => setFileError(true));
  }, []);

  const outcome = React.useMemo((): { schema: string } | { error: JsonErrorLocation } | null => {
    if (deferred.trim() === "") return null;
    try {
      return { schema: JSON.stringify(generateJsonSchema(JSON.parse(deferred)), null, 2) };
    } catch (error) {
      return { error: locateJsonError(deferred, error) };
    }
  }, [deferred]);

  const schema = outcome && "schema" in outcome ? outcome.schema : "";
  const verified = React.useMemo(
    () => (schema && Ajv2020 ? validateWithSchema(Ajv2020, deferred, schema).status === "valid" : null),
    [schema, Ajv2020, deferred]
  );

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
        {dict.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <TextInputPanel
            id="schema-generator-input"
            label={dict.inputLabel}
            value={input}
            onChange={setInput}
            placeholder={dict.inputPlaceholder}
            openFileLabel={dict.openFile}
            onFileError={() => setFileError(true)}
            accept=".json,application/json"
            invalid={!!outcome && "error" in outcome}
            className="min-h-96"
          />
          {outcome && "error" in outcome && (
            <p className="text-sm text-destructive">
              {formatTemplate(dict.parseError, {
                line: outcome.error.line,
                column: outcome.error.column,
                message: outcome.error.message,
              })}
            </p>
          )}
          {fileError && <p className="text-sm text-destructive">{dict.fileReadError}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{dict.outputLabel}</span>
            <div className="flex flex-wrap gap-2">
              <ToolActions getCopyText={() => schema} copyDisabled={!schema} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!schema}
                onClick={() => downloadBytes(new Blob([schema], { type: "application/schema+json" }), "schema.json", "application/schema+json")}
              >
                <Download className="size-4" />
                {dict.download}
              </Button>
            </div>
          </div>
          {schema ? (
            <pre className="min-h-96 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-sm">{schema}</pre>
          ) : (
            <p className="flex min-h-96 items-center justify-center rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              {dict.emptyState}
            </p>
          )}
          {verified !== null && (
            <p className={verified ? "text-sm text-emerald-700 dark:text-emerald-400" : "text-sm text-destructive"}>
              {verified ? dict.verified : dict.verifyFailed}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setInput(SAMPLE)}>
          <FlaskConical className="size-4" />
          {dict.loadSample}
        </Button>
        <ToolActions
          onClear={() => {
            setInput("");
            setFileError(false);
          }}
          clearDisabled={!input}
        />
      </div>
    </div>
  );
}
