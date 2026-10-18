"use client";

import * as React from "react";
import { ArrowLeftRight, FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SafetyNote, TextInputPanel } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { useLazyModule } from "@/lib/lazy-module";
import { compareSpecs, loadSpec, type CompatFinding, type SpecLoad } from "@/lib/openapi-compat";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";

const loadYaml = () => import("yaml");

const SAMPLE_BEFORE = `openapi: 3.0.3
info:
  title: Shop API
  version: 1.0.0
paths:
  /users/{id}:
    get:
      parameters:
        - { name: id, in: path, required: true, schema: { type: integer } }
        - { name: fields, in: query, schema: { type: string } }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema: { $ref: "#/components/schemas/User" }
    delete:
      parameters:
        - { name: id, in: path, required: true, schema: { type: integer } }
      responses:
        "204": { description: Deleted }
  /orders:
    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [itemId]
              properties:
                itemId: { type: string }
                quantity: { type: integer }
                coupon: { type: string, nullable: true }
      responses:
        "201": { description: Created }
components:
  schemas:
    User:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        address: { $ref: "https://example.com/schemas/address.yaml" }
`;

const SAMPLE_AFTER = `{
  "openapi": "3.0.3",
  "info": { "version": "2.0.0", "title": "Shop API" },
  "components": {
    "schemas": {
      "User": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "id": { "type": "string" },
          "address": { "$ref": "https://example.com/schemas/address.yaml" }
        }
      }
    }
  },
  "paths": {
    "/orders": {
      "post": {
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["itemId", "quantity"],
                "properties": {
                  "itemId": { "type": "string" },
                  "quantity": { "type": "number" },
                  "coupon": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": { "201": { "description": "Created" } }
      }
    },
    "/users/{userId}": {
      "get": {
        "parameters": [
          { "name": "userId", "in": "path", "required": true, "schema": { "type": "integer" } },
          { "name": "fields", "in": "query", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": { "application/json": { "schema": { "$ref": "#/components/schemas/User" } } }
          }
        }
      }
    }
  }
}`;

type Dict = ReturnType<typeof getDictionary>["tools"]["openapiCompat"];

function loadError(dict: Dict, side: string, load: SpecLoad | null) {
  if (!load || load.status === "ok") return null;
  const message =
    load.status === "syntax"
      ? load.line
        ? formatTemplate(dict.syntaxError, { side, line: load.line, column: load.column ?? 1, message: load.message })
        : `${side}: ${load.message}`
      : load.status === "notObject"
        ? formatTemplate(dict.notObject, { side })
        : formatTemplate(dict.unsupportedVersion, { side, version: load.version || "—" });
  return <p className="text-sm text-destructive">{message}</p>;
}

function findingText(dict: Dict, finding: CompatFinding): string {
  return formatTemplate(dict.reasons[finding.kind], { before: finding.before ?? "", after: finding.after ?? "" });
}

