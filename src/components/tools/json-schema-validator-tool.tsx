"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SafetyNote, TextInputPanel } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import {
  loadAjv2020,
  SUPPORTED_DIALECT,
  validateWithSchema,
  type SchemaViolation,
} from "@/lib/json-schema-validate";
import { useLazyModule } from "@/lib/lazy-module";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { formatTemplate } from "@/lib/utils";

const SAMPLE_SCHEMA = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["id", "name", "email", "tags"],
  "properties": {
    "id": { "type": "integer", "minimum": 1 },
    "name": { "type": "string", "minLength": 1, "maxLength": 20 },
    "email": { "type": "string", "pattern": "^[^@\\\\s]+@[^@\\\\s]+$" },
    "role": { "enum": ["admin", "editor", "viewer"] },
    "tags": { "type": "array", "items": { "$ref": "#/$defs/tag" }, "uniqueItems": true },
    "address": {
      "type": "object",
      "required": ["zip"],
      "properties": { "zip": { "type": "string", "pattern": "^[0-9]{3}-[0-9]{4}$" } }
    }
  },
  "additionalProperties": false,
  "$defs": {
    "tag": { "type": "string", "minLength": 2 }
  }
}`;

const SAMPLE_DATA = `{
  "id": 0,
  "name": "Taro",
  "email": "taro.example.com",
  "role": "owner",
  "tags": ["a", "dev"],
  "address": { "zip": "1000001" },
  "age": 20
}`;

type Dict = ReturnType<typeof getDictionary>["tools"]["jsonSchemaValidator"];

function violationMessage(dict: Dict, violation: SchemaViolation): string {
  const template = (dict.keywords as Record<string, string>)[violation.keyword];
  if (!template) return violation.message;
  const params = Object.fromEntries(
    Object.entries(violation.params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.map((item) => JSON.stringify(item)).join(", ") : typeof value === "string" ? value : JSON.stringify(value),
    ])
  );
  return formatTemplate(template, params);
}

function ViolationTable({ dict, errors }: { dict: Dict; errors: SchemaViolation[] }) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded-lg border">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-muted text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{dict.columnPath}</th>
            <th className="px-3 py-2 font-medium">{dict.columnMessage}</th>
            <th className="px-3 py-2 font-medium">{dict.columnSchemaPath}</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((error, index) => (
            <tr key={index} className="border-t align-top">
              <td className="break-all px-3 py-1.5 font-mono">{error.path || dict.rootPath}</td>
              <td className="px-3 py-1.5">{violationMessage(dict, error)}</td>
              <td className="break-all px-3 py-1.5 font-mono text-muted-foreground">{error.schemaPath}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JsonSchemaValidatorTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.jsonSchemaValidator;

  const [data, setData] = React.useState("");
  const [schema, setSchema] = React.useState("");
  const [fileError, setFileError] = React.useState(false);
  const { module: Ajv2020, error: libraryError } = useLazyModule(loadAjv2020);
  const deferredData = React.useDeferredValue(data);
  const deferredSchema = React.useDeferredValue(schema);

  const ready = deferredData.trim() !== "" && deferredSchema.trim() !== "";
  const outcome = React.useMemo(
    () => (ready && Ajv2020 ? validateWithSchema(Ajv2020, deferredData, deferredSchema) : null),
    [ready, Ajv2020, deferredData, deferredSchema]
  );

  function renderOutcome() {
    if (!ready) {
      return (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{dict.emptyState}</p>
      );
    }
    if (libraryError) {
      return <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{dict.libraryLoadError}</p>;
    }
    if (!outcome) {
      return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{dict.loading}</p>;
    }
    const errorBox = (title: string, body?: React.ReactNode) => (
      <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-4 text-sm">
        <p className="font-medium text-destructive">{title}</p>
        {body}
      </div>
    );
    switch (outcome.status) {
      case "valid":
        return (
          <p className="rounded-lg border border-emerald-500/40 p-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {dict.valid}
          </p>
        );
      case "invalid":
        return (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-destructive">
              {formatTemplate(dict.invalid, { count: outcome.errors.length })}
            </p>
            <ViolationTable dict={dict} errors={outcome.errors} />
          </div>
        );
      case "dataSyntax":
      case "schemaSyntax":
        return errorBox(
          outcome.status === "dataSyntax" ? dict.dataSyntaxError : dict.schemaSyntaxError,
          <p className="text-muted-foreground">
            {formatTemplate(dict.syntaxDetail, {
              line: outcome.error.line,
              column: outcome.error.column,
              message: outcome.error.message,
            })}
          </p>
        );
      case "schemaType":
        return errorBox(dict.schemaTypeError);
      case "unsupportedDialect":
        return errorBox(
          dict.unsupportedDialect,
          <p className="break-all font-mono text-muted-foreground">{outcome.dialect}</p>
        );
      case "unresolvedRef":
        return errorBox(dict.unresolvedRef, <p className="break-all font-mono text-muted-foreground">{outcome.ref}</p>);
      case "invalidSchema":
        return errorBox(
          dict.invalidSchema,
          outcome.errors.length > 0 ? (
            <ViolationTable dict={dict} errors={outcome.errors} />
          ) : (
            <p className="break-all font-mono text-muted-foreground">{outcome.message}</p>
          )
        );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>
      <p className="text-sm text-muted-foreground">
        {dict.specNote} <code className="break-all font-mono text-xs">{SUPPORTED_DIALECT}</code>
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TextInputPanel
          id="schema-data"
          label={dict.dataLabel}
          value={data}
          onChange={setData}
          placeholder={dict.dataPlaceholder}
          openFileLabel={dict.openFile}
          onFileError={() => setFileError(true)}
          accept=".json,application/json"
        />
        <TextInputPanel
          id="schema-schema"
          label={dict.schemaLabel}
          value={schema}
          onChange={setSchema}
          placeholder={dict.schemaPlaceholder}
          openFileLabel={dict.openFile}
          onFileError={() => setFileError(true)}
          accept=".json,application/json"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setData(SAMPLE_DATA);
            setSchema(SAMPLE_SCHEMA);
          }}
        >
          <FlaskConical className="size-4" />
          {dict.loadSample}
        </Button>
        <ToolActions
          onClear={() => {
            setData("");
            setSchema("");
            setFileError(false);
          }}
          clearDisabled={!data && !schema}
        />
      </div>
      {fileError && <p className="text-sm text-destructive">{dict.fileReadError}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{dict.resultHeading}</h2>
        {renderOutcome()}
      </section>
    </div>
  );
}
