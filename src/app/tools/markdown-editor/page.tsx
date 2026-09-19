import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarkdownEditorTool } from "@/components/tools/markdown-editor-tool";
import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { getToolById } from "@/config/tools";

const TOOL_ID = "markdown-editor";

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

export default function MarkdownEditorPage() {
  const tool = getToolById(TOOL_ID);
  if (!tool) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} />
      <MarkdownEditorTool />
      <ToolContentSections
        howToUse={[
          "左側のエディタにMarkdownを入力すると、右側に変換結果がリアルタイムに反映されます。",
          "「プレビュー」タブでは、実際にどのように表示されるかを確認できます。テーブル・タスクリスト・取り消し線などのGitHub Flavored Markdown（GFM）記法にも対応しています。",
          "「HTMLコード」タブに切り替えると、変換後のHTMLソースコードが表示され、「クリップボードへコピー」でそのまま他のシステムに貼り付けられます。",
          "「Markdown (.md) をダウンロード」「HTML (.html) をダウンロード」で、それぞれの形式のファイルとして保存できます。",
        ]}
        about={{
          paragraphs: [
            "Markdownリアルタイムプレビュー・HTML変換ツールは、Markdownで書いた文章をリアルタイムにプレビューしながら、HTMLへの変換・抽出も行えるツールです。READMEファイルの下書き、ブログ記事の執筆、ドキュメントのHTML化など、Markdownを扱うさまざまな場面で活用できます。",
            "テーブル、タスクリスト（チェックボックス）、取り消し線、コードブロックのシンタックスハイライト用クラス付与といった、GitHub Flavored Markdown（GFM）の主要な拡張記法に対応しています。",
            "生成されたHTMLは、ブラウザ内でDOMPurifyによるサニタイズ処理を行った上で表示・出力しており、Markdown内に埋め込まれた不正なスクリプトなどが実行されないよう配慮しています。",
          ],
        }}
        faqs={[
          {
            question: "GitHub Flavored Markdown（GFM）とは何ですか？",
            answer:
              "GitHubで採用されている、標準のMarkdownを拡張した記法です。テーブル、取り消し線（~~text~~）、タスクリスト（- [ ] や - [x]）などが追加で使用できます。本ツールはこれらの記法に対応しています。",
          },
          {
            question: "Markdown内にHTMLタグを直接書くことはできますか？",
            answer:
              "生のHTMLタグを含むMarkdownも変換されますが、出力時にDOMPurifyによってスクリプトタグなど危険な要素は除去されます。安全性を優先しているため、一部の高度なHTML表現は反映されない場合があります。",
          },
          {
            question: "ダウンロードしたHTMLファイルはそのまま公開できますか？",
            answer:
              "ダウンロードされるHTMLファイルは、最小限のスタイル（見出し・表・コードブロックなど）を含む単体のHTML文書として出力されるため、そのままブラウザで開いたり、簡易的なページとして利用したりできます。本格的なデザインを適用したい場合は、CSSを追加で調整してください。",
          },
          {
            question: "入力したMarkdownはサーバーに送信されますか？",
            answer:
              "送信されません。プレビューへの変換、HTMLコードの生成、ファイルのダウンロードは、すべてブラウザ内のJavaScriptで完結します。",
          },
        ]}
      />
    </div>
  );
}
