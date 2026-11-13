import { describe, expect, it } from "vitest";

import { checkPackageJson } from "./package-json-check";

const en = (_: string, e: string) => e;
const check = (o: unknown) => checkPackageJson(JSON.stringify(o), en);

describe("package.jsonチェック", () => {
  it("重複・範囲の矛盾・不正な範囲・ワイルドカードを検出する", () => {
    const f = check({ version: "1.0.0", license: "MIT", engines: {}, dependencies: { a: "^1.0.0", b: "^1.0.0", c: "*", d: "not a range", e: "latest", g: "github:x/y" }, devDependencies: { a: "^1.0.0", b: "^2.0.0" } });
    const by = (t: string) => f.filter((x) => x.target === t);
    expect(by("a")[0].message).toMatch(/same range/);
    expect(by("b")[0].level).toBe("error");
    expect(by("c")[0].message).toMatch(/any version/);
    expect(by("d")[0]).toMatchObject({ level: "error" });
    expect(by("e")[0].level).toBe("warn");
    expect(by("g")[0].level).toBe("info");
  });

  it("開発ツール・0.x・メタ情報を指摘する", () => {
    const f = check({ private: true, dependencies: { typescript: "^5.0.0", "@types/node": "^20", x: "^0.3.0" } });
    expect(f.filter((x) => /devDependencies/.test(x.message)).map((x) => x.target)).toEqual(["typescript", "@types/node"]);
    expect(f.some((x) => x.target === "x" && /0\.x/.test(x.message))).toBe(true);
    expect(f.map((x) => x.target)).toEqual(expect.arrayContaining(["license", "engines"]));
  });

  it("問題がなければその旨を返す", () => {
    expect(check({ version: "1.0.0", license: "MIT", engines: { node: ">=18" }, dependencies: { a: "^1.2.3" } })).toEqual([{ level: "info", target: "-", message: "No obvious problems found." }]);
    expect(() => checkPackageJson("{", en)).toThrow();
  });
});
