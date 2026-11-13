import { describe, expect, it } from "vitest";

import { compareFolders, relativePath } from "./folder-compare";

const f = (path: string, size: number, hash: string) => ({ path, size, hash });

describe("フォルダ比較", () => {
  it("相対パスにする", () => {
    expect(relativePath("project/src/a.ts")).toBe("src/a.ts");
    expect(relativePath("a.ts")).toBe("a.ts");
  });
  it("同一・変更・片側のみに分類し、変更を先頭に並べる", () => {
    const rows = compareFolders([f("a", 1, "h1"), f("b", 2, "h2"), f("c", 3, "h3"), f("d", 4, "x")], [f("a", 1, "h1"), f("b", 2, "DIFF"), f("d", 5, "x"), f("e", 6, "h6")]);
    expect(rows.map((r) => [r.path, r.status])).toEqual([["b", "modified"], ["d", "modified"], ["c", "only-a"], ["e", "only-b"], ["a", "same"]]);
    expect(rows.find((r) => r.path === "d")).toMatchObject({ sizeA: 4, sizeB: 5 });
  });
});
