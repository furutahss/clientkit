import { describe, expect, it } from "vitest";

import { generateRows, renderRows } from "./fake-data";

describe("ダミーデータ生成", () => {
  it("同じシードなら同じ結果、違えば別の結果になる", () => {
    const f = ["name", "email", "phone", "int:5-9"];
    expect(generateRows(f, 5, 42, "ja")).toEqual(generateRows(f, 5, 42, "ja"));
    expect(generateRows(f, 5, 42, "ja")).not.toEqual(generateRows(f, 5, 43, "ja"));
  });

  it("形式と範囲を満たす", () => {
    const rows = generateRows(["phone", "postal_code", "uuid", "int:10-12", "pick:a|b", "birthday"], 50, 1, "ja");
    for (const r of rows) {
      expect(r.phone).toMatch(/^0[789]0-\d{4}-\d{4}$/);
      expect(r.postal_code).toMatch(/^\d{3}-\d{4}$/);
      expect(r.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect([10, 11, 12]).toContain(r["int:10-12"]);
      expect(["a", "b"]).toContain(r["pick:a|b"]);
      expect(r.birthday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(generateRows(["email"], 1, 3, "en")[0].email).toMatch(/^[a-z]+\.[a-z]+\d+@example\.com$/);
  });

  it("CSV・SQL・JSONに出力し、特殊文字をエスケープする", () => {
    const fields = ["name", "id"];
    const rows = [{ name: 'A "B", C', id: 1 }, { name: "O'Brien", id: 2 }];
    expect(renderRows(rows, fields, "csv")).toBe('name,id\n"A ""B"", C",1\nO\'Brien,2');
    expect(renderRows(rows, fields, "sql", "t")).toBe("INSERT INTO t (name, id) VALUES\n  ('A \"B\", C', 1),\n  ('O''Brien', 2);");
    expect(JSON.parse(renderRows(rows, fields, "json"))[1]).toEqual({ name: "O'Brien", id: 2 });
    expect(renderRows(rows, fields, "ndjson").split("\n")).toHaveLength(2);
  });
});
