/**
 * 変更前後の OpenAPI 3.0.x 定義を比較し、既存クライアントに影響する変更の一部を検出する。
 * 対象: パス・メソッドの削除、リクエスト項目（パラメーター・ボディ・プロパティ）の必須化、型・nullableの変更。
 * 同一文書内の $ref は解決し、外部参照・allOf などの合成スキーマは「未判定」として報告する。
 */
import { childPath, diffJson } from "@/lib/json-structure-diff";

type Obj = Record<string, unknown>;
type YamlModule = Pick<typeof import("yaml"), "parse">;

export type SpecLoad =
  | { status: "ok"; doc: Obj }
  | { status: "syntax"; line?: number; column?: number; message: string }
  | { status: "notObject" }
  | { status: "unsupportedVersion"; version: string };

export function loadSpec(yaml: YamlModule, text: string): SpecLoad {
  let value: unknown;
  try {
    // YAML 1.2 はJSONを含むため、JSONもこのパーサーで読み込む
    value = yaml.parse(text);
  } catch (error) {
    const linePos = (error as { linePos?: { line: number; col: number }[] }).linePos?.[0];
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    return { status: "syntax", line: linePos?.line, column: linePos?.col, message };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return { status: "notObject" };
  const doc = value as Obj;
  const version = doc.openapi ?? doc.swagger;
  if (typeof doc.openapi !== "string" || !/^3\.0\.\d+$/.test(doc.openapi)) {
    return { status: "unsupportedVersion", version: version === undefined ? "" : String(version) };
  }
  return { status: "ok", doc };
}

export type FindingKind =
  | "pathRemoved"
  | "methodRemoved"
  | "paramAdded"
  | "paramRequired"
  | "bodyRequired"
  | "mediaTypeRemoved"
  | "propertyRequired"
  | "typeChanged"
  | "nullableChanged"
  | "externalRef"
  | "unresolvedRef"
  | "composition";

export type CompatFinding = {
  severity: "breaking" | "unchecked";
  kind: FindingKind;
  /** 変更前の定義のパス */
  path: string;
  method: string;
  /** 例: requestBody application/json $.name */
  location: string;
  before?: string;
  after?: string;
};

export type CompatReport = { findings: CompatFinding[]; checkedOperations: number };

const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

const isObj = (value: unknown): value is Obj => value !== null && typeof value === "object" && !Array.isArray(value);

function pointer(doc: Obj, ref: string): unknown {
  let node: unknown = doc;
  for (const raw of ref.slice(1).split("/").slice(1)) {
    const key = decodeURIComponent(raw).replace(/~1/g, "/").replace(/~0/g, "~");
    if (!isObj(node) && !Array.isArray(node)) return undefined;
    node = (node as Obj)[key];
  }
  return node;
}

type Resolved = { node: Obj } | { kind: "externalRef" | "unresolvedRef"; ref: string };

function resolve(doc: Obj, value: unknown): Resolved {
  let node = value;
  const seen = new Set<string>();
  while (isObj(node) && typeof node.$ref === "string") {
    const ref = node.$ref;
    if (!ref.startsWith("#")) return { kind: "externalRef", ref };
    if (seen.has(ref)) return { kind: "unresolvedRef", ref };
    seen.add(ref);
    node = pointer(doc, ref);
  }
  if (!isObj(node)) return { kind: "unresolvedRef", ref: isObj(value) ? String(value.$ref) : "" };
  return { node };
}

const typeLabel = (schema: Obj) => (typeof schema.type === "string" ? schema.type : undefined);

export function compareSpecs(oldDoc: Obj, newDoc: Obj): CompatReport {
  const findings: CompatFinding[] = [];
  let checkedOperations = 0;

  function compareSchema(
    endpoint: { path: string; method: string },
    oldValue: unknown,
    newValue: unknown,
    direction: "request" | "response",
    location: string,
    // 再帰的なスキーマで無限に比較しないよう、比較済みの組み合わせを記録する
    visited = new Map<Obj, Set<Obj>>()
  ) {
    const push = (severity: CompatFinding["severity"], kind: FindingKind, before?: string, after?: string) =>
      findings.push({ severity, kind, ...endpoint, location, before, after });

    const a = resolve(oldDoc, oldValue);
    const b = resolve(newDoc, newValue);
    for (const side of [a, b]) {
      if ("kind" in side) return push("unchecked", side.kind, side.ref);
    }
    const oldSchema = (a as { node: Obj }).node;
    const newSchema = (b as { node: Obj }).node;
    const pairs = visited.get(oldSchema) ?? new Set<Obj>();
    if (pairs.has(newSchema)) return;
    visited.set(oldSchema, pairs.add(newSchema));

    if (["allOf", "anyOf", "oneOf", "not"].some((key) => key in oldSchema || key in newSchema)) {
      if (diffJson(oldSchema, newSchema).length > 0) push("unchecked", "composition");
      return;
    }

    const oldType = typeLabel(oldSchema);
    const newType = typeLabel(newSchema);
    if (oldType && newType && oldType !== newType) {
      // リクエストで受け付ける範囲が広がる・レスポンスで返す範囲が狭まる integer と number の変更は互換
      const widened = direction === "request" && oldType === "integer" && newType === "number";
      const narrowed = direction === "response" && oldType === "number" && newType === "integer";
      if (!widened && !narrowed) return push("breaking", "typeChanged", oldType, newType);
    }

    const oldNullable = oldSchema.nullable === true;
    const newNullable = newSchema.nullable === true;
    if (direction === "request" ? oldNullable && !newNullable : !oldNullable && newNullable) {
      push("breaking", "nullableChanged", String(oldNullable), String(newNullable));
    }

    if (direction === "request" && Array.isArray(newSchema.required)) {
      const oldRequired = new Set(Array.isArray(oldSchema.required) ? oldSchema.required : []);
      for (const name of newSchema.required) {
        if (typeof name === "string" && !oldRequired.has(name)) {
          findings.push({ severity: "breaking", kind: "propertyRequired", ...endpoint, location: childPath(location, name) });
        }
      }
    }

    if (isObj(oldSchema.properties) && isObj(newSchema.properties)) {
      for (const [name, schema] of Object.entries(oldSchema.properties)) {
        if (Object.hasOwn(newSchema.properties, name)) {
          compareSchema(endpoint, schema, newSchema.properties[name], direction, childPath(location, name), visited);
        }
      }
    }
    if (oldSchema.items !== undefined && newSchema.items !== undefined) {
      compareSchema(endpoint, oldSchema.items, newSchema.items, direction, `${location}[*]`, visited);
    }
  }

  function parameters(doc: Obj, path: string, item: Obj, operation: Obj, endpoint: { path: string; method: string }) {
    // パスパラメーターは名前ではなくパス内の位置で対応付ける（/users/{id} → /users/{userId} は同じ）
    const pathNames = [...path.matchAll(/\{([^}]*)\}/g)].map((match) => match[1]);
    const map = new Map<string, { label: string; param: Obj }>();
    for (const value of [item.parameters, operation.parameters].flatMap((list) => (Array.isArray(list) ? list : []))) {
      const resolved = resolve(doc, value);
      if ("kind" in resolved) {
        findings.push({ severity: "unchecked", kind: resolved.kind, ...endpoint, location: "parameters", before: resolved.ref });
        continue;
      }
      const { name, in: place } = resolved.node;
      if (typeof name !== "string" || typeof place !== "string") continue;
      // ヘッダー名は大文字・小文字を区別しない。操作側の定義がパス側を上書きする
      const id = place === "header" ? name.toLowerCase() : place === "path" ? `#${pathNames.indexOf(name)}` : name;
      map.set(`${place}.${id}`, { label: `${place}.${place === "header" ? name.toLowerCase() : name}`, param: resolved.node });
    }
    return map;
  }

  function content(doc: Obj, value: unknown): Obj | undefined {
    const resolved = resolve(doc, value);
    return "node" in resolved ? resolved.node : undefined;
  }

  function compareOperation(path: string, method: string, oldItem: Obj, oldOp: Obj, next: { path: string; item: Obj }, newOp: Obj) {
    checkedOperations++;
    const endpoint = { path, method: method.toUpperCase() };
    const oldParams = parameters(oldDoc, path, oldItem, oldOp, endpoint);
    const newParams = parameters(newDoc, next.path, next.item, newOp, endpoint);
    for (const [key, { label, param }] of newParams) {
      const before = oldParams.get(key)?.param;
      const location = `parameter ${label}`;
      if (!before) {
        if (param.required === true) findings.push({ severity: "breaking", kind: "paramAdded", ...endpoint, location });
        continue;
      }
      if (before.required !== true && param.required === true) {
        findings.push({ severity: "breaking", kind: "paramRequired", ...endpoint, location });
      }
      if (before.schema !== undefined && param.schema !== undefined) {
        compareSchema(endpoint, before.schema, param.schema, "request", location);
      }
    }

    const oldBody = oldOp.requestBody === undefined ? undefined : content(oldDoc, oldOp.requestBody);
    const newBody = newOp.requestBody === undefined ? undefined : content(newDoc, newOp.requestBody);
    if (newBody?.required === true && oldBody?.required !== true) {
      findings.push({ severity: "breaking", kind: "bodyRequired", ...endpoint, location: "requestBody" });
    }
    if (oldBody && newBody && isObj(oldBody.content) && isObj(newBody.content)) {
      for (const [mediaType, media] of Object.entries(oldBody.content)) {
        const location = `requestBody ${mediaType}`;
        const next = newBody.content[mediaType];
        if (next === undefined) {
          findings.push({ severity: "breaking", kind: "mediaTypeRemoved", ...endpoint, location });
        } else if (isObj(media) && isObj(next) && media.schema !== undefined && next.schema !== undefined) {
          compareSchema(endpoint, media.schema, next.schema, "request", `${location} $`);
        }
      }
    }

    if (isObj(oldOp.responses) && isObj(newOp.responses)) {
      for (const [code, value] of Object.entries(oldOp.responses)) {
        if (!Object.hasOwn(newOp.responses, code)) continue;
        const oldResponse = content(oldDoc, value);
        const newResponse = content(newDoc, newOp.responses[code]);
        if (!isObj(oldResponse?.content) || !isObj(newResponse?.content)) continue;
        for (const [mediaType, media] of Object.entries(oldResponse.content)) {
          const next = newResponse.content[mediaType];
          if (isObj(media) && isObj(next) && media.schema !== undefined && next.schema !== undefined) {
            compareSchema(endpoint, media.schema, next.schema, "response", `response ${code} ${mediaType} $`);
          }
        }
      }
    }
  }

  // パスパラメーターの名前だけが違うパス（/users/{id} と /users/{userId}）は同じエンドポイントとして扱う
  const template = (path: string) => path.replace(/\{[^}]*\}/g, "{}");
  const newPaths = new Map<string, { path: string; item: Obj }>();
  if (isObj(newDoc.paths)) {
    for (const [path, item] of Object.entries(newDoc.paths)) if (isObj(item)) newPaths.set(template(path), { path, item });
  }

  for (const [path, item] of Object.entries(isObj(oldDoc.paths) ? oldDoc.paths : {})) {
    if (!isObj(item)) continue;
    const next = newPaths.get(template(path));
    const newItem = next?.item;
    if (typeof item.$ref === "string" || typeof newItem?.$ref === "string") {
      findings.push({ severity: "unchecked", kind: "externalRef", path, method: "", location: "path item", before: String(item.$ref ?? newItem?.$ref) });
      continue;
    }
    const methods = METHODS.filter((method) => isObj(item[method]));
    if (!newItem) {
      for (const method of methods) {
        findings.push({ severity: "breaking", kind: "pathRemoved", path, method: method.toUpperCase(), location: "" });
      }
      continue;
    }
    for (const method of methods) {
      const newOp = newItem[method];
      if (!isObj(newOp)) {
        findings.push({ severity: "breaking", kind: "methodRemoved", path, method: method.toUpperCase(), location: "" });
      } else {
        compareOperation(path, method, item, item[method] as Obj, next!, newOp);
      }
    }
  }

  return { findings, checkedOperations };
}
