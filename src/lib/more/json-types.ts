import { CASES, singularize } from "./text-case";

/** JSONの値から型を推論し、Go / Rust / Python / Kotlin / Swift / Zod / C# / Java のコードを生成する */
export type Lang = "go" | "rust" | "pydantic" | "kotlin" | "swift" | "zod" | "csharp" | "java";

type Ty = { k: "string" } | { k: "int" } | { k: "float" } | { k: "bool" } | { k: "any" } | { k: "obj"; name: string } | { k: "arr"; of: Ty };
type Field = { key: string; ty: Ty; optional: boolean; nullable: boolean };
type Struct = { name: string; fields: Field[] };

type Shape = { kinds: Set<string>; fields: Map<string, { shape: Shape; count: number; nullSeen: boolean }>; items?: Shape; objects: number; nullSeen: boolean };
const newShape = (): Shape => ({ kinds: new Set(), fields: new Map(), objects: 0, nullSeen: false });

function observe(shape: Shape, v: unknown): void {
  if (v === null) { shape.nullSeen = true; return; }
  if (Array.isArray(v)) { shape.kinds.add("arr"); shape.items ??= newShape(); for (const x of v) observe(shape.items, x); return; }
  if (typeof v === "object") {
    shape.kinds.add("obj"); shape.objects++;
    for (const [k, x] of Object.entries(v as object)) {
      const f = shape.fields.get(k) ?? { shape: newShape(), count: 0, nullSeen: false };
      f.count++;
      if (x === null) f.nullSeen = true;
      observe(f.shape, x);
      shape.fields.set(k, f);
    }
    return;
  }
  shape.kinds.add(typeof v === "number" ? (Number.isInteger(v) ? "int" : "float") : typeof v === "boolean" ? "bool" : "string");
}

function build(shape: Shape, name: string, structs: Struct[]): Ty {
  const k = shape.kinds;
  if (k.size === 0) return { k: "any" };
  if (k.size > 1) {
    if (k.size === 2 && k.has("int") && k.has("float")) return { k: "float" };
    return { k: "any" };
  }
  const only = [...k][0];
  if (only === "arr") {
    const single = singularize(name);
    return { k: "arr", of: shape.items ? build(shape.items, single === name ? `${name}Item` : single, structs) : { k: "any" } };
  }
  if (only === "obj") {
    const fields: Field[] = [];
    const struct: Struct = { name: uniqueName(CASES.pascal(name) || "Root", structs), fields };
    structs.push(struct);
    for (const [key, f] of shape.fields) fields.push({ key, ty: build(f.shape, key, structs), optional: f.count < shape.objects, nullable: f.nullSeen });
    return { k: "obj", name: struct.name };
  }
  return { k: only as "string" | "int" | "float" | "bool" };
}

function uniqueName(base: string, structs: Struct[]): string {
  let n = base, i = 2;
  while (structs.some((s) => s.name === n)) n = `${base}${i++}`;
  return n;
}

export function inferStructs(json: unknown, rootName = "Root"): { root: Ty; structs: Struct[] } {
  const shape = newShape();
  observe(shape, json);
  const structs: Struct[] = [];
  const root = build(shape, rootName, structs);
  return { root, structs: structs.reverse() };
}

const RESERVED: Record<Lang, string[]> = {
  go: ["type", "func", "var", "range", "map", "chan", "go", "select", "package", "import", "interface", "struct", "default", "return"],
  rust: ["type", "match", "ref", "self", "struct", "enum", "fn", "let", "mod", "use", "impl", "trait", "where", "loop", "move", "box", "in", "as", "if", "else", "for", "while", "pub", "mut", "const", "static", "crate", "super", "dyn", "async", "await", "return"],
  pydantic: ["class", "def", "from", "import", "global", "lambda", "pass", "return", "in", "is", "not", "or", "and", "if", "else", "for", "while", "with", "yield", "None", "True", "False", "del", "try", "except", "raise", "assert", "async", "await", "type"],
  kotlin: ["class", "fun", "val", "var", "in", "is", "object", "when", "typealias", "interface", "package", "return", "as", "if", "else", "for", "while", "null", "true", "false", "this", "super", "throw", "try"],
  swift: ["class", "func", "let", "var", "in", "is", "init", "self", "Type", "protocol", "extension", "return", "if", "else", "for", "while", "default", "switch", "case", "import", "operator", "internal", "private", "public", "static", "struct", "enum", "nil", "true", "false", "as", "try", "throw"],
  zod: [],
  csharp: ["class", "string", "int", "object", "namespace", "event", "public", "private", "params", "ref", "out", "in", "is", "as", "base", "this", "default", "new", "operator", "return", "lock", "checked", "fixed", "internal", "static", "void", "virtual", "volatile"],
  java: ["class", "int", "new", "package", "default", "return", "this", "super", "static", "final", "void", "public", "private", "protected", "import", "interface", "enum", "switch", "case", "do", "if", "else", "for", "while", "try", "catch", "throw", "throws", "native", "abstract", "boolean", "byte", "char", "double", "float", "long", "short", "null", "true", "false"],
};
const safeIdent = (name: string, lang: Lang) => { const id = /^\d/.test(name) ? `_${name}` : name || "_"; return RESERVED[lang].includes(id) ? (lang === "rust" ? `r#${id}` : lang === "kotlin" || lang === "swift" ? `\`${id}\`` : `${id}_`) : id; };
const goName = (k: string) => CASES.pascal(k).replace(/Id\b/g, "ID").replace(/Url\b/g, "URL").replace(/Api\b/g, "API").replace(/Http/g, "HTTP") || "Field";

