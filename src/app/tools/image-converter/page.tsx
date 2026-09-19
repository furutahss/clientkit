import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ImageConverterTool } from "@/components/tools/image-converter-tool";
import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { getToolById } from "@/config/tools";

const TOOL_ID = "image-converter";

export function generateMetadata(): Metadata {
  const tool = getToolById(TOOL_ID);
  if (!tool) return {};

  return {
    title: tool.name,
    description: tool.longDescription ?? tool.description,
    openGraph: {
      title: tool.name,
      description: tool.longDescription ?? tool.description,
    },
  };
}

export default function ImageConverterPage() {
  const tool = getToolById(TOOL_ID);
  if (!tool) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} />
      <ImageConverterTool />
      <ToolContentSections
        howToUse={[
          "画像ファイルをドラッグ＆ドロップするか、クリックしてファイルを選択します（PNG・JPEG・WebP・GIF・BMP・AVIFに対応）。",
          "出力フォーマット（JPEG・PNG・WebP）を選び、画質（圧縮率）のスライダーを調整します。PNGを選択した場合、ロスレス形式のため画質スライダーは無効になります。",
          "リサイズしたい場合は、幅・高さのスライダーまたは数値入力で調整します。「アスペクト比を維持」をONにすると、片方を変更するともう片方が自動的に追従します。",
          "元のサイズ・圧縮後の想定サイズ・削減率とプレビューを確認しながら、「圧縮画像をダウンロード」でファイルを保存します。",
        ]}
        about={{
          paragraphs: [
            "画像圧縮・フォーマット変換ツールは、画像ファイルをJPEG・PNG・WebP形式に変換し、画質やサイズを調整しながら圧縮できるツールです。Webサイトに掲載する画像の軽量化や、異なる形式への変換が必要な場合に活用できます。",
            "Canvas APIの`toBlob`を使用して、フォーマットや画質・リサイズの設定を変更するたびに非同期で圧縮結果を再生成し、元のサイズとの比較や削減率をリアルタイムに確認できます。",
            "お使いのブラウザが選択した出力フォーマットのエンコードに対応していない場合（一部のSafari/WebKit系ブラウザでのWebP出力など）は、その旨を警告として表示し、実際に生成されたフォーマットに応じてダウンロード時の拡張子を自動調整します。",
          ],
        }}
        faqs={[
          {
            question: "WebPを選んだのにPNGと同じサイズになるのはなぜですか？",
            answer:
              "一部のブラウザ（主にSafariなどのWebKit系）はCanvas APIによるWebPへの変換に対応しておらず、その場合は仕様により自動的にPNG（ロスレス）として出力されます。この場合、画面上に「お使いのブラウザは対応していないため〜で出力されています」という警告が表示されます。Chromeなど対応ブラウザでは正しくWebPとして圧縮されます。",
          },
          {
            question: "画質スライダーがPNG選択時に操作できません。",
            answer:
              "PNGはロスレス（可逆）圧縮のため、画質（圧縮率）の概念が存在せず、スライダーを操作してもファイルサイズは変化しません。サイズを小さくしたい場合はリサイズ機能をご利用ください。",
          },
          {
            question: "アスペクト比を維持せずに画像を変形できますか？",
            answer:
              "「アスペクト比を維持」のチェックを外すと、幅と高さを独立して指定できるようになり、意図的に画像を引き伸ばす・押しつぶすこともできます。",
          },
          {
            question: "画像はサーバーにアップロードされますか？",
            answer:
              "アップロードされません。画像の読み込み・圧縮・プレビュー生成はすべてブラウザ内のCanvas APIで処理されます。",
          },
        ]}
      />
    </div>
  );
}
