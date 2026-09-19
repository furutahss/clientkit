import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HashGeneratorTool } from "@/components/tools/hash-generator-tool";
import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { getToolById } from "@/config/tools";

const TOOL_ID = "hash-generator";

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

export default function HashGeneratorPage() {
  const tool = getToolById(TOOL_ID);
  if (!tool) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} />
      <HashGeneratorTool />
      <ToolContentSections
        howToUse={[
          "テキストを入力するか、ファイルをドラッグ＆ドロップ（または「ファイルを選択」）します。",
          "MD5・SHA-1・SHA-256・SHA-384・SHA-512の各ハッシュ値がリアルタイムに計算され、一覧表示されます。",
          "各ハッシュ値はコピーボタンでクリップボードにコピーできます。",
          "配布元などで公開されている「期待値」のハッシュ値を入力欄に貼り付けると、一致する行に「Match」、一致しない行に「Mismatch」と表示されます。",
        ]}
        about={{
          paragraphs: [
            "ハッシュ値生成・照合ツールは、テキストやファイルからMD5・SHA-1・SHA-256・SHA-384・SHA-512のハッシュ値をブラウザ内で計算できるツールです。ダウンロードしたファイルの改ざん検知や、配布されているチェックサムとの照合、APIキーやパスワードのハッシュ化の動作確認などに利用できます。",
            "SHA-1・SHA-256・SHA-384・SHA-512の計算にはブラウザ標準のWeb Crypto API（SubtleCrypto）を使用しています。MD5はセキュリティ上の理由からWeb Crypto APIには実装されていないため、本ツールでは検証済みの純粋なJavaScript実装によって計算しています。",
            "ファイルはサイズの大きなものでも、ブラウザのメモリが許す範囲であれば処理できます。ファイルの中身がサーバーに送信されることはありません。",
          ],
        }}
        faqs={[
          {
            question: "MD5やSHA-1はもう安全ではないと聞きました。使っても大丈夫ですか？",
            answer:
              "MD5やSHA-1は衝突攻撃に対して脆弱であることが知られており、パスワード保存や署名など、セキュリティが重要な用途には推奨されません。ファイルの改ざんチェックなど、配布元が提供する形式に合わせて照合する目的であれば、本ツールで問題なく利用できます。",
          },
          {
            question: "大文字・小文字が違うと一致と判定されませんか？",
            answer:
              "期待値との照合では大文字・小文字の違いや前後の空白を無視して比較するため、「ABCDEF」と「abcdef」のような表記の違いは一致として扱われます。",
          },
          {
            question: "ファイルとテキストを同時にハッシュ化できますか？",
            answer:
              "できません。ファイルをドロップ・選択すると入力はファイルの内容に切り替わります。テキストに戻したい場合は「別の入力に戻る」を押してください。",
          },
          {
            question: "入力したファイルやテキストはサーバーに送信されますか？",
            answer:
              "送信されません。ハッシュ計算はすべてブラウザ内のWeb Crypto APIおよびJavaScriptで実行されます。",
          },
        ]}
      />
    </div>
  );
}
