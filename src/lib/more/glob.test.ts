import { describe, expect, it } from "vitest";

import { evaluateGlobs, matchGlob } from "./glob";

const m = (p: string, path: string, dot = false) => matchGlob(p, path, { dot });

describe("glob", () => {
  it("*・**・?・[..]", () => {
    expect(m("*.ts", "a.ts")).toBe(true);
    expect(m("*.ts", "src/a.ts")).toBe(false);
    expect(m("**/*.ts", "src/deep/a.ts")).toBe(true);
    expect(m("**/*.ts", "a.ts")).toBe(true);
    expect(m("src/**", "src/a/b.js")).toBe(true);
    expect(m("src/**", "lib/a.js")).toBe(false);
    expect(m("a?c", "abc")).toBe(true);
    expect(m("a?c", "a/c")).toBe(false);
    expect(m("[a-c]*", "bar")).toBe(true);
    expect(m("[!a-c]*", "bar")).toBe(false);
  });

  it("{a,b} と {1..3}", () => {
    expect(m("*.{js,ts}", "x.ts")).toBe(true);
    expect(m("*.{js,ts}", "x.md")).toBe(false);
    expect(m("file{1..3}.txt", "file2.txt")).toBe(true);
    expect(m("file{1..3}.txt", "file4.txt")).toBe(false);
    expect(m("{src,lib}/**/*.test.ts", "lib/a/b.test.ts")).toBe(true);
  });

  it("ドットファイルは既定で * に一致しない", () => {
    expect(m("*", ".env")).toBe(false);
    expect(m("*", ".env", true)).toBe(true);
    expect(m(".*", ".env")).toBe(true);
    expect(m("**/*.js", "src/.hidden/a.js")).toBe(true);
  });

  it("! で除外し、最後に一致したパターンが優先される", () => {
    const patterns = ["**/*.ts", "!**/*.test.ts", "src/keep.test.ts"];
    expect(evaluateGlobs(patterns, "src/a.ts")).toEqual({ included: true, by: "**/*.ts" });
    expect(evaluateGlobs(patterns, "src/a.test.ts")).toEqual({ included: false, by: "!**/*.test.ts" });
    expect(evaluateGlobs(patterns, "src/keep.test.ts")).toEqual({ included: true, by: "src/keep.test.ts" });
    expect(evaluateGlobs(patterns, "README.md")).toEqual({ included: false, by: null });
  });
});
