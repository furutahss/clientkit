import { describe, expect, it } from "vitest";

import { analyzeBundle, groupName } from "./sourcemap-bundle";

const map = JSON.stringify({ version: 3, file: "out.js", sources: ["webpack://app/./src/a.js", "webpack://app/./node_modules/lodash/map.js"], names: [], mappings: "AAAA,KCAA" });

describe("バンドル内訳", () => {
  it("ソース名をパッケージ・ファイル単位にまとめる", () => {
    expect(groupName("webpack://app/./node_modules/@scope/pkg/dist/x.js?abc", "package")).toBe("@scope/pkg");
    expect(groupName("../node_modules/.pnpm/a/node_modules/react/index.js", "package")).toBe(".pnpm");
    expect(groupName("webpack://app/./src/a.js", "package")).toBe("(your code)");
    expect(groupName("webpack://app/./src/a.js", "file")).toBe("src/a.js");
  });

  it("生成ファイルがあれば、バイト数で按分する", () => {
    const r = analyzeBundle(map, "aaaaabbbbbbb", "package");
    expect(r.unit).toBe("bytes");
    expect(r.total).toBe(12);
    expect(r.entries.map((e) => [e.name, e.bytes, Math.round(e.percent)])).toEqual([["lodash", 7, 58], ["(your code)", 5, 42]]);
    expect(r.unmapped).toBe(0);
  });

  it("末尾の未マップ部分と、生成ファイルがない場合を扱う", () => {
    expect(analyzeBundle(map, "aaaaabbbbbbb\nxxxxx", "package").unmapped).toBe(6);
    const r = analyzeBundle(map, undefined, "file");
    expect(r.unit).toBe("chars");
    expect(r.entries).toHaveLength(2);
  });
});
