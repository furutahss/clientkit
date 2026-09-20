import type { ComponentType } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Base64Tool } from "@/components/tools/base64-tool";
import { CharacterCountTool } from "@/components/tools/character-count-tool";
import { ColorConverterTool } from "@/components/tools/color-converter-tool";
import { CsvJsonConverterTool } from "@/components/tools/csv-json-converter-tool";
import { HarAnalyzerTool } from "@/components/tools/har-analyzer-tool";
import { HashGeneratorTool } from "@/components/tools/hash-generator-tool";
import { ImageConverterTool } from "@/components/tools/image-converter-tool";
import { JsonFormatterTool } from "@/components/tools/json-formatter-tool";
import { JwtDecoderTool } from "@/components/tools/jwt-decoder-tool";
import { MarkdownEditorTool } from "@/components/tools/markdown-editor-tool";
import { MockRepoGeneratorTool } from "@/components/tools/mock-repo-generator-tool";
import { PrismaRepoGeneratorTool } from "@/components/tools/prisma-repo-generator-tool";
import { PrismaSchemaVisualizerTool } from "@/components/tools/prisma-schema-visualizer-tool";
import { RegexTesterTool } from "@/components/tools/regex-tester-tool";
import { SqlFormatterTool } from "@/components/tools/sql-formatter-tool";
import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { UrlEncoderTool } from "@/components/tools/url-encoder-tool";
import { siteConfig } from "@/config/site";
import { getToolById, tools } from "@/config/tools";
import { ogImage } from "@/config/og-image";
import { locales, type Locale } from "@/i18n/config";

const toolComponents: Record<string, ComponentType> = {
  "character-count": CharacterCountTool,
  base64: Base64Tool,
  "json-formatter": JsonFormatterTool,
  "image-converter": ImageConverterTool,
  "csv-json-converter": CsvJsonConverterTool,
  "regex-tester": RegexTesterTool,
  "url-encoder": UrlEncoderTool,
  "hash-generator": HashGeneratorTool,
  "sql-formatter": SqlFormatterTool,
  "color-converter": ColorConverterTool,
  "jwt-decoder": JwtDecoderTool,
  "markdown-editor": MarkdownEditorTool,
  "har-analyzer": HarAnalyzerTool,
  "prisma-repo-generator": PrismaRepoGeneratorTool,
  "prisma-schema-visualizer": PrismaSchemaVisualizerTool,
  "mock-repo-generator": MockRepoGeneratorTool,
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
      images: [{ ...ogImage, alt: siteConfig.name }],
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

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} lang={lang} />
      <ToolComponent />
      <ToolContentSections
        lang={lang}
        howToUse={tool.howToUse[lang]}
        about={{
          heading: tool.about.heading?.[lang],
          paragraphs: tool.about.paragraphs[lang],
        }}
        faqs={tool.faq.map((item) => ({
          question: item.question[lang],
          answer: item.answer[lang],
        }))}
      />
    </div>
  );
}
