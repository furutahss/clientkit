"use client";

import * as React from "react";
import { Download, FileUp, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { downloadBytes } from "@/lib/download";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { SAMPLE_PRISMA_MODEL } from "@/lib/prisma-repo-codegen";
import { parsePrismaSchema } from "@/lib/prisma-schema-parser";
import { generateZodSchemas, type ZodCodegenOptions } from "@/lib/prisma-zod-codegen";
import { formatTemplate } from "@/lib/utils";

const SAMPLE_SCHEMA = `enum Role {
  USER
  ADMIN
}

${SAMPLE_PRISMA_MODEL.replace("  name      String?\n", "  name      String?\n  role      Role     @default(USER)\n")}`;

export function PrismaZodGeneratorTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.prismaZodGenerator;

  const [input, setInput] = React.useState("");
  const [options, setOptions] = React.useState<ZodCodegenOptions>({
    coerceDates: false,
    includeCreateSchema: true,
    exportTypes: true,
  });
  const [fileError, setFileError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const deferredInput = React.useDeferredValue(input);

  const loadFile = React.useCallback(
    (file: File) => {
      setFileError(null);
      file
        .text()
        .then(setInput)
        .catch(() => setFileError(dict.fileReadError));
    },
    [dict]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("prisma-zod-generator");
    if (pending) Promise.resolve().then(() => loadFile(pending));
  }, [loadFile]);

  const parsed = React.useMemo(() => parsePrismaSchema(deferredInput), [deferredInput]);
  const hasDefinitions = parsed.models.length > 0 || parsed.enums.length > 0;

  const result = React.useMemo(
    () => (hasDefinitions ? generateZodSchemas(parsed, options) : null),
    [parsed, options, hasDefinitions]
  );
  const output = result?.code ?? "";

  function updateOption(key: keyof ZodCodegenOptions, value: boolean) {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }

  const OPTION_ITEMS: { key: keyof ZodCodegenOptions; label: string; hint: string }[] = [
    { key: "includeCreateSchema", label: dict.optionCreateSchema, hint: dict.optionCreateSchemaHint },
    { key: "coerceDates", label: dict.optionCoerceDates, hint: dict.optionCoerceDatesHint },
    { key: "exportTypes", label: dict.optionExportTypes, hint: dict.optionExportTypesHint },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="prisma-zod-input" className="text-sm font-medium">
              {dict.inputLabel}
            </label>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setInput(SAMPLE_SCHEMA)}>
                {dict.loadSample}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                <FileUp className="size-4" />
                {dict.openFile}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".prisma,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFile(file);
                e.target.value = "";
              }}
            />
          </div>
          <Textarea
            id="prisma-zod-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const file = e.dataTransfer.files?.[0];
              if (!file) return;
              e.preventDefault();
              loadFile(file);
            }}
            placeholder={dict.placeholder}
            spellCheck={false}
            className="min-h-96 font-mono text-sm"
          />
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          <ToolActions onClear={() => setInput("")} clearDisabled={!input} />
          {deferredInput.trim() && !hasDefinitions && (
            <p className="text-sm text-destructive">{dict.noModelFound}</p>
          )}

          <div className="flex flex-col gap-3 rounded-md border p-3">
            <span className="text-sm font-medium">{dict.optionsHeading}</span>
            {OPTION_ITEMS.map((item) => (
              <div key={item.key} className="flex items-start gap-2">
                <Checkbox
                  id={`prisma-zod-${item.key}`}
                  checked={options[item.key]}
                  onCheckedChange={(checked) => updateOption(item.key, checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor={`prisma-zod-${item.key}`} className="flex flex-col gap-0.5 text-sm">
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.hint}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="prisma-zod-output" className="text-sm font-medium">
              {dict.outputLabel}
            </label>
            {result && (
              <span className="text-xs text-muted-foreground">
                {formatTemplate(dict.summary, {
                  models: parsed.models.length,
                  enums: parsed.enums.length,
                })}
              </span>
            )}
          </div>
          <Textarea
            id="prisma-zod-output"
            value={output}
            readOnly
            placeholder={dict.outputPlaceholder}
            spellCheck={false}
            className="min-h-96 font-mono text-sm"
          />
          {result && result.skippedRelations > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatTemplate(dict.relationFieldsNote, { count: result.skippedRelations })}
            </p>
          )}
          {result && result.unknownTypes.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {formatTemplate(dict.unknownTypesNote, { types: result.unknownTypes.join(", ") })}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <ToolActions getCopyText={() => output} copyDisabled={!output} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!output}
              onClick={() => downloadBytes(new TextEncoder().encode(output), "schemas.ts", "text/plain")}
            >
              <Download className="size-4" />
              {dict.download}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
