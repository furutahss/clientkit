import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SqlFormatterTool } from "@/components/tools/sql-formatter-tool";
import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { getToolById } from "@/config/tools";

const TOOL_ID = "sql-formatter";

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

export default function SqlFormatterPage() {
  const tool = getToolById(TOOL_ID);
  if (!tool) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} />
      <SqlFormatterTool />
      <ToolContentSections
        howToUse={[
          "左側の入力欄に整形したいSQLを貼り付けます。",
          "「整形 (Format)」タブでSQL方言（Standard, MySQL, PostgreSQLなど）と、予約語の大文字/小文字/そのままを選択します。",
          "右側にインデント・改行が整えられたSQLがリアルタイムに表示されます。",
          "1行のSQLに戻したい場合は「1行化 (Minify)」タブに切り替えると、コメントを除いた1行のSQLが生成されます。",
        ]}
        about={{
          paragraphs: [
            "SQL整形・クエリフォーマッターは、改行やインデントが崩れたSQLを読みやすい形式に自動整形できるツールです。ログに出力された1行のSQLや、他のツールが生成したSQLを確認・レビューする際に、構造をひと目で把握できるようになります。",
            "整形処理には人気のオープンソースライブラリ「sql-formatter」を使用しており、Standard SQLのほか、MySQL・PostgreSQL・SQLite・MariaDB・Transact-SQL（SQL Server）・BigQueryといった主要な方言ごとの構文の違いに対応した整形が可能です。",
            "予約語（SELECT、FROM、WHEREなど）の大文字・小文字を統一するオプションや、逆にSQLを1行に圧縮する機能も備えており、コーディング規約への統一やログ出力用のコンパクトなSQL生成にも活用できます。",
          ],
        }}
        faqs={[
          {
            question: "どのSQL方言を選べばよいかわかりません。",
            answer:
              "使用しているデータベース製品に合わせて選択してください。特定の方言固有の構文を使っていない場合は「標準SQL (Standard)」を選んでも多くの場合問題なく整形できます。",
          },
          {
            question: "整形結果の構文が実行環境と少し異なることがあります。",
            answer:
              "本ツールはSQLの構文を解析してインデントを整えるものであり、実際にSQLを実行して検証するものではありません。方言固有の関数や構文によっては意図通りに整形されない場合があります。",
          },
          {
            question: "1行化（Minify）ではコメントはどうなりますか？",
            answer:
              "「--」による行コメントと「/* */」によるブロックコメントはいずれも除去され、残りの空白・改行が1つのスペースに畳まれた1行のSQLが生成されます。",
          },
          {
            question: "入力したSQLはサーバーに送信されますか？",
            answer:
              "送信されません。SQLの整形・1行化はすべてブラウザ内のJavaScriptで実行されます。",
          },
        ]}
      />
    </div>
  );
}
