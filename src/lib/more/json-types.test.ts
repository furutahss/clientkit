import { describe, expect, it } from "vitest";

import { generateTypes, inferStructs } from "./json-types";

const sample = { id: 1, user_name: "a", score: 1.5, active: true, tags: ["x"], address: { zip: "1", type: "home" }, items: [{ sku: "a", qty: 1 }, { sku: "b", note: null }] };

describe("JSONから型を生成", () => {
  it("配列の要素を統合し、欠けたキーをoptional、nullをnullableにする", () => {
    const { structs } = inferStructs(sample);
    const item = structs.find((s) => s.name === "Item")!;
    expect(item.fields.map((f) => [f.key, f.optional, f.nullable])).toEqual([["sku", false, false], ["qty", true, false], ["note", true, true]]);
  });

  it("Go", () => {
    const code = generateTypes(sample, "go");
    expect(code).toContain("type Root struct {");
    expect(code).toContain('ID int64 `json:"id"`');
    expect(code).toContain('UserName string `json:"user_name"`');
    expect(code).toContain('Qty *int64 `json:"qty,omitempty"`');
    expect(code).toContain("Items []Item");
  });

  it("Rust（予約語は rename、optionalは Option）", () => {
    const code = generateTypes(sample, "rust");
    expect(code).toContain("pub struct Address");
    expect(code).toContain('#[serde(rename = "type")]');
    expect(code).toContain("pub qty: Option<i64>,");
  });

  it("Python / Kotlin / Swift / Zod / C# / Java", () => {
    expect(generateTypes(sample, "pydantic")).toContain('user_name: str');
    expect(generateTypes({ userId: 1 }, "pydantic")).toContain("user_id: int = Field(alias=\"userId\")");
    expect(generateTypes(sample, "kotlin")).toContain('@SerialName("user_name") val userName: String,');
    expect(generateTypes(sample, "swift")).toContain('case userName = "user_name"');
    const zod = generateTypes(sample, "zod");
    expect(zod.indexOf("ItemSchema")).toBeLessThan(zod.indexOf("export const RootSchema"));
    expect(zod).toContain("qty: z.number().int().optional()");
    expect(generateTypes(sample, "csharp")).toContain('[JsonPropertyName("user_name")]\n    public string UserName { get; set; }');
    expect(generateTypes(sample, "java")).toContain('@JsonProperty("user_name") String userName');
  });

  it("ルートが配列・プリミティブでもエイリアスを出す", () => {
    expect(generateTypes([{ a: 1 }], "go")).toContain("type Root = []RootItem");
  });
});