export function OpenapiCompatTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.openapiCompat;
  const { module: yaml, error: libraryError } = useLazyModule(loadYaml);

  const [before, setBefore] = React.useState("");
  const [after, setAfter] = React.useState("");
  const [fileError, setFileError] = React.useState(false);
  const deferredBefore = React.useDeferredValue(before);
  const deferredAfter = React.useDeferredValue(after);

  const ready = deferredBefore.trim() !== "" && deferredAfter.trim() !== "";
  const loads = React.useMemo(
    () => (ready && yaml ? { before: loadSpec(yaml, deferredBefore), after: loadSpec(yaml, deferredAfter) } : null),
    [ready, yaml, deferredBefore, deferredAfter]
  );
  const report = React.useMemo(
    () => (loads?.before.status === "ok" && loads.after.status === "ok" ? compareSpecs(loads.before.doc, loads.after.doc) : null),
    [loads]
  );

  const groups = new Map<string, CompatFinding[]>();
  for (const finding of report?.findings ?? []) {
    const key = `${finding.method} ${finding.path}`.trim();
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  }
  const breaking = report?.findings.filter((f) => f.severity === "breaking").length ?? 0;
  const unchecked = (report?.findings.length ?? 0) - breaking;

  function renderResult() {
    if (!ready) {
      return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{dict.emptyState}</p>;
    }
    if (libraryError) {
      return <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{dict.libraryLoadError}</p>;
    }
    if (!loads) {
      return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{dict.loading}</p>;
    }
    if (!report) {
      return <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{dict.fixInput}</p>;
    }
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          {formatTemplate(dict.summary, { operations: report.checkedOperations, breaking, unchecked })}
        </p>
        {report.findings.length === 0 ? (
          <p className="rounded-lg border border-emerald-500/40 p-4 text-sm text-emerald-700 dark:text-emerald-400">{dict.noFindings}</p>
        ) : (
          [...groups].map(([endpoint, findings]) => (
            <div key={endpoint} className="overflow-x-auto rounded-lg border">
              <p className="bg-muted px-3 py-2 font-mono text-sm font-medium">{endpoint}</p>
              <table className="w-full border-collapse text-left text-sm">
                <tbody>
                  {findings.map((finding, index) => (
                    <tr key={index} className="border-t align-top">
                      <td
                        className={cn(
                          "whitespace-nowrap px-3 py-1.5 font-medium",
                          finding.severity === "breaking" ? "text-destructive" : "text-amber-700 dark:text-amber-400"
                        )}
                      >
                        {dict.severity[finding.severity]}
                      </td>
                      <td className="break-all px-3 py-1.5 font-mono text-xs">{finding.location || "—"}</td>
                      <td className="px-3 py-1.5">
                        <span className="font-medium">{dict.kinds[finding.kind]}</span>
                        <p className="text-xs text-muted-foreground">{findingText(dict, finding)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
        {dict.scopeNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <TextInputPanel
            id="openapi-before"
            label={dict.beforeLabel}
            value={before}
            onChange={setBefore}
            placeholder={"openapi: 3.0.3\npaths: ..."}
            openFileLabel={dict.openFile}
            onFileError={() => setFileError(true)}
            accept=".yaml,.yml,.json,application/json"
            invalid={!!loads && loads.before.status !== "ok"}
          />
          {loadError(dict, dict.beforeLabel, loads?.before ?? null)}
        </div>
        <div className="flex flex-col gap-2">
          <TextInputPanel
            id="openapi-after"
            label={dict.afterLabel}
            value={after}
            onChange={setAfter}
            placeholder={"openapi: 3.0.3\npaths: ..."}
            openFileLabel={dict.openFile}
            onFileError={() => setFileError(true)}
            accept=".yaml,.yml,.json,application/json"
            invalid={!!loads && loads.after.status !== "ok"}
          />
          {loadError(dict, dict.afterLabel, loads?.after ?? null)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setBefore(SAMPLE_BEFORE);
            setAfter(SAMPLE_AFTER);
          }}
        >
          <FlaskConical className="size-4" />
          {dict.loadSample}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setBefore(after);
            setAfter(before);
          }}
          disabled={!before && !after}
        >
          <ArrowLeftRight className="size-4" />
          {dict.swap}
        </Button>
        <ToolActions
          onClear={() => {
            setBefore("");
            setAfter("");
            setFileError(false);
          }}
          clearDisabled={!before && !after}
          getCopyText={() =>
            (report?.findings ?? [])
              .map((f) => `${dict.severity[f.severity]}\t${f.method} ${f.path}\t${f.location}\t${dict.kinds[f.kind]}\t${findingText(dict, f)}`)
              .join("\n")
          }
          copyDisabled={!report || report.findings.length === 0}
        />
      </div>
      {fileError && <p className="text-sm text-destructive">{dict.fileReadError}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{dict.resultHeading}</h2>
        {renderResult()}
      </section>
    </div>
  );
}