export function generateTypes(json: unknown, lang: Lang, rootName = "Root"): string {
  const { root, structs } = inferStructs(json, rootName);
  const refName = root.k === "obj" ? root.name : rootName;
  const out: string[] = [];
  const wrapRoot = root.k !== "obj";

  const tyStr = (t: Ty, nullable: boolean): string => {
    const base = (() => {
      switch (lang) {
        case "go": return t.k === "string" ? "string" : t.k === "int" ? "int64" : t.k === "float" ? "float64" : t.k === "bool" ? "bool" : t.k === "any" ? "any" : t.k === "obj" ? t.name : `[]${tyStr(t.of, false)}`;
        case "rust": return t.k === "string" ? "String" : t.k === "int" ? "i64" : t.k === "float" ? "f64" : t.k === "bool" ? "bool" : t.k === "any" ? "serde_json::Value" : t.k === "obj" ? t.name : `Vec<${tyStr(t.of, false)}>`;
        case "pydantic": return t.k === "string" ? "str" : t.k === "int" ? "int" : t.k === "float" ? "float" : t.k === "bool" ? "bool" : t.k === "any" ? "Any" : t.k === "obj" ? t.name : `List[${tyStr(t.of, false)}]`;
        case "kotlin": return t.k === "string" ? "String" : t.k === "int" ? "Long" : t.k === "float" ? "Double" : t.k === "bool" ? "Boolean" : t.k === "any" ? "JsonElement" : t.k === "obj" ? t.name : `List<${tyStr(t.of, false)}>`;
        case "swift": return t.k === "string" ? "String" : t.k === "int" ? "Int" : t.k === "float" ? "Double" : t.k === "bool" ? "Bool" : t.k === "any" ? "AnyCodable" : t.k === "obj" ? t.name : `[${tyStr(t.of, false)}]`;
        case "zod": return t.k === "string" ? "z.string()" : t.k === "int" ? "z.number().int()" : t.k === "float" ? "z.number()" : t.k === "bool" ? "z.boolean()" : t.k === "any" ? "z.unknown()" : t.k === "obj" ? `${t.name}Schema` : `z.array(${tyStr(t.of, false)})`;
        case "csharp": return t.k === "string" ? "string" : t.k === "int" ? "long" : t.k === "float" ? "double" : t.k === "bool" ? "bool" : t.k === "any" ? "JsonElement" : t.k === "obj" ? t.name : `List<${tyStr(t.of, false)}>`;
        case "java": return t.k === "string" ? "String" : t.k === "int" ? "Long" : t.k === "float" ? "Double" : t.k === "bool" ? "Boolean" : t.k === "any" ? "Object" : t.k === "obj" ? t.name : `List<${tyStr(t.of, false)}>`;
      }
    })();
    if (!nullable) return base;
    switch (lang) {
      case "go": return t.k === "arr" || t.k === "any" ? base : `*${base}`;
      case "rust": return `Option<${base}>`;
      case "pydantic": return `Optional[${base}]`;
      case "kotlin": return t.k === "any" ? base : `${base}?`;
      case "swift": return t.k === "any" ? base : `${base}?`;
      case "zod": return `${base}.nullable()`;
      case "csharp": return `${base}?`;
      case "java": return base;
    }
  };

  const header: Record<Lang, string> = {
    go: "",
    rust: "use serde::{Deserialize, Serialize};\n",
    pydantic: "from typing import Any, List, Optional\n\nfrom pydantic import BaseModel, Field\n",
    kotlin: "import kotlinx.serialization.SerialName\nimport kotlinx.serialization.Serializable\nimport kotlinx.serialization.json.JsonElement\n",
    swift: "import Foundation\n",
    zod: 'import { z } from "zod";\n',
    csharp: "using System.Collections.Generic;\nusing System.Text.Json;\nusing System.Text.Json.Serialization;\n",
    java: "import com.fasterxml.jackson.annotation.JsonProperty;\nimport java.util.List;\n",
  };
  if (header[lang]) out.push(header[lang]);

  for (const s of structs) {
    const fields = s.fields.map((f) => ({ ...f, opt: f.optional || f.nullable }));
    switch (lang) {
      case "go":
        out.push(`type ${s.name} struct {\n${fields.map((f) => `\t${goName(f.key)} ${tyStr(f.ty, f.opt)} \`json:"${f.key}${f.optional ? ",omitempty" : ""}"\``).join("\n")}\n}\n`);
        break;
      case "rust":
        out.push(`#[derive(Debug, Serialize, Deserialize)]\npub struct ${s.name} {\n${fields.map((f) => { const id = CASES.snake(f.key) || "field"; const safe = safeIdent(id, "rust"); const need = id !== f.key || safe !== id; return `${need ? `    #[serde(rename = "${f.key}")]\n` : ""}${f.optional ? "    #[serde(skip_serializing_if = \"Option::is_none\")]\n" : ""}    pub ${safe.startsWith("r#") ? `${id}_` : safe}: ${tyStr(f.ty, f.opt)},`; }).join("\n")}\n}\n`);
        break;
      case "pydantic":
        out.push(`class ${s.name}(BaseModel):\n${fields.length ? fields.map((f) => { const id = safeIdent(CASES.snake(f.key) || "field", "pydantic"); return `    ${id}: ${tyStr(f.ty, f.opt)}${f.opt ? " = None" : ""}${id !== f.key ? `${f.opt ? "" : ""}` : ""}`.replace(/( = None)?$/, id !== f.key ? ` = Field(${f.opt ? "None, " : ""}alias="${f.key}")` : "$1"); }).join("\n") : "    pass"}\n`);
        break;
      case "kotlin":
        out.push(`@Serializable\ndata class ${s.name}(\n${fields.map((f) => { const id = safeIdent(CASES.camel(f.key) || "field", "kotlin"); return `    ${id !== f.key ? `@SerialName("${f.key}") ` : ""}val ${id}: ${tyStr(f.ty, f.opt)}${f.opt ? " = null" : ""},`; }).join("\n")}\n)\n`);
        break;
      case "swift": {
        const ids = fields.map((f) => ({ f, id: safeIdent(CASES.camel(f.key) || "field", "swift") }));
        const keys = ids.some(({ f, id }) => id !== f.key) ? `\n    enum CodingKeys: String, CodingKey {\n${ids.map(({ f, id }) => `        case ${id}${id !== f.key ? ` = "${f.key}"` : ""}`).join("\n")}\n    }\n` : "";
        out.push(`struct ${s.name}: Codable {\n${ids.map(({ f, id }) => `    let ${id}: ${tyStr(f.ty, f.opt)}`).join("\n")}\n${keys}}\n`);
        break;
      }
      case "zod":
        out.push(`export const ${s.name}Schema = z.object({\n${fields.map((f) => `  ${/^[A-Za-z_$][\w$]*$/.test(f.key) ? f.key : JSON.stringify(f.key)}: ${tyStr(f.ty, f.nullable)}${f.optional ? ".optional()" : ""},`).join("\n")}\n});\nexport type ${s.name} = z.infer<typeof ${s.name}Schema>;\n`);
        break;
      case "csharp":
        out.push(`public class ${s.name}\n{\n${fields.map((f) => `    [JsonPropertyName("${f.key}")]\n    public ${tyStr(f.ty, f.opt)} ${safeIdent(CASES.pascal(f.key) || "Field", "csharp")} { get; set; }`).join("\n\n")}\n}\n`);
        break;
      case "java":
        out.push(`public record ${s.name}(\n${fields.map((f) => `    @JsonProperty("${f.key}") ${tyStr(f.ty, f.opt)} ${safeIdent(CASES.camel(f.key) || "field", "java")}`).join(",\n")}\n) {}\n`);
        break;
    }
  }
  if (wrapRoot) {
    const t = tyStr(root, false);
    const alias: Record<Lang, string> = { go: `type ${refName} = ${t}`, rust: `pub type ${refName} = ${t};`, pydantic: `${refName} = ${t}`, kotlin: `typealias ${refName} = ${t}`, swift: `typealias ${refName} = ${t}`, zod: `export const ${refName}Schema = ${t};\nexport type ${refName} = z.infer<typeof ${refName}Schema>;`, csharp: `// root type: ${t}`, java: `// root type: ${t}` };
    out.push(alias[lang] + "\n");
  }
  // Zodは参照先を先に定義する必要があるため、依存の深い順（逆順）で出力済み。他言語は順不同で問題ない
  return out.join("\n");
}
