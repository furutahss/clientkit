import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonFormatterTool } from "@/components/tools/json-formatter-tool";
import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { getToolById } from "@/config/tools";

const TOOL_ID = "json-formatter";

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

export default function JsonFormatterPage() {
  const tool = getToolById(TOOL_ID);
  if (!tool) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} />
      <JsonFormatterTool />
      <ToolContentSections
        howToUse={[
          "左側の入力欄に整形・変換したいJSONを貼り付けます。",
          "「整形 (Format)」タブでは2スペース・4スペース・1行化 (Minify) のいずれかを選び、読みやすい形式に整形します。",
          "「TypeScript型生成」タブに切り替えると、入力したJSONの構造からTypeScriptのinterface定義コードが自動生成されます。",
          "構文エラーがある場合は該当する行・列番号とエラー内容が表示されるので、修正後に再度確認できます。",
        ]}
        about={{
          paragraphs: [
            "JSON整形・TypeScript型変換ツールは、崩れたJSONを読みやすく整形したり、JSONの構造からTypeScriptの型定義コードを自動生成したりできるツールです。APIレスポンスの確認や、外部から取得したJSONデータに対応する型定義を素早く作成したい場合に活用できます。",
            "構文チェックには独自の簡易JSONパーサーを使用しており、JavaScriptエンジンごとに異なる`JSON.parse`のエラーメッセージ形式に依存せず、常に正確な行・列番号でエラー箇所を特定します。",
            "TypeScript型生成では、配列内に含まれる構造が同じオブジェクトを1つのinterfaceにまとめ、要素によって存在したりしなかったりするフィールドは自動的にオプショナル（`?`）として出力します。",
          ],
        }}
        faqs={[
          {
            question: "生成されたTypeScriptの型はそのまま使えますか？",
            answer:
              "生成された`interface`定義はコピーしてそのままプロジェクトに貼り付けて利用できます。ただし、フィールド名や型の意味づけ（IDなど）は自動判定のため、必要に応じて命名や型を調整してください。",
          },
          {
            question: "巨大なJSONでも整形できますか？",
            answer:
              "ブラウザのメモリが許す範囲であれば整形可能です。非常に大きなJSONの場合、ブラウザの動作が一時的に重くなることがあります。",
          },
          {
            question: "配列のトップレベルのJSONにも対応していますか？",
            answer:
              "対応しています。配列がトップレベルの場合は、型生成時に配列の要素の型を表す`type`エイリアスが生成されます。",
          },
          {
            question: "入力したJSONはサーバーに送信されますか？",
            answer:
              "送信されません。構文チェック・整形・型生成のすべての処理はブラウザ内のJavaScriptで実行されます。",
          },
        ]}
      />
    </div>
  );
}
