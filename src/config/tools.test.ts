import { describe, expect, it } from "vitest";

import { categories, getToolsForFile, searchTools, tools } from "./tools";

describe("ツール検索", () => {
  it.each([
    ["ja", "ＰＤＦ　分割", "pdf-toolkit"],
    ["ja", "画像 軽く", "image-converter"],
    ["ja", "写真 小さく", "image-converter"],
    ["ja", "Character Count", "character-count"],
    ["en", "文字数", "character-count"],
    ["en", "jpg resize", "image-converter"],
    ["ja", "UUID生成", "uuid-generator"],
    ["ja", "argon2id", "password-hash"],
    ["en", "bcrypt", "password-hash"],
    ["ja", "sha3", "hash-generator"],
  ] as const)("%s: %s の最適なツールを先頭に表示する", (locale, query, id) => {
    expect(searchTools(locale, query)[0]?.id).toBe(id);
  });

  it("複数語すべてに一致するツールだけを返す", () => {
    expect(searchTools("ja", "PDF 存在しない用途")).toEqual([]);
    expect(searchTools("ja", "  ")).toEqual(tools);
  });
});

describe("分類とファイルからの検索", () => {
  it("全ツールに有効な分類と一意のIDがある", () => {
    expect(new Set(tools.map((tool) => tool.id)).size).toBe(tools.length);
    expect(
      tools.every((tool) => categories.some((c) => c.id === tool.category)),
    ).toBe(true);
  });

  it("画像やPDFのツールが対象別にまとまる", () => {
    expect(tools.find((tool) => tool.id === "image-converter")?.category).toBe(
      "media",
    );
    expect(tools.find((tool) => tool.id === "pdf-toolkit")?.category).toBe(
      "document",
    );
  });

  it("PDFファイルから対応ツールを探せる", () => {
    expect(
      getToolsForFile({ name: "sample.pdf", type: "application/pdf" })[0]?.id,
    ).toBe("pdf-toolkit");
  });
});
