/** JSONを構造で比較する（オブジェクトのキー順は無視し、配列はインデックス順で比較する） */

export type JsonDiffKind = "added" | "removed" | "changed";

export type JsonDiffEntry = {
  kind: JsonDiffKind;
  /** JSONPath風のパス（例: $.user["first.name"][0]） */
  path: string;
  before?: unknown;
  after?: unknown;
};

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** キーにドットや記号が含まれても一意に特定できるようにパスを組み立てる */
export function childPath(path: string, key: string | number): string {
  if (typeof key === "number") return `${path}[${key}]`;
  return IDENTIFIER.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function kindOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function diffJson(
  before: unknown,
  after: unknown,
  path = "$",
  out: JsonDiffEntry[] = []
): JsonDiffEntry[] {
  const beforeKind = kindOf(before);
  const afterKind = kindOf(after);

  if (beforeKind === "object" && afterKind === "object") {
    const a = before as Record<string, unknown>;
    const b = after as Record<string, unknown>;
    for (const key of Object.keys(a)) {
      if (!Object.hasOwn(b, key)) {
        out.push({ kind: "removed", path: childPath(path, key), before: a[key] });
      } else {
        diffJson(a[key], b[key], childPath(path, key), out);
      }
    }
    for (const key of Object.keys(b)) {
      if (!Object.hasOwn(a, key)) {
        out.push({ kind: "added", path: childPath(path, key), after: b[key] });
      }
    }
    return out;
  }

  if (beforeKind === "array" && afterKind === "array") {
    const a = before as unknown[];
    const b = after as unknown[];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (i >= b.length) out.push({ kind: "removed", path: childPath(path, i), before: a[i] });
      else if (i >= a.length) out.push({ kind: "added", path: childPath(path, i), after: b[i] });
      else diffJson(a[i], b[i], childPath(path, i), out);
    }
    return out;
  }

  if (beforeKind !== afterKind || before !== after) {
    out.push({ kind: "changed", path, before, after });
  }
  return out;
}
