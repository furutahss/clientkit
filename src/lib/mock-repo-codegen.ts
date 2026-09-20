import {
  findIdField,
  isRelationField,
  prismaScalarToTs,
  toKebabCase,
  type PrismaModel,
} from "@/lib/prisma-schema-parser";
import type { TsInterface } from "@/lib/ts-interface-parser";

export type TestFramework = "vitest" | "jest";
export type SourceKind = "prisma" | "typescript";

export interface MockField {
  name: string;
  /** TypeScriptの型テキスト（例: "string", "number[]", "\"a\" | \"b\"") */
  type: string;
  optional: boolean;
}

export interface MockEntity {
  name: string;
  fields: MockField[];
  idFieldName: string;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Prismaのmodel定義からリレーションフィールドを除いたモックエンティティを作る */
export function entityFromPrismaModel(model: PrismaModel): MockEntity {
  const modelNames = new Set([model.name]);
  const fields: MockField[] = model.fields
    .filter((field) => !isRelationField(field, modelNames))
    .map((field) => ({
      name: field.name,
      type: `${prismaScalarToTs(field.type)}${field.isList ? "[]" : ""}`,
      optional: field.isOptional,
    }));

  const idField = findIdField(model);
  return {
    name: model.name,
    fields,
    idFieldName: idField?.name ?? "id",
  };
}

/** TypeScriptのinterface定義からモックエンティティを作る */
export function entityFromTsInterface(iface: TsInterface): MockEntity {
  const fields: MockField[] = iface.fields.map((field) => ({
    name: field.name,
    type: field.type,
    optional: field.optional,
  }));

  const idField =
    fields.find((field) => field.name.toLowerCase() === "id") ?? fields[0];

  return {
    name: iface.name,
    fields,
    idFieldName: idField?.name ?? "id",
  };
}

function baseType(type: string): { base: string; isArray: boolean } {
  const trimmed = type.trim();
  const arrayMatch = /^Array<(.+)>$/.exec(trimmed);
  if (arrayMatch) return { base: arrayMatch[1].trim(), isArray: true };
  if (trimmed.endsWith("[]")) {
    return { base: trimmed.slice(0, -2).trim(), isArray: true };
  }
  return { base: trimmed, isArray: false };
}

function parseStringLiteralUnion(type: string): string[] | null {
  const trimmed = type.trim();
  if (!/^"[^"]*"(\s*\|\s*"[^"]*")*$/.test(trimmed)) return null;
  return trimmed.split("|").map((part) => part.trim().slice(1, -1));
}

/** 型名とフィールド名からそれらしいダミー値を生成する */
function generateScalarValue(
  type: string,
  fieldName: string,
  index: number
): unknown {
  const lowerName = fieldName.toLowerCase();
  const lowerType = type.trim().toLowerCase();

  if (lowerType === "date" || lowerName.endsWith("at") || lowerName.includes("date")) {
    if (lowerType === "date" || lowerType === "string" || lowerType === "") {
      const date = new Date(2024, 0, 1 + index);
      return date.toISOString();
    }
  }

  switch (lowerType) {
    case "string": {
      if (lowerName.includes("email")) return `user${index + 1}@example.com`;
      if (lowerName === "id") return `id-${index + 1}`;
      if (lowerName.endsWith("id")) return `related-id-${index + 1}`;
      if (lowerName.includes("url")) return `https://example.com/${index + 1}`;
      if (lowerName.includes("phone")) {
        return `090-0000-${String(index + 1).padStart(4, "0")}`;
      }
      if (lowerName.includes("name")) return `Sample Name ${index + 1}`;
      return `${fieldName}-${index + 1}`;
    }
    case "number":
    case "bigint": {
      if (lowerName === "id") return index + 1;
      if (lowerName.includes("price") || lowerName.includes("amount")) {
        return (index + 1) * 1000;
      }
      return index + 1;
    }
    case "boolean":
      return index % 2 === 0;
    case "date":
      return new Date(2024, 0, 1 + index).toISOString();
    default:
      return null;
  }
}

function generateFieldValue(field: MockField, index: number): unknown {
  const { base, isArray } = baseType(field.type);

  if (isArray) {
    const length = 2;
    return Array.from({ length }, (_, itemIndex) =>
      generateFieldValue({ ...field, type: base }, index + itemIndex)
    );
  }

  const literals = parseStringLiteralUnion(base);
  if (literals && literals.length > 0) {
    return literals[index % literals.length];
  }

  return generateScalarValue(base, field.name, index);
}

/** エンティティ定義からダミーデータの配列を生成する */
export function generateMockData(
  entity: MockEntity,
  count: number
): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => {
    const item: Record<string, unknown> = {};
    for (const field of entity.fields) {
      item[field.name] = generateFieldValue(field, index);
    }
    return item;
  });
}

