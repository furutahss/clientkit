import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CsvJsonConverterTool } from "@/components/tools/csv-json-converter-tool";
import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { getToolById } from "@/config/tools";

const TOOL_ID = "csv-json-converter";

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

export default function CsvJsonConverterPage() {
  const tool = getToolById(TOOL_ID);
  if (!tool) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} />
      <CsvJsonConverterTool />
      <ToolContentSections
        howToUse={[
          "「CSV → JSON」または「JSON → CSV」を選び、変換したいデータを左側の入力欄に貼り付けます。",
          "区切り文字（カンマ・タブ・セミコロン）を選択します。CSV → JSONの場合は「1行目をヘッダーとして扱う」の要否も選べます。",
          "右側に変換結果がリアルタイムに表示されます。下部にはテーブル形式のプレビューも表示されます。",
          "「クリップボードへコピー」で結果をコピーするか、JSON → CSVの場合は「CSVをダウンロード」でファイルとして保存できます。",
        ]}
        about={{
          paragraphs: [
            "CSV/JSON相互変換ツールは、CSV形式とJSON形式のデータをブラウザ内で相互に変換できるツールです。スプレッドシートからエクスポートしたCSVをAPIやプログラムで扱いやすいJSONに変換したり、逆にJSONデータを表計算ソフトで開けるCSVに変換したりする際に活用できます。",
            "引用符で囲まれたフィールドやフィールド内の改行・エスケープされたダブルクォートにも対応した簡易CSVパーサーを実装しており、実務で扱う複雑なCSVでも崩れずに変換できます。変換結果はテーブル形式でもプレビューされるため、意図した通りにデータが解釈されているかをその場で確認できます。",
            "入力したデータがサーバーに送信されることはなく、すべての変換処理はお使いのブラウザ内のJavaScriptだけで完結します。",
          ],
        }}
        faqs={[
          {
            question: "大きなCSVファイルでも変換できますか？",
            answer:
              "ブラウザのメモリが許す範囲であれば変換可能です。ただしテーブルプレビューは処理の負荷を抑えるため最初の200行のみ表示します（変換結果自体は全件が出力されます）。",
          },
          {
            question: "ヘッダーがないCSVはどう扱われますか？",
            answer:
              "「1行目をヘッダーとして扱う」のチェックを外すと、各行を配列としてJSON化し、列見出しは「列1」「列2」のように自動で採番されます。",
          },
          {
            question: "JSONの構造に制限はありますか？",
            answer:
              "オブジェクトの配列（例: [{\"a\":1}]）、配列の配列、単一オブジェクトのいずれもCSVに変換できます。オブジェクトごとにキーが異なる場合は、全オブジェクトのキーを統合した列見出しが生成され、存在しない値は空欄になります。",
          },
          {
            question: "変換したデータはサーバーに保存されますか？",
            answer:
              "いいえ。入力・変換・ダウンロードのすべての処理はブラウザ内で完結し、外部サーバーへデータが送信されることはありません。",
          },
        ]}
      />
    </div>
  );
}
