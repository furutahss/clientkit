/** schema.prisma の型としてよく使われるスカラー型 */
export const PRISMA_SCALAR_TYPES = new Set([
  "String",
  "Int",
  "Float",
  "Boolean",
  "DateTime",
  "Json",
  "Bytes",
  "Decimal",
  "BigInt",
]);

export interface PrismaField {
  name: string;
  /** 配列・オプショナル記号を除いた型名（例: "String", "Post", "Role"） */
  type: string;
  isList: boolean;
  isOptional: boolean;
  isId: boolean;
  isUnique: boolean;
  isUpdatedAt: boolean;
  hasDefault: boolean;
  defaultValue?: string;
  relationName?: string;
  relationFields?: string[];
  relationReferences?: string[];
  /** フィールド定義の元の1行 */
  raw: string;
}

export interface PrismaModel {
  name: string;
  fields: PrismaField[];
  /** @@map("...") で指定されたテーブル名 */
  dbName?: string;
  /** @@id([...]) による複合主キー */
  compositeId?: string[];
}

export interface PrismaEnum {
  name: string;
  values: string[];
}

export interface ParsedPrismaSchema {
  models: PrismaModel[];
  enums: PrismaEnum[];
}

/** コメント（// 以降）を各行から取り除く */
function stripLineComments(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      const index = line.indexOf("//");
      return index === -1 ? line : line.slice(0, index);
    })
    .join("\n");
}

/** `@attr` または `@attr(...)` 形式の属性を1行から抽出する */
function extractAttributes(text: string): { name: string; args: string }[] {
  const attributes: { name: string; args: string }[] = [];
  const regex = /@(\w+)(\(((?:[^()]|\([^()]*\))*)\))?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    attributes.push({ name: match[1], args: match[3] ?? "" });
  }
  return attributes;
}

function parseStringList(args: string, key: string): string[] | undefined {
  const match = new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`).exec(args);
  if (!match) return undefined;
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseQuotedValue(args: string, key: string): string | undefined {
  const match = new RegExp(`${key}\\s*:\\s*"([^"]*)"`).exec(args);
  return match?.[1];
}

function parseField(line: string): PrismaField | null {
  const fieldMatch = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(line.trim());
  if (!fieldMatch) return null;

  const [, name, type, listMark, optionalMark, rest] = fieldMatch;
  const attributes = extractAttributes(rest);

  const field: PrismaField = {
    name,
    type,
    isList: Boolean(listMark),
    isOptional: Boolean(optionalMark),
    isId: false,
    isUnique: false,
    isUpdatedAt: false,
    hasDefault: false,
    raw: line.trim(),
  };

  for (const attribute of attributes) {
    switch (attribute.name) {
      case "id":
        field.isId = true;
        break;
      case "unique":
        field.isUnique = true;
        break;
      case "updatedAt":
        field.isUpdatedAt = true;
        break;
      case "default":
        field.hasDefault = true;
        field.defaultValue = attribute.args.trim();
        break;
      case "relation":
        field.relationName = parseQuotedValue(attribute.args, "name");
        field.relationFields = parseStringList(attribute.args, "fields");
        field.relationReferences = parseStringList(attribute.args, "references");
        break;
      default:
        break;
    }
  }

  return field;
}

/** model本体（波括弧の中身）を解析する */
function parseModelBody(name: string, body: string): PrismaModel {
  const model: PrismaModel = { name, fields: [] };

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("@@")) {
      const attributes = extractAttributes(line);
      for (const attribute of attributes) {
        if (attribute.name === "map") {
          model.dbName = parseQuotedValue(`name:${attribute.args}`, "name");
        }
        if (attribute.name === "id") {
          const idsMatch = /\[([^\]]*)\]/.exec(attribute.args);
          if (idsMatch) {
            model.compositeId = idsMatch[1]
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean);
          }
        }
      }
      continue;
    }

    const field = parseField(line);
    if (field) model.fields.push(field);
  }

  return model;
}

/** schema.prisma のテキストから model / enum を抽出する */
export function parsePrismaSchema(source: string): ParsedPrismaSchema {
  const cleaned = stripLineComments(source);
  const models: PrismaModel[] = [];
  const enums: PrismaEnum[] = [];

  const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(cleaned)) !== null) {
    models.push(parseModelBody(match[1], match[2]));
  }

  const enumRegex = /enum\s+(\w+)\s*\{([^}]*)\}/g;
  while ((match = enumRegex.exec(cleaned)) !== null) {
    const values = match[2]
      .split("\n")
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((value) => value && !value.startsWith("@"));
    enums.push({ name: match[1], values });
  }

  return { models, enums };
}

/** Prismaのスカラー型をTypeScriptの型名に変換する */
export function prismaScalarToTs(type: string): string {
  switch (type) {
    case "String":
      return "string";
    case "Int":
    case "Float":
    case "Decimal":
      return "number";
    case "BigInt":
      return "bigint";
    case "Boolean":
      return "boolean";
    case "DateTime":
      return "Date";
    case "Json":
      return "Prisma.JsonValue";
    case "Bytes":
      return "Buffer";
    default:
      return type;
  }
}

/** フィールドがリレーション（他モデルへの参照）かどうかを判定する */
export function isRelationField(
  field: PrismaField,
  modelNames: Set<string>
): boolean {
  if (field.relationFields || field.relationName) return true;
  return modelNames.has(field.type) && !PRISMA_SCALAR_TYPES.has(field.type);
}

/** モデルの主キーとして扱うフィールドを取得する（@id優先、なければ"id"、なければ先頭フィールド） */
export function findIdField(model: PrismaModel): PrismaField | undefined {
  return (
    model.fields.find((field) => field.isId) ??
    model.fields.find((field) => field.name === "id") ??
    model.fields[0]
  );
}

export function lowerFirst(value: string): string {
  return value.length ? value[0].toLowerCase() + value.slice(1) : value;
}

export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}
