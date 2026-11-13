import type { LucideIcon } from "lucide-react";

import type { FileMatch, LocalizedTextArray, Tool } from "@/config/tools";

/** 1言語分のツール説明。defineが日英をまとめてToolに変換する */
export type Copy = {
  name: string;
  desc: string;
  /** 使い方の手順（3つ程度） */
  steps: string[];
  /** ツールの解説 */
  about: string;
  /** 具体例（「具体例と制限」の1段落目） */
  example: string;
  /** 制限事項（2段落目） */
  limits: string;
  faq: [string, string][];
  keywords: string;
};

export type MoreTool = { tool: Tool; guide: LocalizedTextArray };

export function define(id: string, category: string, icon: LucideIcon, ja: Copy, en: Copy, fileMatch?: FileMatch): MoreTool {
  return {
    tool: {
      id,
      name: { ja: ja.name, en: en.name },
      description: { ja: ja.desc, en: en.desc },
      longDescription: { ja: `${ja.desc}${ja.about}`, en: `${en.desc} ${en.about}` },
      howToUse: { ja: ja.steps, en: en.steps },
      about: { paragraphs: { ja: [ja.about], en: [en.about] } },
      faq: ja.faq.map(([q, a], i) => ({
        question: { ja: q, en: en.faq[i][0] },
        answer: { ja: a, en: en.faq[i][1] },
      })),
      category,
      icon,
      keywords: { ja: ja.keywords, en: en.keywords },
      fileMatch,
    },
    guide: { ja: [ja.example, ja.limits], en: [en.example, en.limits] },
  };
}
