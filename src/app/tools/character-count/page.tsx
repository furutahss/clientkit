import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CharacterCountTool } from "@/components/tools/character-count-tool";
import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { getToolById } from "@/config/tools";

const TOOL_ID = "character-count";

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

export default function CharacterCountPage() {
  const tool = getToolById(TOOL_ID);
  if (!tool) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} />
      <CharacterCountTool />
      <ToolContentSections
        howToUse={[
          "テキストエリアに文字数を計測したい文章を入力または貼り付けます。",
          "入力と同時に、文字数・文字数（空白除く）・単語数・行数・バイト数（UTF-8）がリアルタイムに更新されます。",
          "「クリップボードへコピー」で入力したテキストをコピーしたり、「クリア」で入力内容をリセットしたりできます。",
        ]}
        about={{
          paragraphs: [
            "文字数カウントツールは、入力したテキストの文字数・単語数・行数・バイト数をブラウザ上でリアルタイムに計測できるツールです。Webサイトの原稿執筆、SNS投稿の文字数制限チェック、レポートや論文の文字数確認など、さまざまな場面で活用できます。",
            "「文字数」はテキスト全体の文字数、「文字数（空白除く）」はスペースや改行を除いた文字数です。「バイト数（UTF-8）」は、日本語などの全角文字が1文字あたり複数バイトになることを考慮した、実際のファイルサイズやデータ量の目安として利用できます。",
          ],
        }}
        faqs={[
          {
            question: "改行やスペースも文字数としてカウントされますか？",
            answer:
              "「文字数」には改行やスペースも含まれます。それらを除いた文字数を確認したい場合は「文字数（空白除く）」の数値をご覧ください。",
          },
          {
            question: "バイト数はどのように計算されていますか？",
            answer:
              "UTF-8エンコーディングでテキストをバイト列に変換した際のバイト数を計算しています。半角英数字は1文字1バイトですが、日本語などの全角文字は1文字あたり3バイトになるため、文字数とバイト数は一致しません。",
          },
          {
            question: "単語数はどのように数えていますか？",
            answer:
              "空白文字（スペースや改行）で区切られたまとまりの数を単語数として数えています。日本語のように単語間にスペースを入れない文章では、文全体が1つの単語として数えられる点にご注意ください。",
          },
          {
            question: "入力したテキストはサーバーに送信されますか？",
            answer:
              "送信されません。文字数のカウントはすべてブラウザ内のJavaScriptで行われます。",
          },
        ]}
      />
    </div>
  );
}
