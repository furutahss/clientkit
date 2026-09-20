"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  entityFromPrismaModel,
  entityFromTsInterface,
  generateMockRepositoryCode,
  SAMPLE_TS_INTERFACE,
  type MockEntity,
  type SourceKind,
  type TestFramework,
} from "@/lib/mock-repo-codegen";
import { parsePrismaSchema } from "@/lib/prisma-schema-parser";
import { parseTsInterfaces } from "@/lib/ts-interface-parser";
import { cn } from "@/lib/utils";

type Tab = "data" | "repository" | "test";

export function MockRepoGeneratorTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.mockRepoGenerator;

  const [input, setInput] = React.useState("");
  const [selectedEntity, setSelectedEntity] = React.useState<string | null>(
    null
  );
  const [count, setCount] = React.useState(5);
  const [testFramework, setTestFramework] =
    React.useState<TestFramework>("vitest");
  const [tab, setTab] = React.useState<Tab>("data");

  const TABS: { value: Tab; label: string }[] = [
    { value: "data", label: dict.tabData },
    { value: "repository", label: dict.tabRepository },
    { value: "test", label: dict.tabTest },
  ];

  const { sourceKind, entities } = React.useMemo<{
    sourceKind: SourceKind | null;
    entities: MockEntity[];
  }>(() => {
    if (!input.trim()) return { sourceKind: null, entities: [] };

    if (/model\s+\w+\s*\{/.test(input)) {
      const parsed = parsePrismaSchema(input);
      return {
        sourceKind: "prisma",
        entities: parsed.models.map((model) => entityFromPrismaModel(model)),
      };
    }

    if (/interface\s+\w+\s*\{/.test(input)) {
      const parsed = parseTsInterfaces(input);
      return {
        sourceKind: "typescript",
        entities: parsed.map((iface) => entityFromTsInterface(iface)),
      };
    }

    return { sourceKind: null, entities: [] };
  }, [input]);

  const activeEntity = React.useMemo(() => {
    if (entities.length === 0) return undefined;
    return (
      entities.find((entity) => entity.name === selectedEntity) ?? entities[0]
    );
  }, [entities, selectedEntity]);

  const result = React.useMemo(() => {
    if (!activeEntity || !sourceKind) return null;
    return generateMockRepositoryCode(activeEntity, {
      count: Math.min(20, Math.max(1, count)),
      testFramework,
      sourceKind,
    });
  }, [activeEntity, sourceKind, count, testFramework]);

  const output = React.useMemo(() => {
    if (!result) return "";
    if (tab === "data") return result.dummyDataCode;
    if (tab === "repository") return result.repositoryCode;
    return result.testCode;
  }, [result, tab]);

  const outputFileName = React.useMemo(() => {
    if (!result) return "";
    if (tab === "data") return result.dummyDataFileName;
    if (tab === "repository") return result.repositoryFileName;
    return result.testFileName;
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
              onClick={() => setInput(SAMPLE_TS_INTERFACE)}
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

          {input.trim() && !sourceKind && (
            <p className="text-sm text-destructive">{dict.noEntityFound}</p>
          )}

          {sourceKind && (
            <Badge variant="secondary" className="w-fit">
              {sourceKind === "prisma"
                ? dict.detectedPrisma
                : dict.detectedTypescript}
            </Badge>
          )}

          {entities.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {dict.entitySelectLabel}
              </span>
              <Select
                value={activeEntity?.name}
                onValueChange={(value) => setSelectedEntity(value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((entity) => (
                    <SelectItem key={entity.name} value={entity.name}>
                      {entity.name}
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
                {dict.countLabel}
              </span>
              <Input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) =>
                  setCount(Number(e.target.value) || 1)
                }
                className="w-28"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                {dict.testFrameworkLabel}
              </span>
              <Select
                value={testFramework}
                onValueChange={(value) =>
                  setTestFramework(value as TestFramework)
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vitest">Vitest</SelectItem>
                  <SelectItem value="jest">Jest</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sourceKind === "prisma" && (
              <p className="text-xs text-muted-foreground">
                {dict.relationFieldsNote}
              </p>
            )}
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
            aria-label={outputFileName || dict.tabData}
          />
          <ToolActions getCopyText={() => output} copyDisabled={!output} />
        </div>
      </div>
    </div>
  );
}
