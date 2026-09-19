import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Base64Tool } from "@/components/tools/base64-tool";
import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { getToolById } from "@/config/tools";

const TOOL_ID = "base64";

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

export default function Base64Page() {
  const tool = getToolById(TOOL_ID);
  if (!tool) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} />
      <Base64Tool />
      <ToolContentSections
        howToUse={[
          "「エンコード」または「デコード」を選択します。",
          "エンコードの場合は変換したいテキストを、デコードの場合はBase64文字列を入力欄に貼り付けます。",
          "結果は即座に下の欄に表示されます。「結果を入力欄に反映して切り替え」で、出力結果をそのまま逆方向の変換に使うこともできます。",
          "「クリップボードへコピー」で結果をコピー、「クリア」で入力内容をリセットできます。",
        ]}
        about={{
          paragraphs: [
            "Base64変換ツールは、テキストをBase64形式にエンコードしたり、Base64文字列を元のテキストにデコードしたりできるツールです。メールの添付ファイルやAPIのレスポンス、設定ファイルの中などでBase64エンコードされたデータを扱う際の確認・変換作業に活用できます。",
            "日本語などのマルチバイト文字にも対応しており、TextEncoder/TextDecoderを用いてUTF-8のバイト列を経由して変換するため、絵文字や日本語を含む文字列も正しくエンコード・デコードできます。",
          ],
        }}
        faqs={[
          {
            question: "日本語や絵文字を含む文字列もエンコードできますか？",
            answer:
              "できます。入力されたテキストはUTF-8のバイト列に変換した上でBase64エンコードされるため、日本語や絵文字を含む文字列も問題なく扱えます。",
          },
          {
            question: "デコードでエラーが出るのはなぜですか？",
            answer:
              "入力された文字列がBase64として不正な形式（使用できない文字が含まれる、長さが不正など）の場合にエラーが表示されます。コピー時に余分な文字や改行が混入していないか確認してください。",
          },
          {
            question: "URLセーフなBase64（Base64URL）には対応していますか？",
            answer:
              "現在は標準のBase64（+ と / を使用する形式）にのみ対応しています。Base64URL形式（- と _ を使用）の文字列は、標準形式に置き換えてから入力してください。",
          },
          {
            question: "入力したデータはサーバーに送信されますか？",
            answer:
              "送信されません。エンコード・デコードの処理はすべてブラウザ内のJavaScriptで行われます。",
          },
        ]}
      />
    </div>
  );
}
