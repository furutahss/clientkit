import type { ComponentType } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Base64Tool } from "@/components/tools/base64-tool";
import { CertificateDecoderTool } from "@/components/tools/certificate-decoder-tool";
import { CharacterCountTool } from "@/components/tools/character-count-tool";
import { ChmodCalculatorTool } from "@/components/tools/chmod-calculator-tool";
import { CidrCalculatorTool } from "@/components/tools/cidr-calculator-tool";
import { ColorConverterTool } from "@/components/tools/color-converter-tool";
import { CronExplainerTool } from "@/components/tools/cron-explainer-tool";
import { CsvEditorTool } from "@/components/tools/csv-editor-tool";
import { CsvJsonConverterTool } from "@/components/tools/csv-json-converter-tool";
import { CsvReconcileTool } from "@/components/tools/csv-reconcile-tool";
import { DataFormatConverterTool } from "@/components/tools/data-format-converter-tool";
import { EnvCompareTool } from "@/components/tools/env-compare-tool";
import { ExifRemoverTool } from "@/components/tools/exif-remover-tool";
import { FaviconGeneratorTool } from "@/components/tools/favicon-generator-tool";
import { FolderTreeTool } from "@/components/tools/folder-tree-tool";
import { GitignoreTesterTool } from "@/components/tools/gitignore-tester-tool";
import { HarAnalyzerTool } from "@/components/tools/har-analyzer-tool";
import { HashGeneratorTool } from "@/components/tools/hash-generator-tool";
import { HexViewerTool } from "@/components/tools/hex-viewer-tool";
import { I18nPlaceholderCheckerTool } from "@/components/tools/i18n-placeholder-checker-tool";
import { IdGeneratorTool } from "@/components/tools/id-generator-tool";
import { ImageConverterTool } from "@/components/tools/image-converter-tool";
import { ImageDiffTool } from "@/components/tools/image-diff-tool";
import { JsonDiffTool } from "@/components/tools/json-diff-tool";
import { JsonFormatterTool } from "@/components/tools/json-formatter-tool";
import { JsonSchemaGeneratorTool } from "@/components/tools/json-schema-generator-tool";
import { JsonSchemaValidatorTool } from "@/components/tools/json-schema-validator-tool";
import { JsonPathTesterTool } from "@/components/tools/jsonpath-tester-tool";
import {
  BackgroundRemoverTool,
  CodeFormatterTool,
  CurlConverterTool,
  ExcelConverterTool,
  InvoiceGeneratorTool,
  MermaidEditorTool,
  OcrTool,
  PasswordHashTool,
  TexImageTool,
  TextNormalizerTool,
  VideoConverterTool,
} from "@/components/tools/lazy-tools";
import { JwtDecoderTool } from "@/components/tools/jwt-decoder-tool";
import { LogMaskerTool } from "@/components/tools/log-masker-tool";
import { MarkdownEditorTool } from "@/components/tools/markdown-editor-tool";
import { MockRepoGeneratorTool } from "@/components/tools/mock-repo-generator-tool";
import { OpenapiCompatTool } from "@/components/tools/openapi-compat-tool";
import { PdfToolkitTool } from "@/components/tools/pdf-toolkit-tool";
import { PgExplainViewerTool } from "@/components/tools/pg-explain-viewer-tool";
import { PrismaRepoGeneratorTool } from "@/components/tools/prisma-repo-generator-tool";
import { PrismaSchemaVisualizerTool } from "@/components/tools/prisma-schema-visualizer-tool";
import { PrismaZodGeneratorTool } from "@/components/tools/prisma-zod-generator-tool";
import { QrCodeTool } from "@/components/tools/qr-code-tool";
import { RegexTesterTool } from "@/components/tools/regex-tester-tool";
import { RobotsTxtTesterTool } from "@/components/tools/robots-txt-tester-tool";
import { ScreenshotEditorTool } from "@/components/tools/screenshot-editor-tool";
import { SemverRangeTool } from "@/components/tools/semver-range-tool";
import { SourceMapResolverTool } from "@/components/tools/source-map-resolver-tool";
import { SqlFormatterTool } from "@/components/tools/sql-formatter-tool";
import { SqlInsertGeneratorTool } from "@/components/tools/sql-insert-generator-tool";
import { SqlToPrismaTool } from "@/components/tools/sql-to-prisma-tool";
import { SvgOptimizerTool } from "@/components/tools/svg-optimizer-tool";
import { TextDiffTool } from "@/components/tools/text-diff-tool";
import { TimestampConverterTool } from "@/components/tools/timestamp-converter-tool";
import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { RelatedTools } from "@/components/tools/related-tools";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { UnicodeInspectorTool } from "@/components/tools/unicode-inspector-tool";
import { UrlEncoderTool } from "@/components/tools/url-encoder-tool";
import { localizedAlternates } from "@/config/seo";
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
  "csv-editor": CsvEditorTool,
  "regex-tester": RegexTesterTool,
  "url-encoder": UrlEncoderTool,
  "hash-generator": HashGeneratorTool,
  "hex-viewer": HexViewerTool,
  "password-hash": PasswordHashTool,
  "sql-formatter": SqlFormatterTool,
  "color-converter": ColorConverterTool,
  "jwt-decoder": JwtDecoderTool,
  "markdown-editor": MarkdownEditorTool,
  "har-analyzer": HarAnalyzerTool,
  "prisma-repo-generator": PrismaRepoGeneratorTool,
  "prisma-schema-visualizer": PrismaSchemaVisualizerTool,
  "mock-repo-generator": MockRepoGeneratorTool,
  "screenshot-editor": ScreenshotEditorTool,
  "pdf-toolkit": PdfToolkitTool,
  "exif-remover": ExifRemoverTool,
  "text-diff": TextDiffTool,
  "log-masker": LogMaskerTool,
  "id-generator": IdGeneratorTool,
  "timestamp-converter": TimestampConverterTool,
  "cron-explainer": CronExplainerTool,
  "data-format-converter": DataFormatConverterTool,
  "jsonpath-tester": JsonPathTesterTool,
  "certificate-decoder": CertificateDecoderTool,
  "prisma-zod-generator": PrismaZodGeneratorTool,
  "sql-to-prisma": SqlToPrismaTool,
  "favicon-generator": FaviconGeneratorTool,
  "svg-optimizer": SvgOptimizerTool,
  "qr-code": QrCodeTool,
  "folder-tree": FolderTreeTool,
  "excel-converter": ExcelConverterTool,
  "ocr": OcrTool,
  "invoice-generator": InvoiceGeneratorTool,
  "curl-converter": CurlConverterTool,
  "code-formatter": CodeFormatterTool,
  "mermaid-editor": MermaidEditorTool,
  "text-normalizer": TextNormalizerTool,
  "video-converter": VideoConverterTool,
  "background-remover": BackgroundRemoverTool,
  "unicode-inspector": UnicodeInspectorTool,
  "json-diff": JsonDiffTool,
  "json-schema-validator": JsonSchemaValidatorTool,
  "env-compare": EnvCompareTool,
  "csv-reconcile": CsvReconcileTool,
  "image-diff": ImageDiffTool,
  "sql-insert-generator": SqlInsertGeneratorTool,
  "chmod-calculator": ChmodCalculatorTool,
  "cidr-calculator": CidrCalculatorTool,
  "gitignore-tester": GitignoreTesterTool,
  "i18n-placeholder-checker": I18nPlaceholderCheckerTool,
  "json-schema-generator": JsonSchemaGeneratorTool,
  "openapi-compat": OpenapiCompatTool,
  "pg-explain-viewer": PgExplainViewerTool,
  "robots-txt-tester": RobotsTxtTesterTool,
  "semver-range": SemverRangeTool,
  "source-map-resolver": SourceMapResolverTool,
  "tex-image": TexImageTool,
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
    alternates: localizedAlternates(lang, `/tools/${tool.id}`),
    openGraph: {
      title: tool.name[lang],
      description,
      url: `${siteConfig.url}/${lang}/tools/${tool.id}`,
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
      <RelatedTools tool={tool} lang={lang} />
    </div>
  );
}
