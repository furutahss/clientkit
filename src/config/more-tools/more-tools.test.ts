import { describe, expect, it } from "vitest";

import { CUSTOM_IDS, SPEC_IDS } from "@/components/tools/more/spec-ids";
import { specs as code } from "@/components/tools/more/specs/code";
import { specs as data } from "@/components/tools/more/specs/data";
import { specs as media } from "@/components/tools/more/specs/media";
import { specs as security } from "@/components/tools/more/specs/security";
import { specs as text } from "@/components/tools/more/specs/text";
import { specs as web } from "@/components/tools/more/specs/web";

import { moreGuides, moreTools } from ".";
import { categories, searchTools, tools } from "../tools";

const modules = { web, security, data, text, code, media };

describe("追加ツールの登録", () => {
  const specIds = Object.values(SPEC_IDS).flat() as string[];

  it("すべてのツールに、設定（ToolSpec）か専用コンポーネントのどちらか一方がある", () => {
    const registered = [...specIds, ...CUSTOM_IDS].sort();
    expect(registered).toEqual(moreTools.map((t) => t.id).sort());
    expect(new Set(registered).size).toBe(registered.length);
  });

  it("グループごとのspecsにIDが過不足なくある", () => {
    for (const [group, ids] of Object.entries(SPEC_IDS)) {
      expect(Object.keys(modules[group as keyof typeof modules]).sort(), group).toEqual([...ids].sort());
    }
  });

  it("既存のツールとIDが重複せず、有効なカテゴリに属する", () => {
    expect(new Set(tools.map((t) => t.id)).size).toBe(tools.length);
    for (const t of moreTools) {
      expect(categories.some((c) => c.id === t.category), t.id).toBe(true);
      expect(t.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("SEO基準: FAQは3〜5件、日英の説明と使い方3手順、解説2段落が揃う", () => {
    for (const t of moreTools) {
      expect(t.faq.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.faq.length, t.id).toBeLessThanOrEqual(5);
      for (const lang of ["ja", "en"] as const) {
        expect(t.name[lang], t.id).toBeTruthy();
        expect(t.howToUse[lang].length, `${t.id} ${lang}`).toBeGreaterThanOrEqual(3);
        expect(moreGuides[t.id][lang], `${t.id} ${lang}`).toHaveLength(2);
        expect(t.faq.every((f) => f.question[lang] && f.answer[lang]), t.id).toBe(true);
      }
    }
  });

  it("日本語・英語のキーワードで目的のツールが先頭に出る", () => {
    for (const [locale, query, id] of [
      ["ja", "jq", "jq-playground"],
      ["en", "jq", "jq-playground"],
      ["ja", "文字化け", "encoding-converter"],
      ["en", "mojibake", "encoding-converter"],
      ["ja", "詳細度", "css-specificity"],
      ["en", "webhook signature", "webhook-signature"],
      ["ja", "SPF DMARC", "email-auth-checker"],
      ["en", "terraform plan", "terraform-plan-viewer"],
      ["ja", "ロックファイル 差分", "lockfile-diff"],
      ["en", "ipv6", "ipv6-calculator"],
    ] as const) expect(searchTools(locale, query)[0]?.id, `${locale}: ${query}`).toBe(id);
  });
});
