import {
  isRelationField,
  type ParsedPrismaSchema,
  type PrismaField,
  type PrismaModel,
} from "@/lib/prisma-schema-parser";

export interface ZodCodegenOptions {
  /** DateTimeを z.coerce.date() にして、JSONの日時文字列も受け付ける */
  coerceDates: boolean;
  /** 作成用（@default・@updatedAt・自動採番のフィールドを省略可能にした）スキーマも出力する */
  includeCreateSchema: boolean;
  /** z.infer による型定義もエクスポートする */
  exportTypes: boolean;
}

export interface ZodCodegenResult {
  code: string;
  /** 出力から除外したリレーションフィールドの数 */
  skippedRelations: number;
  /** Zodに対応付けられず z.unknown() にした型名 */
  unknownTypes: string[];
}

function scalarToZod(field: PrismaField, options: ZodCodegenOptions): string | null {
  switch (field.type) {
    case "String": {
      const maxLength = /@db\.(?:VarChar|Char|NVarChar|NChar)\((\d+)\)/.exec(field.raw);
      if (maxLength) return `z.string().max(${maxLength[1]})`;
      if (/@db\.Uuid\b/.test(field.raw)) return "z.string().uuid()";
      return "z.string()";
    }
    case "Int":
      return "z.number().int()";
    case "Float":
      return "z.number()";
    case "Decimal":
      return "z.number()";
    case "BigInt":
      return "z.bigint()";
    case "Boolean":
      return "z.boolean()";
    case "DateTime":
      return options.coerceDates ? "z.coerce.date()" : "z.date()";
    case "Json":
      return "z.unknown()";
    case "Bytes":
      return "z.instanceof(Uint8Array)";
    default:
      return null;
  }
}

/** DBで自動的に値が入るため、作成時に省略できるフィールドか */
function isGeneratedOnCreate(field: PrismaField): boolean {
  return field.hasDefault || field.isUpdatedAt;
}

function fieldExpression(
  field: PrismaField,
  enumNames: Set<string>,
  options: ZodCodegenOptions,
  unknownTypes: Set<string>
): string {
  let expression = scalarToZod(field, options);
  if (!expression) {
    if (enumNames.has(field.type)) {
      expression = `${field.type}Schema`;
    } else {
      unknownTypes.add(field.type);
      expression = "z.unknown()";
    }
  }
  if (field.isList) expression = `z.array(${expression})`;
  if (field.isOptional) expression = `${expression}.nullable()`;
  return expression;
}

function modelObject(
  model: PrismaModel,
  fields: { field: PrismaField; expression: string }[],
  mode: "read" | "create"
): string {
  const lines = fields.map(({ field, expression }) => {
    let value = expression;
    if (mode === "create" && (isGeneratedOnCreate(field) || field.isOptional)) {
      value = `${value}.optional()`;
    }
    return `  ${field.name}: ${value},`;
  });
  return `z.object({\n${lines.join("\n")}\n})`;
}

/**
 * schema.prisma の enum / model から Zod スキーマのコードを生成する。
 * リレーションフィールドは循環参照を避けるため出力しない。
 */
export function generateZodSchemas(
  schema: ParsedPrismaSchema,
  options: ZodCodegenOptions
): ZodCodegenResult {
  const modelNames = new Set(schema.models.map((model) => model.name));
  const enumNames = new Set(schema.enums.map((item) => item.name));
  const unknownTypes = new Set<string>();
  let skippedRelations = 0;

  const blocks: string[] = ['import { z } from "zod";'];

  for (const item of schema.enums) {
    const values = item.values.map((value) => `"${value}"`).join(", ");
    let block = `export const ${item.name}Schema = z.enum([${values}]);`;
    if (options.exportTypes) {
      block += `\nexport type ${item.name} = z.infer<typeof ${item.name}Schema>;`;
    }
    blocks.push(block);
  }

  for (const model of schema.models) {
    const fields = model.fields
      .filter((field) => {
        if (isRelationField(field, modelNames)) {
          skippedRelations += 1;
          return false;
        }
        return true;
      })
      .map((field) => ({
        field,
        expression: fieldExpression(field, enumNames, options, unknownTypes),
      }));

    let block = `export const ${model.name}Schema = ${modelObject(model, fields, "read")};`;
    if (options.exportTypes) {
      block += `\nexport type ${model.name} = z.infer<typeof ${model.name}Schema>;`;
    }
    if (options.includeCreateSchema) {
      block += `\n\nexport const ${model.name}CreateSchema = ${modelObject(model, fields, "create")};`;
      if (options.exportTypes) {
        block += `\nexport type ${model.name}CreateInput = z.infer<typeof ${model.name}CreateSchema>;`;
      }
    }
    blocks.push(block);
  }

  return {
    code: `${blocks.join("\n\n")}\n`,
    skippedRelations,
    unknownTypes: Array.from(unknownTypes),
  };
}
