"use client";

/**
 * ツールページはすべてのツールで1つのルートを共有しているため、静的に読み込むと全ツールのコードが
 * 各ページの初期バンドルに含まれる。ここで next/dynamic を使い、そのツールのページでだけ読み込む。
 * （Server Component からの dynamic ではコード分割されないため、Client Component で行う）
 */
import dynamic from "next/dynamic";

export const ExcelConverterTool = dynamic(() => import("@/components/tools/excel-converter-tool").then((m) => m.ExcelConverterTool));
export const OcrTool = dynamic(() => import("@/components/tools/ocr-tool").then((m) => m.OcrTool));
export const InvoiceGeneratorTool = dynamic(() =>
  import("@/components/tools/invoice-generator-tool").then((m) => m.InvoiceGeneratorTool)
);
export const CurlConverterTool = dynamic(() => import("@/components/tools/curl-converter-tool").then((m) => m.CurlConverterTool));
export const CodeFormatterTool = dynamic(() => import("@/components/tools/code-formatter-tool").then((m) => m.CodeFormatterTool));
export const MermaidEditorTool = dynamic(() => import("@/components/tools/mermaid-editor-tool").then((m) => m.MermaidEditorTool));
export const TextNormalizerTool = dynamic(() => import("@/components/tools/text-normalizer-tool").then((m) => m.TextNormalizerTool));
export const VideoConverterTool = dynamic(() => import("@/components/tools/video-converter-tool").then((m) => m.VideoConverterTool));
export const BackgroundRemoverTool = dynamic(() =>
  import("@/components/tools/background-remover-tool").then((m) => m.BackgroundRemoverTool)
);
