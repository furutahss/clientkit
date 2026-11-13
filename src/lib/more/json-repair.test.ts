import { describe, expect, it } from "vitest";

import { repairJson } from "./json-repair";

describe("JSON修復", () => {
  it("JS・Python風の記法を直す", () => {
    const r = repairJson("{'a': 1, b: True, \"c\": [1, 2,], // note\n d: None,}");
    expect(r.value).toEqual({ a: 1, b: true, c: [1, 2], d: null });
    expect(r.notes.sort()).toEqual(["comments", "literals", "single-quotes", "trailing-comma", "unquoted-keys"]);
  });

  it("途中で切れた出力を閉じる", () => {
    expect(repairJson('{"a": [1, 2, {"b": "te').value).toEqual({ a: [1, 2, { b: "te" }] });
    expect(repairJson('{"a": ').value).toEqual({ a: null });
    expect(repairJson('{"a": 1, "b"').notes).toContain("closed");
  });

  it("コードフェンス・前置きの文章・カンマ抜けに対応する", () => {
    expect(repairJson('Here is the JSON:\n```json\n{"x": 1 "y": 2}\n```').value).toEqual({ x: 1, y: 2 });
    expect(repairJson("[1 2 3]").notes).toContain("missing-comma");
  });

  it("正しいJSONは通知なしでそのまま返し、解釈できないものは例外にする", () => {
    expect(repairJson('{"a":[true,false,null,1.5e3,"\\u00e9\\n"]}')).toEqual({ value: { a: [true, false, null, 1500, "é\n"] }, notes: [] });
    expect(() => repairJson("{@}")).toThrow(SyntaxError);
  });
});
