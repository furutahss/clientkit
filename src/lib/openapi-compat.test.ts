import * as YAML from "yaml";
import { describe, expect, it } from "vitest";

import { compareSpecs, loadSpec } from "./openapi-compat";

function doc(text: string) {
  const result = loadSpec(YAML, text);
  if (result.status !== "ok") throw new Error(result.status);
  return result.doc;
}

/** テストで定義の一部を書き換えるためのアクセサー */
function at(value: unknown, ...keys: string[]): Record<string, unknown> {
  return keys.reduce((node, key) => (node as Record<string, unknown>)[key], value) as Record<string, unknown>;
}

const OLD = `
openapi: 3.0.3
info: { title: Shop, version: "1" }
paths:
  /users/{id}:
    get:
      parameters:
        - { name: id, in: path, required: true, schema: { type: integer } }
        - { name: verbose, in: query, schema: { type: boolean } }
      responses:
        "200":
          content:
            application/json:
              schema: { $ref: "#/components/schemas/User" }
    delete:
      responses: { "204": { description: ok } }
  /orders:
    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [item]
              properties:
                item: { type: string }
                note: { type: string }
                qty: { type: integer }
      responses: { "201": { description: ok } }
  /legacy:
    get:
      responses: { "200": { description: ok } }
components:
  schemas:
    User:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        friends: { type: array, items: { $ref: "#/components/schemas/User" } }
`;

describe("OpenAPI互換性チェック", () => {
  it("キー順・整形だけの変更は検出しない", () => {
    const reverseKeys = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(reverseKeys)
        : value && typeof value === "object"
          ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverseKeys(v)]))
          : value;
    const reordered = JSON.stringify(reverseKeys(doc(OLD)));
    expect(compareSpecs(doc(OLD), doc(JSON.stringify(doc(OLD), null, 4))).findings).toEqual([]);
    expect(compareSpecs(doc(OLD), doc(reordered)).findings).toEqual([]);
  });

  it("パス・メソッドの削除、必須化、型変更を検出する", () => {
    const next = doc(OLD);
    const paths = next.paths as Record<string, Record<string, unknown>>;
    delete paths["/legacy"];
    delete paths["/users/{id}"].delete;
    // パスパラメーター名の変更だけなら同じエンドポイント
    paths["/users/{userId}"] = paths["/users/{id}"];
    delete paths["/users/{id}"];
    const get = paths["/users/{userId}"].get as { parameters: Record<string, unknown>[] };
    get.parameters = [
      { name: "userId", in: "path", required: true, schema: { type: "string" } },
      { name: "verbose", in: "query", required: true, schema: { type: "boolean" } },
      { name: "X-Tenant", in: "header", required: true, schema: { type: "string" } },
    ];
    at(paths, "/orders", "post", "requestBody").required = true;
    const schema = at(paths, "/orders", "post", "requestBody", "content", "application/json", "schema");
    schema.required = ["item", "qty"];
    at(schema, "properties").qty = { type: "number" };
    at(next, "components", "schemas", "User", "properties").id = { type: "string" };

    const findings = compareSpecs(doc(OLD), next).findings.map((f) => `${f.kind} ${f.method} ${f.path} ${f.location}`.trim());
    expect(findings).toEqual([
      "typeChanged GET /users/{id} parameter path.userId",
      "paramRequired GET /users/{id} parameter query.verbose",
      "paramAdded GET /users/{id} parameter header.x-tenant",
      "typeChanged GET /users/{id} response 200 application/json $.id",
      "methodRemoved DELETE /users/{id}",
      "bodyRequired POST /orders requestBody",
      "propertyRequired POST /orders requestBody application/json $.qty",
      "pathRemoved GET /legacy",
    ]);
  });

  it("リクエストの integer→number は互換、レスポンスでは非互換", () => {
    const next = doc(OLD);
    at(next, "paths", "/orders", "post", "requestBody", "content", "application/json", "schema", "properties").qty = { type: "number" };
    expect(compareSpecs(doc(OLD), next).findings).toEqual([]);
    at(next, "components", "schemas", "User", "properties").id = { type: "number" };
    expect(compareSpecs(doc(OLD), next).findings.map((f) => f.kind)).toEqual(["typeChanged"]);
  });

  it("nullable の変更", () => {
    const next = doc(OLD);
    at(next, "components", "schemas", "User", "properties").name = { type: "string", nullable: true };
    expect(compareSpecs(doc(OLD), next).findings).toMatchObject([{ kind: "nullableChanged", location: "response 200 application/json $.name" }]);
  });

  it("外部参照・未解決の参照・合成スキーマは未判定にする", () => {
    const next = doc(OLD);
    const properties = at(next, "components", "schemas", "User", "properties");
    properties.id = { $ref: "other.yaml#/Id" };
    properties.name = { $ref: "#/components/schemas/Missing" };
    properties.friends = { oneOf: [{ type: "string" }] };
    expect(compareSpecs(doc(OLD), next).findings.map((f) => [f.severity, f.kind])).toEqual([
      ["unchecked", "externalRef"],
      ["unchecked", "unresolvedRef"],
      ["unchecked", "composition"],
    ]);
  });

  it("OpenAPI 3.0.x 以外と構文エラー", () => {
    expect(loadSpec(YAML, "openapi: 3.1.0\npaths: {}")).toEqual({ status: "unsupportedVersion", version: "3.1.0" });
    expect(loadSpec(YAML, '{"swagger": "2.0"}')).toEqual({ status: "unsupportedVersion", version: "2.0" });
    expect(loadSpec(YAML, "openapi: [")).toMatchObject({ status: "syntax", line: 1 });
    expect(loadSpec(YAML, "- a")).toEqual({ status: "notObject" });
  });
});
