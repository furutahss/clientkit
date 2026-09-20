"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { parsePrismaSchema } from "@/lib/prisma-schema-parser";
import {
  SAMPLE_PRISMA_MODEL,
  generateRepositoryCode,
  type NamingStyle,
} from "@/lib/prisma-repo-codegen";
import { cn } from "@/lib/utils";

type Tab = "interface" | "implementation" | "controller";

export function PrismaRepoGeneratorTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.prismaRepoGenerator;

  const [input, setInput] = React.useState("");
  const [selectedModel, setSelectedModel] = React.useState<string | null>(null);
  const [namingStyle, setNamingStyle] = React.useState<NamingStyle>("prefix-i");
  const [useAsyncAwait, setUseAsyncAwait] = React.useState(true);
  const [includeReturnTypes, setIncludeReturnTypes] = React.useState(true);
  const [tab, setTab] = React.useState<Tab>("interface");

  const TABS: { value: Tab; label: string }[] = [
    { value: "interface", label: dict.tabInterface },
    { value: "implementation", label: dict.tabImplementation },
    { value: "controller", label: dict.tabController },
  ];

  const parsed = React.useMemo(() => parsePrismaSchema(input), [input]);
  const models = parsed.models;

  const activeModel = React.useMemo(() => {
    if (models.length === 0) return undefined;
    return models.find((model) => model.name === selectedModel) ?? models[0];
  }, [models, selectedModel]);

  const result = React.useMemo(() => {
    if (!activeModel) return null;
    return generateRepositoryCode(activeModel, {
      namingStyle,
      useAsyncAwait,
      includeReturnTypes,
    });
  }, [activeModel, namingStyle, useAsyncAwait, includeReturnTypes]);

  const output = React.useMemo(() => {
    if (!result) return "";
    if (tab === "interface") return result.interfaceCode;
    if (tab === "implementation") return result.implementationCode;
    return result.controllerCode;
  }, [result, tab]);

  const outputFileName = React.useMemo(() => {
    if (!result) return "";
    if (tab === "interface") return result.interfaceFileName;
    if (tab === "implementation") return result.implementationFileName;
    return result.controllerFileName;
  }, [result, tab]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium">{dict.inputLabel}</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInput(SAMPLE_PRISMA_MODEL)}
            >
              {dict.loadSample}
            </Button>
          </div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={dict.placeholder}
            spellCheck={false}
            className="min-h-96 font-mono text-sm"
            aria-label={dict.inputLabel}
          />
          <ToolActions onClear={() => setInput("")} clearDisabled={!input} />

          {input.trim() && models.length === 0 && (
            <p className="text-sm text-destructive">{dict.noModelFound}</p>
          )}

          {models.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {dict.modelSelectLabel}
              </span>
              <Select
                value={activeModel?.name}
                onValueChange={(value) => setSelectedModel(value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.name} value={model.name}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-md border p-3">
            <span className="text-sm font-medium">{dict.optionsHeading}</span>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                {dict.namingStyleLabel}
              </span>
              <Select
                value={namingStyle}
                onValueChange={(value) => setNamingStyle(value as NamingStyle)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prefix-i">
                    {dict.namingStylePrefixI}
                  </SelectItem>
                  <SelectItem value="suffix-interface">
                    {dict.namingStyleSuffixInterface}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={useAsyncAwait}
                onCheckedChange={(checked) => setUseAsyncAwait(checked === true)}
              />
              {dict.asyncAwaitLabel}
            </label>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeReturnTypes}
                onCheckedChange={(checked) =>
                  setIncludeReturnTypes(checked === true)
                }
              />
              {dict.returnTypesLabel}
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit flex-wrap rounded-md border p-1">
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === item.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {outputFileName && (
            <p className="font-mono text-xs text-muted-foreground">
              {dict.fileNamePrefix}
              {outputFileName}
            </p>
          )}

          <Textarea
            value={output}
            readOnly
            placeholder={dict.outputPlaceholder}
            spellCheck={false}
            className="min-h-96 font-mono text-sm"
            aria-label={outputFileName || dict.tabInterface}
          />
          <ToolActions getCopyText={() => output} copyDisabled={!output} />
        </div>
      </div>
    </div>
  );
}
