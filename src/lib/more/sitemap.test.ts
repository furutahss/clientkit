import { describe, expect, it } from "vitest";

import { validateSitemap } from "./sitemap";

const en = (_: string, e: string) => e;
const ns = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

describe("sitemap.xml検証", () => {
  it("正しいサイトマップは問題なし", () => {
    const r = validateSitemap(`<urlset ${ns}><url><loc>https://a.com/</loc><lastmod>2026-01-02</lastmod><priority>0.5</priority></url></urlset>`, en);
    expect(r.findings).toEqual([{ level: "ok", target: "-", message: "No problems found." }]);
    expect(r.count).toBe(1);
  });

  it("重複・相対URL・日付・&・ホスト混在を検出する", () => {
    const r = validateSitemap(`<urlset ${ns}><url><loc>https://a.com/?a=1&b=2</loc><lastmod>01/02/2026</lastmod></url><url><loc>/rel</loc></url><url><loc>https://b.com/</loc></url><url><loc>https://b.com/</loc></url></urlset>`, en);
    const msgs = r.findings.map((f) => f.message).join("|");
    for (const w of ["not escaped", "W3C", "absolute", "duplicated", "Multiple hosts"]) expect(msgs).toContain(w);
  });

  it("sitemapindexとXML以外を判別する", () => {
    expect(validateSitemap(`<sitemapindex ${ns}><sitemap><loc>https://a.com/s.xml</loc></sitemap></sitemapindex>`, en).kind).toBe("index");
    expect(validateSitemap("hello", en).kind).toBe("unknown");
  });
});
