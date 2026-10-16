import type { ErrorObject } from "ajv";

import { locateJsonError, type JsonErrorLocation } from "@/lib/json-error";

export const SUPPORTED_DIALECT = "https://json-schema.org/draft/2020-12/schema";

type Ajv2020Class = typeof import("ajv/dist/2020").default;

/** Ajv（Draft 2020-12）は大きいため、ツールを開いたときに読み込む */
export function loadAjv2020(): Promise<Ajv2020Class> {
  return import("ajv/dist/2020").then((module) => module.default);
}

export type SchemaViolation = {
  /** データ内のJSON Pointer（ルートは空文字） */
  path: string;
  keyword: string;
  params: Record<string, unknown>;
  schemaPath: string;
  message: string;
};

export type SchemaValidationOutcome =
  | { status: "dataSyntax" | "schemaSyntax"; error: JsonErrorLocation }
  | { status: "schemaType" }
  | { status: "unsupportedDialect"; dialect: string }
  | { status: "unresolvedRef"; ref: string }
  | { status: "invalidSchema"; errors: SchemaViolation[]; message?: string }
  | { status: "valid" }
  | { status: "invalid"; errors: SchemaViolation[] };

function parse(text: string): { value?: unknown; error?: JsonErrorLocation } {
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: locateJsonError(text, error) };
  }
}

function escapePointer(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function toViolation(error: ErrorObject): SchemaViolation {
  // required / additionalProperties は親オブジェクトを指すため、対象のプロパティまで含める
  const property =
    error.keyword === "required"
      ? (error.params as { missingProperty?: string }).missingProperty
      : error.keyword === "additionalProperties"
        ? (error.params as { additionalProperty?: string }).additionalProperty
        : undefined;
  return {
    path: property === undefined ? error.instancePath : `${error.instancePath}/${escapePointer(property)}`,
    keyword: error.keyword,
    params: error.params as Record<string, unknown>,
    schemaPath: error.schemaPath,
    message: error.message ?? error.keyword,
  };
}

/**
 * JSONをJSON Schema（Draft 2020-12）で検証する。
 * 外部の$refは取得せず、未解決の参照として返す。format は仕様どおり注釈として扱い検証しない。
 */
export function validateWithSchema(
  Ajv2020: Ajv2020Class,
  dataText: string,
  schemaText: string
): SchemaValidationOutcome {
  const schema = parse(schemaText);
  if (schema.error) return { status: "schemaSyntax", error: schema.error };
  const data = parse(dataText);
  if (data.error) return { status: "dataSyntax", error: data.error };

  const schemaValue = schema.value;
  if (typeof schemaValue !== "boolean" && (schemaValue === null || typeof schemaValue !== "object" || Array.isArray(schemaValue))) {
    return { status: "schemaType" };
  }
  const dialect = typeof schemaValue === "object" ? (schemaValue as { $schema?: unknown }).$schema : undefined;
  if (dialect !== undefined && dialect !== SUPPORTED_DIALECT && dialect !== `${SUPPORTED_DIALECT}#`) {
    return { status: "unsupportedDialect", dialect: String(dialect) };
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  if (!ajv.validateSchema(schemaValue as object)) {
    return { status: "invalidSchema", errors: (ajv.errors ?? []).map(toViolation) };
  }

  let validate: ReturnType<typeof ajv.compile>;
  try {
    validate = ajv.compile(schemaValue as object);
  } catch (error) {
    const missingRef = (error as { missingRef?: string }).missingRef;
    if (missingRef !== undefined) return { status: "unresolvedRef", ref: missingRef };
    return { status: "invalidSchema", errors: [], message: error instanceof Error ? error.message : String(error) };
  }

  return validate(data.value)
    ? { status: "valid" }
    : { status: "invalid", errors: (validate.errors ?? []).map(toViolation) };
}
