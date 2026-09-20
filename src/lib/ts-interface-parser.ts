export interface TsField {
  name: string;
  /** フィールドの型を表すテキスト（例: "string", "number[]", "\"a\" | \"b\"") */
  type: string;
  optional: boolean;
}

export interface TsInterface {
  name: string;
  fields: TsField[];
}

/** ネストした `{}` `[]` `()` を考慮しつつ、トップレベルの区切り文字で分割する */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of body) {
    if (char === "{" || char === "[" || char === "(") depth += 1;
    if (char === "}" || char === "]" || char === ")") depth -= 1;

    if ((char === ";" || char === "\n") && depth <= 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseInterfaceFields(body: string): TsField[] {
  const fields: TsField[] = [];

  for (const rawEntry of splitTopLevel(body)) {
    const entry = rawEntry.replace(/,$/, "").trim();
    if (!entry || entry.startsWith("//") || entry.startsWith("/*")) continue;

    const match = /^(?:readonly\s+)?([\w$]+)(\?)?\s*:\s*(.+)$/.exec(entry);
    if (!match) continue;

    const [, name, optionalMark, type] = match;
    fields.push({ name, type: type.trim(), optional: Boolean(optionalMark) });
  }

  return fields;
}

/**
 * TypeScriptのソースコードから `interface Name { ... }` の定義を抽出する。
 * ネストしたオブジェクト型を1階層含む程度のシンプルな構造を想定した簡易パーサー。
 */
export function parseTsInterfaces(source: string): TsInterface[] {
  const interfaces: TsInterface[] = [];
  const headerRegex = /(?:export\s+)?interface\s+(\w+)\s*(?:extends\s+[^{]+)?\{/g;
  let headerMatch: RegExpExecArray | null;

  while ((headerMatch = headerRegex.exec(source)) !== null) {
    const name = headerMatch[1];
    const bodyStart = headerRegex.lastIndex;

    let depth = 1;
    let index = bodyStart;
    while (index < source.length && depth > 0) {
      if (source[index] === "{") depth += 1;
      else if (source[index] === "}") depth -= 1;
      index += 1;
    }

    const body = source.slice(bodyStart, index - 1);
    interfaces.push({ name, fields: parseInterfaceFields(body) });
    headerRegex.lastIndex = index;
  }

  return interfaces;
}
