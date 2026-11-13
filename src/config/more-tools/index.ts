import type { LocalizedTextArray, Tool } from "@/config/tools";

import type { MoreTool } from "./define";
import { codeMeta } from "./code";
import { dataMeta } from "./data";
import { mediaMeta } from "./media";
import { extraFaq } from "./faq-extra";
import { securityMeta } from "./security";
import { textMeta } from "./text";
import { webMeta } from "./web";

const groups: MoreTool[][] = [webMeta, securityMeta, dataMeta, textMeta, codeMeta, mediaMeta];

export const moreTools: Tool[] = groups.flat().map((m) => {
  const extra = extraFaq[m.tool.id];
  if (!extra) return m.tool;
  const [qj, aj, qe, ae] = extra;
  return { ...m.tool, faq: [...m.tool.faq, { question: { ja: qj, en: qe }, answer: { ja: aj, en: ae } }] };
});
export const moreGuides: Record<string, LocalizedTextArray> = Object.fromEntries(
  groups.flat().map((m) => [m.tool.id, m.guide]),
);
