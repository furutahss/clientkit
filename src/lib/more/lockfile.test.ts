import { describe, expect, it } from "vitest";

import { diffLockfiles, readLockfile } from "./lockfile";

const npmV3 = (pkgs: Record<string, string>) => JSON.stringify({ lockfileVersion: 3, packages: { "": { name: "app" }, ...Object.fromEntries(Object.entries(pkgs).map(([p, v]) => [p, { version: v }])) } });

describe("ロックファイル差分", () => {
  it("npm（v3）の追加・削除・変更とバンプ種別を出す", () => {
    const a = readLockfile(npmV3({ "node_modules/a": "1.2.3", "node_modules/b": "2.0.0", "node_modules/c": "1.0.0", "node_modules/x/node_modules/a": "1.0.0" })).map;
    const b = readLockfile(npmV3({ "node_modules/a": "1.3.0", "node_modules/c": "0.9.0", "node_modules/d": "1.0.0", "node_modules/x/node_modules/a": "1.0.0" })).map;
    const d = Object.fromEntries(diffLockfiles(a, b).map((c) => [c.name, c]));
    expect(d.a).toMatchObject({ kind: "changed", from: ["1.0.0", "1.2.3"], to: ["1.0.0", "1.3.0"], bump: "minor" });
    expect(d.b.kind).toBe("removed");
    expect(d.d.kind).toBe("added");
    expect(d.c.bump).toBe("downgrade (major)");
  });

  it("npm v1・yarn classic・yarn berry・pnpm を読む", () => {
    expect([...readLockfile(JSON.stringify({ dependencies: { a: { version: "1.0.0", dependencies: { b: { version: "2.0.0" } } } } })).map.keys()]).toEqual(["a", "b"]);
    const yarn1 = readLockfile('# yarn lockfile v1\n\n"@scope/a@^1.0.0", "@scope/a@^1.1.0":\n  version "1.2.0"\n  resolved "x"\n\nb@^2.0.0:\n  version "2.0.1"\n');
    expect(yarn1.format).toBe("yarn1");
    expect([...yarn1.map.get("@scope/a")!]).toEqual(["1.2.0"]);
    const berry = readLockfile('__metadata:\n  version: 8\n\n"a@npm:^1.0.0, a@npm:^1.1.0":\n  version: 1.2.0\n\n"app@workspace:.":\n  version: 0.0.0-use.local\n');
    expect(berry).toMatchObject({ format: "yarn-berry" });
    expect([...berry.map.keys()]).toEqual(["a"]);
    const pnpm = readLockfile("lockfileVersion: '9.0'\npackages:\n  a@1.0.0:\n    resolution: {}\n  '@s/b@2.0.0(react@18.0.0)':\n    resolution: {}\n");
    expect(pnpm.format).toBe("pnpm");
    expect([...pnpm.map.get("@s/b")!]).toEqual(["2.0.0"]);
  });

  it("認識できない形式は例外にする", () => {
    expect(() => readLockfile("hello: world")).toThrow("unrecognized lockfile");
    expect(() => readLockfile("{}")).toThrow("unrecognized lockfile");
  });
});
