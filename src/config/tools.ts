import type { LucideIcon } from "lucide-react";
import { Binary, TextCursorInput } from "lucide-react";

import type { Locale } from "@/i18n/config";

/** ロケールごとの文字列 */
export type LocalizedText = Record<Locale, string>;

export type ToolFaqItem = {
  question: LocalizedText;
  answer: LocalizedText;
};

export type ToolCategory = {
  id: string;
  label: LocalizedText;
  description: LocalizedText;
};

export type Tool = {
  /** 一意のID（パスのスラッグとしても利用） */
  id: string;
  /** ツール名 */
  name: LocalizedText;
  /** 一覧・カード表示用の短い説明 */
  description: LocalizedText;
  /** SEO用の詳細説明（generateMetadataで利用） */
  longDescription?: LocalizedText;
  /** 使い方 */
  usage?: LocalizedText;
  /** よくある質問 */
  faq?: ToolFaqItem[];
  /** カテゴリID（categories配列のidと対応） */
  category: string;
  /** サイドバー・カードで表示するアイコン */
  icon: LucideIcon;
  /** 検索対象キーワード（ロケールごとのスペース区切り文字列） */
  keywords: LocalizedText;
};

export const categories: ToolCategory[] = [
  {
    id: "text",
    label: { ja: "テキスト", en: "Text" },
    description: {
      ja: "文字列の解析・集計に関するツール",
      en: "Tools for analyzing and counting text",
    },
  },
  {
    id: "converter",
    label: { ja: "変換", en: "Convert" },
    description: {
      ja: "エンコード・デコードやフォーマット変換ツール",
      en: "Encoding, decoding, and format conversion tools",
    },
  },
];

export const tools: Tool[] = [
  {
    id: "character-count",
    name: { ja: "文字数カウント", en: "Character Count" },
    description: {
      ja: "文字数・単語数・行数・バイト数をリアルタイムで計測します。",
      en: "Measure character, word, line, and byte counts in real time.",
    },
    longDescription: {
      ja: "入力したテキストの文字数、単語数、行数、バイト数（UTF-8）をブラウザ上でリアルタイムに計測できるツールです。サーバーへの送信は一切行われません。",
      en: "A tool that measures the character, word, line, and byte (UTF-8) counts of your text in real time, right in your browser. Nothing is ever sent to a server.",
    },
    usage: {
      ja: "テキストエリアに文章を入力すると、下部のカードに各種カウントがリアルタイムで表示されます。",
      en: "Type or paste your text into the text area below, and the counts update in real time in the cards underneath.",
    },
    faq: [
      {
        question: {
          ja: "入力したテキストは保存されますか？",
          en: "Is my input text saved anywhere?",
        },
        answer: {
          ja: "いいえ。すべての処理はブラウザ内で完結し、サーバーに送信・保存されることはありません。",
          en: "No. All processing happens locally in your browser, and nothing is ever sent to or stored on a server.",
        },
      },
      {
        question: {
          ja: "バイト数はどのように計算されますか？",
          en: "How is the byte count calculated?",
        },
        answer: {
          ja: "UTF-8でエンコードした場合のバイト数を計測しています。",
          en: "It measures the number of bytes when the text is encoded as UTF-8.",
        },
      },
    ],
    category: "text",
    icon: TextCursorInput,
    keywords: {
      ja: "文字数 文字数カウント 単語数 行数 バイト数",
      en: "character count word count line count byte count",
    },
  },
  {
    id: "base64",
    name: { ja: "Base64変換", en: "Base64 Converter" },
    description: {
      ja: "テキストをBase64にエンコード・デコードします。",
      en: "Encode or decode text as Base64.",
    },
    longDescription: {
      ja: "テキストをBase64形式にエンコードしたり、Base64文字列を元のテキストにデコードしたりできるツールです。すべての処理はブラウザ内で完結し、サーバーへデータが送信されることはありません。",
      en: "A tool for encoding text into Base64 or decoding a Base64 string back into text. All processing happens in your browser, and no data is ever sent to a server.",
    },
    usage: {
      ja: "タブでエンコード・デコードを切り替え、テキストエリアに入力すると変換結果がリアルタイムに表示されます。",
      en: "Switch between encode and decode using the tabs above, then type into the text area to see the converted result in real time.",
    },
    faq: [
      {
        question: {
          ja: "対応していない文字列を入力するとどうなりますか？",
          en: "What happens if I enter an invalid string?",
        },
        answer: {
          ja: "デコードに失敗した場合はエラーメッセージが表示されます。",
          en: "If decoding fails, an error message will be shown.",
        },
      },
    ],
    category: "converter",
    icon: Binary,
    keywords: {
      ja: "base64 エンコード デコード 変換",
      en: "base64 encode decode convert",
    },
  },
];

export function getToolById(id: string): Tool | undefined {
  return tools.find((tool) => tool.id === id);
}

export function getToolsByCategory(categoryId: string): Tool[] {
  return tools.filter((tool) => tool.category === categoryId);
}

export function getCategoryById(id: string): ToolCategory | undefined {
  return categories.find((category) => category.id === id);
}

export function getToolPath(locale: Locale, id: string): string {
  return `/${locale}/tools/${id}`;
}

export function searchTools(locale: Locale, query: string): Tool[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return tools;

  return tools.filter((tool) => {
    const haystack = [tool.name[locale], tool.description[locale], tool.keywords[locale]]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}
