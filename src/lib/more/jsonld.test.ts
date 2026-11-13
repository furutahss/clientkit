import { describe, expect, it } from "vitest";

import { validateJsonLd } from "./jsonld";

const en = (_: string, e: string) => e;
const wrap = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;

describe("JSON-LD検証", () => {
  it("必須・推奨・日付形式を検査する", () => {
    const { findings } = validateJsonLd(wrap({ "@context": "https://schema.org", "@type": "Article", datePublished: "yesterday" }), en);
    expect(findings.filter((f) => f.level === "error").map((f) => f.message)).toEqual(["Required property headline is missing.", "datePublished is not ISO 8601 (yesterday)."]);
  });

  it("@graph とFAQの構造を検査する", () => {
    const ok = { "@context": "https://schema.org", "@graph": [{ "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "Q", acceptedAnswer: { "@type": "Answer", text: "A" } }] }] };
    expect(validateJsonLd(wrap(ok), en).findings[0].level).toBe("ok");
    const bad = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{ name: "Q" }] };
    expect(validateJsonLd(wrap(bad), en).findings.some((f) => f.level === "error")).toBe(true);
  });

  it("JSON構文エラーと未検出を報告する", () => {
    expect(validateJsonLd("<script type=\"application/ld+json\">{</script>", en).findings[0].message).toMatch(/Cannot parse/);
    expect(validateJsonLd("plain", en).findings[0].level).toBe("error");
  });
});
