"use client";

import * as React from "react";
import { ArrowRight, Key, Search, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import {
  isRelationField,
  parsePrismaSchema,
  type PrismaField,
} from "@/lib/prisma-schema-parser";
import { formatTemplate } from "@/lib/utils";

const SAMPLE_SCHEMA = `model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now())
}

model Profile {
  id     Int    @id @default(autoincrement())
  bio    String?
  userId String @unique
  user   User   @relation(fields: [userId], references: [id])
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  comments  Comment[]
  createdAt DateTime @default(now())
}

model Comment {
  id       Int    @id @default(autoincrement())
  body     String
  postId   Int
  post     Post   @relation(fields: [postId], references: [id])
}

enum Role {
  ADMIN
  USER
}
`;

export function PrismaSchemaVisualizerTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.prismaSchemaVisualizer;

  const [input, setInput] = React.useState("");
  const [search, setSearch] = React.useState("");

  const parsed = React.useMemo(() => parsePrismaSchema(input), [input]);
  const modelNames = React.useMemo(
    () => new Set(parsed.models.map((model) => model.name)),
    [parsed.models]
  );

  const filteredModels = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return parsed.models;
    return parsed.models.filter((model) =>
      model.name.toLowerCase().includes(normalized)
    );
  }, [parsed.models, search]);

  const relations = React.useMemo(() => {
    const list: {
      modelName: string;
      field: PrismaField;
      cardinality: "one" | "many";
    }[] = [];
    for (const model of parsed.models) {
      for (const field of model.fields) {
        if (isRelationField(field, modelNames)) {
          list.push({
            modelName: model.name,
            field,
            cardinality: field.isList ? "many" : "one",
          });
        }
      }
    }
    return list;
  }, [parsed.models, modelNames]);

  function fieldTypeLabel(field: PrismaField): string {
    return `${field.type}${field.isList ? "[]" : ""}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium">{dict.inputLabel}</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setInput(SAMPLE_SCHEMA)}
          >
            {dict.loadSample}
          </Button>
        </div>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={dict.placeholder}
          spellCheck={false}
          className="min-h-56 font-mono text-sm"
          aria-label={dict.inputLabel}
        />
        <ToolActions onClear={() => setInput("")} clearDisabled={!input} />
        {input.trim() && parsed.models.length === 0 && (
          <p className="text-sm text-destructive">{dict.noModelFound}</p>
        )}
      </div>

      {parsed.models.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{dict.searchLabel}</label>
            <div className="relative w-full sm:w-72">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={dict.searchPlaceholder}
                className="pl-9"
                aria-label={dict.searchLabel}
              />
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {dict.modelsHeading} ({filteredModels.length})
            </h2>
            {filteredModels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {dict.noSearchResults}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredModels.map((model) => (
                  <Card key={model.name} className="gap-3 py-4">
                    <CardHeader className="px-4">
                      <CardTitle className="flex items-center justify-between gap-2 text-base">
                        <span className="font-mono">{model.name}</span>
                        <Badge variant="secondary">
                          {formatTemplate(dict.fieldCount, {
                            count: model.fields.length,
                          })}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col divide-y px-4">
                      {model.fields.map((field) => {
                        const relation = isRelationField(field, modelNames);
                        return (
                          <div
                            key={field.name}
                            className="flex flex-wrap items-center gap-1.5 py-1.5 text-sm first:pt-0 last:pb-0"
                          >
                            {field.isId && (
                              <Key
                                className="size-3.5 shrink-0 text-primary"
                                aria-label={dict.idLabel}
                              />
                            )}
                            <span className="font-mono font-medium">
                              {field.name}
                            </span>
                            <span className="font-mono text-muted-foreground">
                              {fieldTypeLabel(field)}
                            </span>
                            {field.isOptional && (
                              <Badge variant="outline" className="px-1.5 py-0">
                                {dict.optionalBadge}
                              </Badge>
                            )}
                            {field.isUnique && (
                              <Badge variant="outline" className="px-1.5 py-0">
                                {dict.uniqueLabel}
                              </Badge>
                            )}
                            {relation && (
                              <span className="ml-auto flex items-center gap-1 text-xs font-medium text-primary">
                                <ArrowRight className="size-3.5" aria-hidden="true" />
                                {formatTemplate(dict.relationTo, {
                                  target: field.type,
                                })}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {parsed.enums.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {dict.enumsHeading} ({parsed.enums.length})
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {parsed.enums.map((item) => (
                  <Card key={item.name} className="gap-3 py-4">
                    <CardHeader className="px-4">
                      <CardTitle className="font-mono text-base">
                        {item.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-1.5 px-4">
                      {item.values.map((value) => (
                        <Badge key={value} variant="outline">
                          {value}
                        </Badge>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {dict.relationsHeading} ({relations.length})
            </h2>
            {relations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {dict.relationsEmpty}
              </p>
            ) : (
              <div className="flex flex-col divide-y rounded-lg border">
                {relations.map((relation, index) => (
                  <div
                    key={`${relation.modelName}.${relation.field.name}-${index}`}
                    className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm"
                  >
                    <span className="font-mono">
                      {relation.modelName}.{relation.field.name}
                    </span>
                    <ArrowRight
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="font-mono font-medium">
                      {relation.field.type}
                    </span>
                    <Badge variant="secondary" className="ml-auto">
                      {relation.cardinality === "many"
                        ? dict.relationMany
                        : dict.relationOne}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
