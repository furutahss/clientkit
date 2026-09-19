import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ColorConverterTool } from "@/components/tools/color-converter-tool";
import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { getToolById } from "@/config/tools";

const TOOL_ID = "color-converter";

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

export default function ColorConverterPage() {
  const tool = getToolById(TOOL_ID);
  if (!tool) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} />
      <ColorConverterTool />
      <ToolContentSections
        howToUse={[
          "カラーピッカーをクリックするか、HEX・RGB・HSL・HSV・CMYKのいずれかの欄に値を入力すると、他のすべての形式に自動で変換されます。",
          "各欄の右側のコピーボタンで、その形式の値をクリップボードにコピーできます。",
          "「コントラスト比判定」セクションで文字色と背景色を指定すると、WCAG 2.1に基づくコントラスト比と、AA/AAA基準のPass/Fail判定がサンプルテキストとともに表示されます。",
        ]}
        about={{
          paragraphs: [
            "カラーコード変換・アクセシビリティ判定ツールは、HEX・RGB・HSL・HSV・CMYKという5つの主要なカラー表記を相互に変換できるツールです。デザインツールとコードエディタで異なる表記が使われている場合の変換や、印刷用のCMYK値の確認などに活用できます。",
            "コントラスト比判定機能では、WCAG（Web Content Accessibility Guidelines）2.1で定められた計算式に基づき、2色間のコントラスト比を算出します。AA基準（通常テキストで4.5:1以上、大きいテキストで3:1以上）とAAA基準（通常テキストで7:1以上、大きいテキストで4.5:1以上）のそれぞれについて、Pass/Failをひと目で確認できます。",
            "Webサイトやアプリのテキストと背景色の組み合わせが、視覚に障害のあるユーザーにとっても読みやすいかどうかを、実装前に手軽にチェックするのに役立ちます。",
          ],
        }}
        faqs={[
          {
            question: "AAとAAAの基準はどう違いますか？",
            answer:
              "AAはWCAGの標準的な達成基準で、多くのWebサイトが目標とするレベルです。AAAはより厳しい基準で、より高いコントラストを要求します。公的機関のサイトなど、高いアクセシビリティが求められる場合にAAAが参照されることがあります。",
          },
          {
            question: "「大きいテキスト」とは具体的にどのくらいのサイズですか？",
            answer:
              "WCAGでは、18ポイント（24px相当）以上の通常のテキスト、または14ポイント（約18.66px相当）以上の太字のテキストを「大きいテキスト」として、やや緩やかな基準を適用します。",
          },
          {
            question: "CMYKへの変換は印刷用途でそのまま使えますか？",
            answer:
              "本ツールのCMYK変換は一般的な数式変換（デバイス非依存の簡易変換）であり、実際の印刷機やインクの特性は考慮していません。正確な色再現が必要な印刷用途では、印刷会社が提供するカラープロファイルでの確認をおすすめします。",
          },
          {
            question: "入力した色の情報はサーバーに送信されますか？",
            answer:
              "送信されません。色の変換やコントラスト比の計算は、すべてブラウザ内のJavaScriptで行われます。",
          },
        ]}
      />
    </div>
  );
}