function stringifyTsValue(value: unknown, indentLevel: number): string {
  const pad = "  ".repeat(indentLevel);
  const childPad = "  ".repeat(indentLevel + 1);

  if (value === null || value === undefined) return "null";

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map(
      (item) => `${childPad}${stringifyTsValue(item, indentLevel + 1)}`
    );
    return `[\n${items.join(",\n")}\n${pad}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    const lines = entries.map(([key, val]) => {
      const safeKey = IDENTIFIER.test(key) ? key : JSON.stringify(key);
      return `${childPad}${safeKey}: ${stringifyTsValue(val, indentLevel + 1)}`;
    });
    return `{\n${lines.join(",\n")}\n${pad}}`;
  }

  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

function idFieldType(entity: MockEntity): "string" | "number" {
  const field = entity.fields.find((f) => f.name === entity.idFieldName);
  const { base } = baseType(field?.type ?? "string");
  return base.trim().toLowerCase() === "number" ? "number" : "string";
}

export interface MockCodegenOptions {
  count: number;
  testFramework: TestFramework;
  sourceKind: SourceKind;
}

export interface MockCodegenResult {
  entityName: string;
  dummyDataFileName: string;
  dummyDataCode: string;
  repositoryFileName: string;
  repositoryCode: string;
  testFileName: string;
  testCode: string;
}

/**
 * パース済みエンティティから、ダミーデータ・MockRepositoryクラス・テストコードの
 * 3点セットを生成する。
 */
export function generateMockRepositoryCode(
  entity: MockEntity,
  options: MockCodegenOptions
): MockCodegenResult {
  const { count, testFramework, sourceKind } = options;
  const entityName = entity.name;
  const instanceName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
  const resourcePath = `${toKebabCase(entityName)}s`;
  const repositoryClassName = `Mock${entityName}Repository`;
  const idName = entity.idFieldName;
  const idType = idFieldType(entity);

  const data = generateMockData(entity, Math.max(1, count));
  const dummyDataCode = JSON.stringify(data, null, 2);

  const typeImport =
    sourceKind === "prisma"
      ? `import type { ${entityName} } from "@prisma/client";`
      : `import type { ${entityName} } from "./types";`;

  const generateIdExpression =
    idType === "number"
      ? "this.items.length + 1"
      : `\`id-\${this.items.length + 1}\``;

  const repositoryCode = `${typeImport}

/**
 * DBに接続せず、メモリ内の配列でCRUDを模倣するモックRepository。
 * テストや開発時のスタブ実装として利用できる。
 */
export class ${repositoryClassName} {
  private items: ${entityName}[] = ${stringifyTsValue(data, 1)} as ${entityName}[];

  async findUnique(${idName}: ${idType}): Promise<${entityName} | null> {
    return this.items.find((item) => item.${idName} === ${idName}) ?? null;
  }

  async findMany(): Promise<${entityName}[]> {
    return [...this.items];
  }

  async create(data: Omit<${entityName}, "${idName}">): Promise<${entityName}> {
    const created = { ...data, ${idName}: ${generateIdExpression} } as ${entityName};
    this.items.push(created);
    return created;
  }

  async update(${idName}: ${idType}, data: Partial<${entityName}>): Promise<${entityName}> {
    const index = this.items.findIndex((item) => item.${idName} === ${idName});
    if (index === -1) {
      throw new Error("${entityName} not found");
    }
    this.items[index] = { ...this.items[index], ...data };
    return this.items[index];
  }

  async delete(${idName}: ${idType}): Promise<void> {
    this.items = this.items.filter((item) => item.${idName} !== ${idName});
  }
}
`;

  const samplePayload = { ...data[0] };
  delete samplePayload[idName];

  const testImports =
    testFramework === "vitest"
      ? `import { describe, it, expect, beforeEach } from "vitest";`
      : `import { describe, it, expect, beforeEach } from "@jest/globals";`;

  const testCode = `${testImports}
import request from "supertest";
import express from "express";

import { ${repositoryClassName} } from "./${repositoryClassName}";
import { create${entityName}Router } from "./${instanceName}.controller";

// create${entityName}Router(repository) はRepositoryを引数に取り、
// Expressのルーターを返すファクトリ関数を想定しています（依存性注入パターン）。
describe("${entityName} controller", () => {
  let app: express.Express;
  let repository: ${repositoryClassName};

  beforeEach(() => {
    repository = new ${repositoryClassName}();
    app = express();
    app.use(express.json());
    app.use("/${resourcePath}", create${entityName}Router(repository));
  });

  it("GET /${resourcePath} は一覧を返す", async () => {
    const res = await request(app).get("/${resourcePath}");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /${resourcePath}/:${idName} は存在しないIDに対して404を返す", async () => {
    const res = await request(app).get("/${resourcePath}/not-exist");
    expect(res.status).toBe(404);
  });

  it("POST /${resourcePath} は新しい${entityName}を作成する", async () => {
    const res = await request(app)
      .post("/${resourcePath}")
      .send(${stringifyTsValue(samplePayload, 3)});

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("${idName}");
  });
});
`;

  return {
    entityName,
    dummyDataFileName: `${instanceName}.mock-data.json`,
    dummyDataCode,
    repositoryFileName: `${repositoryClassName}.ts`,
    repositoryCode,
    testFileName: `${instanceName}.controller.test.ts`,
    testCode,
  };
}

export const SAMPLE_TS_INTERFACE = `interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  isActive: boolean;
  createdAt: Date;
}
`;
