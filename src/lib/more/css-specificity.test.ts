import { describe, expect, it } from "vitest";

import { cmpSpec, formatSpec, specificity, splitSelectors } from "./css-specificity";

describe("CSS詳細度", () => {
  it.each([
    ["*", [0, 0, 0]],
    ["li", [0, 0, 1]],
    ["ul li a::before", [0, 0, 4]],
    ["#nav .item:hover", [1, 2, 0]],
    ['a[href^="http"].ext', [0, 2, 1]],
    [".a > .b + .c ~ .d", [0, 4, 0]],
    [":where(.a, #b) .c", [0, 1, 0]],
    [":is(#a, .b) p", [1, 0, 1]],
    [":not(.a, #b)", [1, 0, 0]],
    ["a:nth-child(2n+1 of .x)", [0, 2, 1]],
    ["p:first-line", [0, 0, 2]],
    ["div:has(> img.x)", [0, 1, 2]],
    ["input::placeholder", [0, 0, 2]],
    ['[data-a="x y,z"]', [0, 1, 0]],
  ] as [string, number[]][])("%s", (sel, expected) => {
    expect(specificity(sel)).toEqual(expected);
  });

  it("カンマ区切りを括弧や文字列に影響されずに分割し、大小を比較する", () => {
    expect(splitSelectors('a, :is(b, c), [x="1,2"], .d')).toEqual(["a", ":is(b, c)", '[x="1,2"]', ".d"]);
    expect(cmpSpec(specificity("#a"), specificity(".a.b.c.d"))).toBeGreaterThan(0);
    expect(formatSpec([1, 2, 3])).toBe("(1,2,3)");
  });
});
