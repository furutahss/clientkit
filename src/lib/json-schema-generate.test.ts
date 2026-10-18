import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import { generateJsonSchema } from "./json-schema-generate";
import { validateWithSchema } from "./json-schema-validate";

describe("JSON Schema生成", () => {
  it("ネストしたオブジェクトと配列の型を抽出し、required などは付加しない", () => {
    const schema = generateJsonSchema({ id: 1, name: "Taro", score: 1.5, tags: ["a"], address: { zip: "100" } });
    expect(schema).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        score: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
        address: { type: "object", properties: { zip: { type: "string" } } },
      },
    });
    expect(JSON.stringify(schema)).not.toMatch(/required|enum|additionalProperties/);
  });

  it("型が混在する配列・空配列・空オブジェクト", () => {
    expect(generateJsonSchema([1, "a", null, 2.5])).toMatchObject({ type: "array", items: { type: ["string", "number", "null"] } });
    expect(generateJsonSchema({ list: [], obj: {} }).properties).toEqual({ list: { type: "array" }, obj: { type: "object" } });
    expect(generateJsonSchema([{ a: 1 }, { b: "x" }, "s"]).items).toEqual({
      anyOf: [{ type: "object", properties: { a: { type: "integer" }, b: { type: "string" } } }, { type: "string" }],
    });
  });

  it("__proto__ というキーも通常のプロパティとして扱う", () => {
    const schema = generateJsonSchema(JSON.parse('{"__proto__": 1}'));
    expect(Object.keys(schema.properties as object)).toEqual(["__proto__"]);
  });

  it.each([
    { id: 1, items: [{ a: 1 }, { a: 2.5, b: null }], empty: [], nested: [[1], ["x"]] },
    [1, "a", { k: [] }, [true]],
    null,
    "text",
  ])("生成したSchemaで元のサンプルを検証できる", (sample) => {
    const schema = JSON.stringify(generateJsonSchema(sample));
    expect(validateWithSchema(Ajv2020, JSON.stringify(sample), schema)).toEqual({ status: "valid" });
  });
});
