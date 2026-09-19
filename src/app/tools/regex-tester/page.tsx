import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RegexTesterTool } from "@/components/tools/regex-tester-tool";
import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { getToolById } from "@/config/tools";

const TOOL_ID = "regex-tester";

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

export default function RegexTesterPage() {
  const tool = getToolById(TOOL_ID);
  if (!tool) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} />
      <RegexTesterTool />
      <ToolContentSections
        howToUse={[
          "パターン欄に正規表現を入力するか、右側の「よく使うパターン」からプリセットを選択します。",
          "g・i・m・s・uの各フラグをクリックしてON/OFFを切り替えます。gを有効にすると全マッチを検索します。",
          "対象テキスト欄に検索したいテキストを入力すると、マッチ箇所が右側にリアルタイムでハイライト表示されます。",
          "下部の「マッチ一覧」でマッチ位置・マッチ文字列・キャプチャグループを確認し、「クリップボードへコピー」で抽出結果を改行区切りでコピーできます。",
        ]}
        about={{
          paragraphs: [
            "正規表現テスト・テキスト抽出ツールは、JavaScriptの正規表現をブラウザ上で試しながら、テキストからのパターン抽出結果をその場で確認できるツールです。ログファイルからの情報抽出、フォームの入力値検証、データクレンジングなど、正規表現を使うさまざまな作業の動作確認に活用できます。",
            "g・i・m・s・uといった主要なフラグの切り替えに対応しており、gフラグを外した場合は実際のJavaScriptの挙動と同じく最初のマッチのみが検出されます。マッチした文字列は元のテキスト上でハイライト表示されるため、意図した箇所を正しく抽出できているかを視覚的に確認できます。",
            "メールアドレスやURL、電話番号など、実務でよく使われる正規表現パターンをプリセットとして用意しているため、ゼロからパターンを書かなくても目的のパターンをすぐに試すことができます。",
          ],
        }}
        faqs={[
          {
            question: "名前付きキャプチャグループには対応していますか？",
            answer:
              "対応しています。「(?<name>パターン)」のように名前付きグループを使用すると、マッチ一覧に「name: 値」の形式で表示されます。",
          },
          {
            question: "gフラグを外すとどうなりますか？",
            answer:
              "実際のJavaScriptの正規表現と同じ挙動になり、最初にマッチした1件のみが検出されます。複数のマッチをすべて確認したい場合はgフラグを有効にしてください。",
          },
          {
            question: "無効な正規表現を入力するとどうなりますか？",
            answer:
              "パターンの下にエラーメッセージが表示され、マッチ処理は行われません。括弧の対応やエスケープを見直してください。",
          },
          {
            question: "入力したテキストはサーバーに送信されますか？",
            answer:
              "送信されません。正規表現の評価とマッチングはすべてブラウザ内のJavaScriptエンジンで実行されます。",
          },
        ]}
      />
    </div>
  );
}
