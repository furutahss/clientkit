import { describe, expect, it } from "vitest";

import { baseUrl, curlExamples, listOperations, loadSpec, schemasToTypeScript } from "./openapi-view";

const yaml = `
openapi: 3.0.3
info: { title: Pets, version: "1" }
servers: [{ url: "https://api.example.com/v1/" }]
security: [{ bearer: [] }]
paths:
  /pets:
    get:
      summary: List pets
      operationId: listPets
      tags: [pets]
      parameters:
        - { name: limit, in: query, required: true, schema: { type: integer } }
      responses: { "200": { description: ok } }
    post:
      summary: Create a pet
      requestBody:
        content:
          application/json:
            schema: { $ref: "#/components/schemas/NewPet" }
      responses: { "201": { description: created } }
  /pets/{id}:
    parameters: [{ name: id, in: path, required: true, schema: { type: string } }]
    delete:
      deprecated: true
      security: []
      responses: { "204": { description: gone } }
components:
  schemas:
    NewPet:
      type: object
      required: [name]
      properties:
        name: { type: string }
        tag: { type: string, nullable: true }
        kind: { type: string, enum: [cat, dog] }
        owner: { $ref: "#/components/schemas/Owner" }
    Owner:
      type: object
      properties:
        id: { type: integer }
        pets: { type: array, items: { $ref: "#/components/schemas/NewPet" } }
    Id: { type: string, format: uuid }
`;

describe("OpenAPIビューア", () => {
  const doc = loadSpec(yaml);
  it("エンドポイント一覧を作る", () => {
    const ops = listOperations(doc);
    expect(ops.map((o) => `${o.method} ${o.path}`)).toEqual(["GET /pets", "POST /pets", "DELETE /pets/{id}"]);
    expect(ops[0]).toMatchObject({ operationId: "listPets", tags: ["pets"], params: ["limit* (query)"], security: "bearer", responses: ["200"] });
    expect(ops[1].body).toBe("application/json");
    expect(ops[2]).toMatchObject({ deprecated: true, security: "", params: ["id* (path)"] });
    expect(baseUrl(doc)).toBe("https://api.example.com/v1");
  });

  it("スキーマをTypeScriptにする", () => {
    const ts = schemasToTypeScript(doc);
    expect(ts).toContain("export interface NewPet {\n  name: string;\n  tag?: string | null;\n  kind?: \"cat\" | \"dog\";\n  owner?: Owner;\n}");
    expect(ts).toContain("pets?: NewPet[];");
    expect(ts).toContain("export type Id = string;");
  });

  it("curlの例を作る（認証・必須クエリ・JSONボディ）", () => {
    const curl = curlExamples(doc);
    expect(curl).toContain("curl -X GET 'https://api.example.com/v1/pets?limit=value' \\\n  -H 'Authorization: Bearer <token>'");
    expect(curl).toContain("-H 'Content-Type: application/json'");
    expect(curl).toContain(`-d '{"name":"string","tag":"string","kind":"cat","owner":{"id":1,"pets":[{"name":"string","tag":"string","kind":"cat","owner":{"id":1,"pets":[null]}}]}}'`);
    expect(curl).toContain("curl -X DELETE 'https://api.example.com/v1/pets/{id}'");
  });

  it("OpenAPIでない入力は例外", () => {
    expect(() => loadSpec("{}")).toThrow("not-openapi");
    expect(() => loadSpec("hello: 1")).toThrow("not-openapi");
  });
});
