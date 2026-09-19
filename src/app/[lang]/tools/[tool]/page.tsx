import type { ComponentType } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Base64Tool } from "@/components/tools/base64-tool";
import { CharacterCountTool } from "@/components/tools/character-count-tool";
import { ToolFaq } from "@/components/tools/tool-faq";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { getToolById, tools } from "@/config/tools";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

const toolComponents: Record<string, ComponentType> = {
  base64: Base64Tool,
  "character-count": CharacterCountTool,
};

export function generateStaticParams() {
  return locales.flatMap((lang) =>
    tools.map((tool) => ({ lang, tool: tool.id }))
  );
}

export async function generateMetadata(
  props: PageProps<"/[lang]/tools/[tool]">
): Promise<Metadata> {
  const { lang, tool: toolId } = (await props.params) as {
    lang: Locale;
    tool: string;
  };
  const tool = getToolById(toolId);
  if (!tool) return {};

  const description = tool.longDescription?.[lang] ?? tool.description[lang];

  return {
    title: tool.name[lang],
    description,
    openGraph: {
      title: tool.name[lang],
      description,
    },
  };
}

export default async function ToolPage(
  props: PageProps<"/[lang]/tools/[tool]">
) {
  const { lang, tool: toolId } = (await props.params) as {
    lang: Locale;
    tool: string;
  };
  const tool = getToolById(toolId);
  if (!tool) notFound();

  const ToolComponent = toolComponents[tool.id];
  if (!ToolComponent) notFound();

  const dict = getDictionary(lang);

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} lang={lang} />
      <ToolComponent />
      {tool.usage && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">
            {dict.toolPage.usageHeading}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tool.usage[lang]}
          </p>
        </section>
      )}
      {tool.faq && tool.faq.length > 0 && (
        <ToolFaq lang={lang} faq={tool.faq} />
      )}
    </div>
  );
}
