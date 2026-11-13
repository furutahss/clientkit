import { describe, expect, it } from "vitest";

import { JqError, runJq, type J } from "./jq";

const data: J = {
  users: [{ name: "Alice", age: 30, tags: ["a", "b"] }, { name: "Bob", age: 17, tags: [] }, { name: "Carol", age: 45, tags: ["c"] }],
  meta: { total: 3 },
};
const q = (p: string, input: J = data) => runJq(p, input);

describe("jq", () => {
  it("パス・イテレーター・パイプ・select・map", () => {
    expect(q(".meta.total")).toEqual([3]);
    expect(q(".users[0].name")).toEqual(["Alice"]);
    expect(q(".users[] | select(.age >= 18) | .name")).toEqual(["Alice", "Carol"]);
    expect(q("[.users[] | .age] | add")).toEqual([92]);
    expect(q(".users | map(.name) | join(\", \")")).toEqual(["Alice, Bob, Carol"]);
    expect(q(".users[-1].name")).toEqual(["Carol"]);
    expect(q(".users[1:3] | length")).toEqual([2]);
  });

  it("オブジェクト・配列の構築と文字列補間", () => {
    expect(q(".users[0] | {name, years: .age, first: .tags[0]}")).toEqual([{ name: "Alice", years: 30, first: "a" }]);
    expect(q('.users[] | "\\(.name) is \\(.age)"')).toEqual(["Alice is 30", "Bob is 17", "Carol is 45"]);
    expect(q("[.users[] | select(.tags | length > 0) | .name]")).toEqual([["Alice", "Carol"]]);
  });

  it("sort_by・group_by・unique・min_by・to_entries", () => {
    expect(q("sort_by(.age) | map(.name)", (data as { users: J }).users)).toEqual([["Bob", "Alice", "Carol"]]);
    expect(q("group_by(. % 2) | length", [1, 2, 3, 4, 5])).toEqual([2]);
    expect(q("unique", [3, 1, 3, 2, 1])).toEqual([[1, 2, 3]]);
    expect(q("min_by(.age).name", (data as { users: J }).users)).toEqual(["Bob"]);
    expect(q("to_entries | map(.key)", { a: 1, b: 2 })).toEqual([["a", "b"]]);
    expect(q("with_entries(select(.value > 1))", { a: 1, b: 2 })).toEqual([{ b: 2 }]);
  });

  it("if・as・// ・?・比較・算術・@フォーマット", () => {
    expect(q('.users[] | if .age >= 18 then "adult" else "minor" end')).toEqual(["adult", "minor", "adult"]);
    expect(q(".meta.total as $t | .users | length | . / $t")).toEqual([1]);
    expect(q(".missing // \"default\"")).toEqual(["default"]);
    expect(q(".a.b?", { a: 5 })).toEqual([]);
    expect(q("1 + 2 * 3 - 1")).toEqual([6]);
    expect(q("[1,2,3] | @csv")).toEqual(["1,2,3"]);
    expect(q('"a b" | @uri')).toEqual(["a%20b"]);
    expect(q('.. | select(type == "number")', { a: [1, { b: 2 }] })).toEqual([1, 2]);
  });

  it("エラーは分かりやすい例外にする", () => {
    expect(() => q(".users | .name")).toThrow(JqError);
    expect(() => q(".[")).toThrow(JqError);
    expect(() => q("nope(1)")).toThrow(/not defined/);
    expect(() => q("1 / 0")).toThrow(/zero/);
  });
});
