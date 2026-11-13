import { describe, expect, it } from "vitest";

import { sampleFromSchema } from "./schema-sample";

describe("JSON Schemaからサンプル生成", () => {
  it("型・format・制約を反映する", () => {
    const schema = { type: "object", required: ["id"], properties: { id: { type: "integer", minimum: 10 }, email: { type: "string", format: "email" }, code: { type: "string", minLength: 5 }, status: { enum: ["open", "closed"] }, tags: { type: "array", items: { type: "string" }, minItems: 2 }, ratio: { type: "number", maximum: -3 }, nested: { type: "object", properties: { ok: { type: "boolean" } } } } };
    expect(sampleFromSchema(schema)).toEqual({ id: 10, email: "user@example.com", code: "stringxx".slice(0, 6), status: "open", tags: ["string", "string"], ratio: -3, nested: { ok: true } });
  });

  it("$ref・allOf・oneOf・再帰参照を扱う", () => {
    const schema = { $defs: { Node: { type: "object", properties: { name: { type: "string" }, next: { $ref: "#/$defs/Node" } } } }, allOf: [{ $ref: "#/$defs/Node" }, { type: "object", required: ["extra"], properties: { extra: { oneOf: [{ type: "integer", const: 7 }, { type: "string" }] } } }] };
    const v = sampleFromSchema(schema) as Record<string, unknown>;
    expect(v.name).toBe("string");
    expect(v.extra).toBe(7);
    expect(JSON.stringify(v).length).toBeLessThan(400);
  });

  it("default・const・examplesを優先する", () => {
    expect(sampleFromSchema({ type: "string", default: "d", examples: ["e"] })).toBe("d");
    expect(sampleFromSchema({ type: "string", examples: ["e"] })).toBe("e");
    expect(sampleFromSchema({ const: 3 })).toBe(3);
  });
});
