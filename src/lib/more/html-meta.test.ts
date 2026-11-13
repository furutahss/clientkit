import { describe, expect, it } from "vitest";

import { checkMeta, extractMeta } from "./html-meta";

const en = (_: string, e: string) => e;
const html = `<html lang="ja"><head><title>Hi &amp; bye</title>
<meta property="og:title" content="T"><meta name='description' content='D'>
<link rel="canonical" href="/x"></head></html>`;

describe("OGP・メタタグ", () => {
  it("タグを抽出する", () => {
    const m = extractMeta(html);
    expect(m.title).toBe("Hi & bye");
    expect(m.lang).toBe("ja");
    expect(m.tags).toEqual([{ key: "og:title", value: "T" }, { key: "description", value: "D" }]);
  });

  it("不足と相対URLを指摘する", () => {
    const f = checkMeta(extractMeta(html), en);
    expect(f.find((x) => x.item === "og:image")?.level).toBe("error");
    expect(f.find((x) => x.item === "canonical")?.message).toMatch(/absolute/);
  });
});
