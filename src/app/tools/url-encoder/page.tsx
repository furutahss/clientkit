import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { UrlEncoderTool } from "@/components/tools/url-encoder-tool";
import { getToolById } from "@/config/tools";

const TOOL_ID = "url-encoder";

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

export default function UrlEncoderPage() {
  const tool = getToolById(TOOL_ID);
  if (!tool) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} />
      <UrlEncoderTool />
      <ToolContentSections
        howToUse={[
          "「エンコード/デコード」タブでは、テキストを入力し、encodeURIComponent（値のエンコードに最適）またはencodeURI（URL全体のエンコードに最適）を選んで変換します。",
          "「クエリパラメータ分解」タブでは、URLを入力して「分解する」を押すと、ベースURLとクエリパラメータが自動で抽出されます。",
          "抽出されたパラメータはキー・値を直接編集したり、「パラメータを追加」で新規追加、×ボタンで削除したりできます。",
          "編集内容は「再生成されたURL」欄にリアルタイムで反映されるので、「クリップボードへコピー」でそのまま利用できます。",
        ]}
        about={{
          paragraphs: [
            "URLエンコード・クエリパラメータ分解ツールは、URLに含まれる日本語や記号のエンコード・デコードと、クエリパラメータの内容確認・編集をブラウザ内で行えるツールです。APIのリクエストURLを組み立てる際や、長いURLに含まれるパラメータの意味を調べたいときに役立ちます。",
            "encodeURIComponentとencodeURIは、エンコード対象とする文字の範囲が異なります。encodeURIComponentはクエリパラメータの値など文字列全体を丸ごとエンコードしたい場合に、encodeURIは「:」「/」「?」「#」などURLの構造を表す記号を保持したままURL全体をエンコードしたい場合に使用します。",
            "クエリパラメータ分解機能では、URLSearchParamsを利用して「?key1=value1&key2=value2」の形式を表形式に変換し、キーや値の追加・編集・削除を行った結果を即座に新しいURLとして再生成します。",
          ],
        }}
        faqs={[
          {
            question: "encodeURIComponentとencodeURIはどちらを使えばいいですか？",
            answer:
              "クエリパラメータの値など、URLの一部として埋め込む単一の文字列をエンコードする場合はencodeURIComponentを使用してください。すでに完成しているURL全体をエンコードしたい場合はencodeURIを使うと、URLの構造を表す記号（:/?#など）がエンコードされずに保持されます。",
          },
          {
            question: "同じキーが複数あるクエリパラメータは扱えますか？",
            answer:
              "扱えます。例えば「tag=a&tag=b」のように同じキーが複数存在する場合も、それぞれ別の行として表示・編集できます。",
          },
          {
            question: "ハッシュ（#以降のフラグメント）はどうなりますか？",
            answer:
              "ハッシュ部分はクエリパラメータとは区別して保持され、URLを再生成する際に末尾にそのまま付加されます。",
          },
          {
            question: "入力したURLはサーバーに送信されますか？",
            answer:
              "送信されません。URLの分解・編集・再生成、エンコード・デコードのすべての処理はブラウザ内のJavaScriptで完結します。",
          },
        ]}
      />
    </div>
  );
}
