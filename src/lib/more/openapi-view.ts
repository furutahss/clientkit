import { parse as parseYaml } from "yaml";

import { sampleFromSchema } from "./schema-sample";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

export type Operation = { method: string; path: string; summary: string; operationId: string; tags: string[]; params: string[]; body: string; responses: string[]; security: string; deprecated: boolean };

export function loadSpec(text: string): Obj {
  const t = text.trim();
  const doc = t.startsWith("{") ? JSON.parse(t) : parseYaml(t);
  if (!isObj(doc) || !(doc.openapi || doc.swagger) || !isObj(doc.paths)) throw new Error("not-openapi");
  return doc;
}

const refName = (r: string) => r.split("/").pop() ?? r;

export function schemaToTs(s: unknown, indent = 0): string {
  if (!isObj(s)) return "unknown";
  if (typeof s.$ref === "string") return refName(s.$ref);
  const nullable = s.nullable === true ? " | null" : "";
  const wrap = (t: string) => t + nullable;
  if (Array.isArray(s.enum)) return wrap(s.enum.map((v) => JSON.stringify(v)).join(" | "));
  if (Array.isArray(s.oneOf)) return wrap(s.oneOf.map((x) => schemaToTs(x, indent)).join(" | "));
  if (Array.isArray(s.anyOf)) return wrap(s.anyOf.map((x) => schemaToTs(x, indent)).join(" | "));
  if (Array.isArray(s.allOf)) return wrap(s.allOf.map((x) => schemaToTs(x, indent)).join(" & "));
  const type = Array.isArray(s.type) ? s.type.filter((x) => x !== "null") : s.type;
  const typeNull = Array.isArray(s.type) && s.type.includes("null") ? " | null" : "";
  const base = (() => {
    switch (Array.isArray(type) ? type[0] : type) {
      case "string": return s.format === "binary" ? "Blob" : "string";
      case "integer": case "number": return "number";
      case "boolean": return "boolean";
      case "array": { const item = schemaToTs(s.items, indent); return /[|&]/.test(item) ? `Array<${item}>` : `${item}[]`; }
      case "object": case undefined: {
        if (!isObj(s.properties) && !s.additionalProperties) return type === "object" ? "Record<string, unknown>" : "unknown";
        const pad = "  ".repeat(indent + 1);
        const req = new Set((s.required as string[]) ?? []);
        const lines = Object.entries((s.properties as Obj) ?? {}).map(([k, v]) => `${pad}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}${req.has(k) ? "" : "?"}: ${schemaToTs(v, indent + 1)};`);
        if (s.additionalProperties) lines.push(`${pad}[key: string]: ${s.additionalProperties === true ? "unknown" : schemaToTs(s.additionalProperties, indent + 1)};`);
        return `{\n${lines.join("\n")}\n${"  ".repeat(indent)}}`;
      }
      default: return "unknown";
    }
  })();
  return base + nullable + typeNull;
}

export function schemasToTypeScript(doc: Obj): string {
  const schemas = (isObj(doc.components) && isObj(doc.components.schemas) ? doc.components.schemas : isObj(doc.definitions) ? doc.definitions : {}) as Obj;
  const out = Object.entries(schemas).map(([name, s]) => {
    const t = schemaToTs(s);
    const desc = isObj(s) && typeof s.description === "string" ? `/** ${s.description.replace(/\*\//g, "* /")} */\n` : "";
    return t.startsWith("{") ? `${desc}export interface ${name} ${t}` : `${desc}export type ${name} = ${t};`;
  });
  return out.join("\n\n") + (out.length ? "\n" : "");
}

export function listOperations(doc: Obj): Operation[] {
  const ops: Operation[] = [];
  const globalSecurity = Array.isArray(doc.security) ? doc.security : [];
  const resolve = (o: unknown): Obj => (isObj(o) && typeof o.$ref === "string" ? (o.$ref.replace(/^#\//, "").split("/").reduce<unknown>((acc, k) => (isObj(acc) ? acc[k] : undefined), doc) as Obj) ?? {} : (o as Obj) ?? {});
  for (const [path, item] of Object.entries(doc.paths as Obj)) {
    if (!isObj(item)) continue;
    for (const method of METHODS) {
      const op = item[method];
      if (!isObj(op)) continue;
      const params = [...((item.parameters as unknown[]) ?? []), ...((op.parameters as unknown[]) ?? [])].map(resolve).map((p) => `${p.name}${p.required ? "*" : ""} (${p.in})`);
      const body = isObj(op.requestBody) ? Object.keys(resolve(op.requestBody).content ?? {}).join(", ") : "";
      const sec = (Array.isArray(op.security) ? op.security : globalSecurity).flatMap((s: unknown) => Object.keys(isObj(s) ? s : {})).join(", ");
      ops.push({ method: method.toUpperCase(), path, summary: String(op.summary ?? op.description ?? "").split("\n")[0], operationId: String(op.operationId ?? ""), tags: ((op.tags as string[]) ?? []), params, body, responses: Object.keys((op.responses as Obj) ?? {}), security: sec, deprecated: op.deprecated === true });
    }
  }
  return ops;
}

export function baseUrl(doc: Obj): string {
  if (Array.isArray(doc.servers) && isObj(doc.servers[0]) && typeof doc.servers[0].url === "string") return doc.servers[0].url.replace(/\/$/, "");
  if (typeof doc.host === "string") return `${(doc.schemes as string[])?.[0] ?? "https"}://${doc.host}${(doc.basePath as string) ?? ""}`.replace(/\/$/, "");
  return "https://api.example.com";
}

export function curlExamples(doc: Obj): string {
  const lines: string[] = [];
  for (const op of listOperations(doc)) {
    const raw = (doc.paths as Obj)[op.path] as Obj;
    const o = raw[op.method.toLowerCase()] as Obj;
    const query = [...((raw.parameters as unknown[]) ?? []), ...((o.parameters as unknown[]) ?? [])].filter((p): p is Obj => isObj(p) && p.in === "query" && p.required === true).map((p) => `${p.name}=value`);
    const url = `${baseUrl(doc)}${op.path.replace(/\{([^}]+)\}/g, "{$1}")}${query.length ? "?" + query.join("&") : ""}`;
    let cmd = `curl -X ${op.method} '${url}'`;
    if (op.security) cmd += ` \\\n  -H 'Authorization: Bearer <token>'`;
    if (isObj(o.requestBody)) {
      const content = (isObj(o.requestBody.content) ? o.requestBody.content : {}) as Obj;
      const type = Object.keys(content).includes("application/json") ? "application/json" : Object.keys(content)[0];
      if (type) {
        cmd += ` \\\n  -H 'Content-Type: ${type}'`;
        const schema = isObj(content[type]) ? (content[type] as Obj).schema : undefined;
        if (type.includes("json") && schema) cmd += ` \\\n  -d '${JSON.stringify(sampleFromSchema(schema, 0, doc))}'`;
      }
    }
    lines.push(`# ${op.method} ${op.path}${op.summary ? " — " + op.summary : ""}\n${cmd}`);
  }
  return lines.join("\n\n");
}
