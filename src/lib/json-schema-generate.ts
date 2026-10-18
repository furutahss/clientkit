/**
 * サンプルJSONから JSON Schema（Draft 2020-12）のたたき台を生成する。
 * サンプルだけでは確定できない required・enum・format・additionalProperties などは付加しない。
 */
import { SUPPORTED_DIALECT } from "@/lib/json-schema-validate";

type Schema = Record<string, unknown>;

/** 同じ位置にある値（配列の全要素、各オブジェクトの同名プロパティ）をまとめて1つのSchemaにする */
function schemaFor(values: unknown[]): Schema {
  const types = new Set<string>();
  const objects: Record<string, unknown>[] = [];
  const arrays: unknown[][] = [];
  for (const value of values) {
    if (value === null) types.add("null");
    else if (Array.isArray(value)) arrays.push(value);
    else if (typeof value === "object") objects.push(value as Record<string, unknown>);
    else if (typeof value === "number") types.add(Number.isInteger(value) ? "integer" : "number");
    else types.add(typeof value);
  }
  // 整数と小数が混在する場合は number（integer を含む）にまとめる
  if (types.has("number")) types.delete("integer");

  const parts: Schema[] = [];
  if (objects.length > 0) {
    const keys = [...new Set(objects.flatMap((object) => Object.keys(object)))];
    // fromEntries は "__proto__" も通常のキーとして扱う
    const properties = Object.fromEntries(
      keys.map((key) => [key, schemaFor(objects.filter((o) => Object.hasOwn(o, key)).map((o) => o[key]))])
    );
    parts.push(keys.length > 0 ? { type: "object", properties } : { type: "object" });
  }
  if (arrays.length > 0) {
    const items = arrays.flat();
    parts.push(items.length > 0 ? { type: "array", items: schemaFor(items) } : { type: "array" });
  }

  const simple = ["string", "integer", "number", "boolean", "null"].filter((type) => types.has(type));
  if (parts.length === 0) return { type: simple.length === 1 ? simple[0] : simple };
  if (simple.length === 0 && parts.length === 1) return parts[0];
  return { anyOf: [...parts, ...(simple.length > 0 ? [{ type: simple.length === 1 ? simple[0] : simple }] : [])] };
}

export function generateJsonSchema(sample: unknown): Schema {
  return { $schema: SUPPORTED_DIALECT, ...schemaFor([sample]) };
}
