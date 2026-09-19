import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JwtDecoderTool } from "@/components/tools/jwt-decoder-tool";
import { ToolContentSections } from "@/components/tools/tool-content-sections";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { getToolById } from "@/config/tools";

const TOOL_ID = "jwt-decoder";

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

export default function JwtDecoderPage() {
  const tool = getToolById(TOOL_ID);
  if (!tool) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ToolPageHeader tool={tool} />
      <JwtDecoderTool />
      <ToolContentSections
        howToUse={[
          "入力欄にJWT（JSON Web Token）文字列を貼り付けます。",
          "Header・Payloadが整形されたJSONとして自動的に表示されます。",
          "PayloadにexpやnbfなどのUnixタイムスタンプが含まれる場合、日時表記に変換した一覧が表示され、有効期限切れの場合は警告バッジが表示されます。",
          "Signature部分はデコードされた値がそのまま（Base64URL文字列として）表示されます。",
        ]}
        about={{
          paragraphs: [
            "JWTデコーダー・構造解析ツールは、JWT（JSON Web Token）文字列をHeader・Payload・Signatureの3つの部分に分解し、それぞれの内容を確認できるツールです。認証・認可の実装時に、発行されたトークンの中身をデバッグする用途で活用できます。",
            "JWTのHeaderとPayloadはBase64URLでエンコードされたJSONです。本ツールはこれをデコードして整形表示するとともに、`exp`（有効期限）・`nbf`（Not Before）・`iat`（発行日時）といった標準クレームのUnixタイムスタンプを人間が読める日時形式に自動変換します。",
            "本ツールはJWTの内容を可視化するものであり、署名の検証は行いません。署名が正しいかどうかを確認するには、発行元のシークレットキーまたは公開鍵を用いたサーバーサイドでの検証が必要です。",
          ],
        }}
        faqs={[
          {
            question: "このツールで署名の正当性を確認できますか？",
            answer:
              "できません。署名の検証にはJWTの発行に使われた秘密鍵または公開鍵が必要ですが、本ツールはそれらを扱わず、あくまでHeader・Payloadの中身をデコードして表示するだけです。",
          },
          {
            question: "「有効期限切れ」と表示されるのはどのような場合ですか？",
            answer:
              "PayloadにExp（exp）クレームが含まれており、その値が現在時刻より過去である場合に表示されます。逆にNot Before（nbf）クレームが未来の場合は「まだ有効ではありません」と表示されます。",
          },
          {
            question: "貼り付けたJWTがデコードできないのはなぜですか？",
            answer:
              "JWTは「ヘッダー.ペイロード.署名」の3つの部分がピリオドで区切られた形式である必要があります。コピー時に余分な空白や改行が混入していないか、3つの部分がすべて揃っているかを確認してください。",
          },
          {
            question: "入力したJWTはサーバーに送信されますか？",
            answer:
              "送信されません。デコード処理はすべてブラウザ内のJavaScriptで実行され、外部に送信されることはありません。ただし、本物の認証トークンを第三者のツールに貼り付けること自体にリスクが伴う場合があるため、取り扱いには注意してください。",
          },
        ]}
      />
    </div>
  );
}
