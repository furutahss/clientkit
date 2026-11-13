import type { Json } from "./json-repair";

type Schema = { [k: string]: unknown };
const isObj = (v: unknown): v is Schema => typeof v === "object" && v !== null && !Array.isArray(v);

const FORMATS: Record<string, string> = {
  "date-time": "2026-01-05T09:30:00Z", date: "2026-01-05", time: "09:30:00Z", email: "user@example.com", uri: "https://example.com/path", "uri-reference": "/path", url: "https://example.com",
  uuid: "3f2504e0-4f89-41d3-9a0c-0305e82c3301", ipv4: "192.0.2.1", ipv6: "2001:db8::1", hostname: "example.com", duration: "PT1H", "json-pointer": "/a/b", regex: "^[a-z]+$",
};

function resolveRef(root: Schema, ref: string): Schema | null {
  if (!ref.startsWith("#/")) return null;
  let cur: unknown = root;
  for (const part of ref.slice(2).split("/").map((p) => decodeURIComponent(p).replace(/~1/g, "/").replace(/~0/g, "~"))) {
    if (!isObj(cur) || !(part in cur)) return null;
    cur = cur[part];
  }
  return isObj(cur) ? cur : null;
}

/** JSON Schema（ローカル$ref対応）から、制約を満たすサンプルJSONを生成する。patternは満たせない */
export function sampleFromSchema(schema: unknown, depth = 0, root?: Schema, seen: string[] = []): Json {
  if (schema === true || !isObj(schema)) return null;
  const rootSchema = root ?? schema;
  if (depth > 12) return null;
  let s: Schema = schema;
  if (typeof s.$ref === "string") {
    if (seen.filter((r) => r === s.$ref).length >= 2) return null; // 再帰参照は2回まで
    const target = resolveRef(rootSchema, s.$ref);
    if (!target) return null;
    return sampleFromSchema({ ...target, ...Object.fromEntries(Object.entries(s).filter(([k]) => k !== "$ref")) }, depth + 1, rootSchema, [...seen, s.$ref]);
  }
  if (Array.isArray(s.allOf)) {
    const merged: Schema = { ...s };
    delete merged.allOf;
    for (const part of s.allOf) {
      const p = isObj(part) && typeof part.$ref === "string" ? resolveRef(rootSchema, part.$ref) ?? {} : isObj(part) ? part : {};
      Object.assign(merged, p, { properties: { ...(merged.properties as Schema), ...(p.properties as Schema) }, required: [...((merged.required as string[]) ?? []), ...((p.required as string[]) ?? [])] });
    }
    s = merged;
  }
  for (const k of ["oneOf", "anyOf"] as const) if (Array.isArray(s[k]) && s[k].length) return sampleFromSchema({ ...Object.fromEntries(Object.entries(s).filter(([x]) => x !== k)), ...(s[k] as Schema[])[0] as Schema }, depth + 1, rootSchema, seen);
  if ("const" in s) return s.const as Json;
  if ("default" in s && s.default !== undefined) return s.default as Json;
  if (Array.isArray(s.examples) && s.examples.length) return s.examples[0] as Json;
  if (Array.isArray(s.enum) && s.enum.length) return s.enum[0] as Json;
  const type = Array.isArray(s.type) ? (s.type.find((t) => t !== "null") ?? "null") : s.type ?? (s.properties ? "object" : s.items ? "array" : undefined);
  switch (type) {
    case "string": {
      let v = typeof s.format === "string" && FORMATS[s.format] ? FORMATS[s.format] : "string";
      const min = Number(s.minLength ?? 0), max = Number(s.maxLength ?? Infinity);
      if (v.length < min) v = v.padEnd(min, "x");
      if (v.length > max) v = v.slice(0, max);
      return v;
    }
    case "integer": case "number": {
      const min = typeof s.minimum === "number" ? s.minimum : typeof s.exclusiveMinimum === "number" ? s.exclusiveMinimum + 1 : undefined;
      const max = typeof s.maximum === "number" ? s.maximum : typeof s.exclusiveMaximum === "number" ? s.exclusiveMaximum - 1 : undefined;
      let v = min ?? (max !== undefined ? Math.min(0, max) : type === "integer" ? 1 : 1.5);
      if (type === "integer") v = Math.ceil(v);
      if (typeof s.multipleOf === "number" && s.multipleOf > 0) v = Math.ceil(v / s.multipleOf) * s.multipleOf;
      return max !== undefined && v > max ? max : v;
    }
    case "boolean": return true;
    case "null": return null;
    case "array": {
      const n = Math.max(Number(s.minItems ?? 0), 1);
      const items = Array.isArray(s.prefixItems) ? s.prefixItems : null;
      if (items) return items.map((it) => sampleFromSchema(it, depth + 1, rootSchema, seen));
      return Array.from({ length: Math.min(n, 3) }, () => sampleFromSchema(s.items ?? {}, depth + 1, rootSchema, seen));
    }
    case "object": {
      const out: { [k: string]: Json } = {};
      const props = isObj(s.properties) ? s.properties : {};
      for (const [k, v] of Object.entries(props)) out[k] = sampleFromSchema(v, depth + 1, rootSchema, seen);
      for (const k of (s.required as string[] | undefined) ?? []) if (!(k in out)) out[k] = null;
      return out;
    }
    default: return null;
  }
}
