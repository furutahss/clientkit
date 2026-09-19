export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

const VALID_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function toPascalCase(name: string): string {
  const converted = name
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_match, char: string | undefined) =>
      char ? char.toUpperCase() : ""
    )
    .replace(/^[a-z]/, (char) => char.toUpperCase());

  return converted || "Root";
}

/** 入力JSONの値からTypeScriptの型定義コード（interface / type alias）を生成する */
export function generateTypeScriptTypes(
  value: JsonValue,
  rootName = "RootObject"
): string {
  const interfaces: string[] = [];
  const usedNames = new Set<string>();

  function uniqueName(base: string): string {
    let name = base;
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `${base}${suffix}`;
      suffix += 1;
    }
    usedNames.add(name);
    return name;
  }

  function isPlainObject(
    input: JsonValue
  ): input is Record<string, JsonValue> {
    return input !== null && typeof input === "object" && !Array.isArray(input);
  }

  function resolveObjectType(
    objects: Record<string, JsonValue>[],
    hintName: string
  ): string {
    const name = uniqueName(toPascalCase(hintName));
    const keys = new Set<string>();
    objects.forEach((obj) => {
      Object.keys(obj).forEach((key) => keys.add(key));
    });

    const fields = keys.size
      ? Array.from(keys)
          .map((key) => {
            const presentIn = objects.filter((obj) =>
              Object.prototype.hasOwnProperty.call(obj, key)
            );
            const optional = presentIn.length < objects.length;
            const valueTypes = Array.from(
              new Set(presentIn.map((obj) => resolveType(obj[key], key)))
            );
            const propType =
              valueTypes.length === 1
                ? valueTypes[0]
                : `(${valueTypes.join(" | ")})`;
            const safeKey = VALID_IDENTIFIER.test(key)
              ? key
              : JSON.stringify(key);
            return `  ${safeKey}${optional ? "?" : ""}: ${propType};`;
          })
          .join("\n")
      : "  [key: string]: never;";

    interfaces.push(`interface ${name} {\n${fields}\n}`);
    return name;
  }

  function resolveType(input: JsonValue, hintName: string): string {
    if (input === null) return "null";

    if (Array.isArray(input)) {
      if (input.length === 0) return "unknown[]";

      const objectItems = input.filter(isPlainObject);
      const otherItems = input.filter((item) => !isPlainObject(item));

      const elementTypes = new Set<string>();
      if (objectItems.length > 0) {
        elementTypes.add(resolveObjectType(objectItems, `${hintName}Item`));
      }
      otherItems.forEach((item) => {
        elementTypes.add(resolveType(item, `${hintName}Item`));
      });

      const uniqueTypes = Array.from(elementTypes);
      const elementType =
        uniqueTypes.length === 1
          ? uniqueTypes[0]
          : `(${uniqueTypes.join(" | ")})`;
      return `${elementType}[]`;
    }

    switch (typeof input) {
      case "string":
        return "string";
      case "number":
        return "number";
      case "boolean":
        return "boolean";
      case "object":
        return resolveObjectType(
          [input as Record<string, JsonValue>],
          hintName
        );
      default:
        return "unknown";
    }
  }

  const rootType = resolveType(value, rootName);

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [...interfaces, `type ${rootName} = ${rootType};`].join("\n\n");
  }

  return interfaces.join("\n\n");
}
