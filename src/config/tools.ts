import type { LucideIcon } from "lucide-react";
import {
  Binary,
  FileJson,
  FileSpreadsheet,
  ImageDown,
  Link2,
  Regex,
  TextCursorInput,
} from "lucide-react";

export type ToolCategory = {
  id: string;
  label: string;
  description: string;
};

export type Tool = {
  /** 一意のID（パスのスラッグとしても利用） */
  id: string;
  /** ツール名 */
  name: string;
  /** 一覧・カード表示用の短い説明 */
  description: string;
  /** SEO用の詳細説明（generateMetadataで利用） */
  longDescription?: string;
  /** カテゴリID（categories配列のidと対応） */
  category: string;
  /** サイドバー・カードで表示するアイコン */
  icon: LucideIcon;
  /** 検索対象キーワード */
  keywords: string[];
  /** ルートパス（/tools/以下） */
  path: string;
};

export const categories: ToolCategory[] = [
  {
    id: "text",
    label: "テキスト",
    description: "文字列の解析・集計に関するツール",
  },
  {
    id: "converter",
    label: "変換",
    description: "エンコード・デコードやフォーマット変換ツール",
  },
  {
    id: "developer",
    label: "開発者向け",
    description: "エンジニア向けの開発支援ツール",
  },
];

export const tools: Tool[] = [
  {
    id: "character-count",
    name: "文字数カウント",
    description: "文字数・単語数・行数・バイト数をリアルタイムで計測します。",
    longDescription:
      "入力したテキストの文字数、単語数、行数、バイト数（UTF-8）をブラウザ上でリアルタイムに計測できるツールです。サーバーへの送信は一切行われません。",
    category: "text",
    icon: TextCursorInput,
    keywords: ["文字数", "文字数カウント", "単語数", "行数", "バイト数", "character count", "word count"],
    path: "/tools/character-count",
  },
  {
    id: "base64",
    name: "Base64変換",
    description: "テキストをBase64にエンコード・デコードします。",
    longDescription:
      "テキストをBase64形式にエンコードしたり、Base64文字列を元のテキストにデコードしたりできるツールです。すべての処理はブラウザ内で完結し、サーバーへデータが送信されることはありません。",
    category: "converter",
    icon: Binary,
    keywords: ["base64", "エンコード", "デコード", "encode", "decode", "変換"],
    path: "/tools/base64",
  },
  {
    id: "json-formatter",
    name: "JSON整形・TypeScript型変換",
    description: "JSONの整形・Minifyと、TypeScriptの型定義生成を行います。",
    longDescription:
      "入力したJSONを2スペース・4スペース・1行化（Minify）で整形したり、TypeScriptのinterface定義コードに変換したりできるツールです。リアルタイムに構文チェックを行い、すべての処理はブラウザ内で完結します。",
    category: "converter",
    icon: FileJson,
    keywords: [
      "json",
      "整形",
      "フォーマット",
      "minify",
      "typescript",
      "型定義",
      "interface",
      "変換",
      "json formatter",
    ],
    path: "/tools/json-formatter",
  },
  {
    id: "image-converter",
    name: "画像圧縮・フォーマット変換",
    description: "画像をJPEG/PNG/WebPに変換し、画質やサイズを調整して圧縮します。",
    longDescription:
      "画像ファイルをJPEG・PNG・WebP形式に変換し、画質（圧縮率）やリサイズを調整しながら圧縮できるツールです。Canvas APIによりブラウザ内で圧縮後のサイズをリアルタイムに試算・プレビューでき、サーバーへ画像がアップロードされることはありません。",
    category: "converter",
    icon: ImageDown,
    keywords: [
      "画像",
      "画像圧縮",
      "画像変換",
      "フォーマット変換",
      "jpeg",
      "png",
      "webp",
      "リサイズ",
      "compress",
      "image converter",
    ],
    path: "/tools/image-converter",
  },
  {
    id: "csv-json-converter",
    name: "CSV/JSON相互変換",
    description: "CSVとJSONを相互に変換し、テーブル形式でプレビューします。",
    longDescription:
      "CSV形式とJSON形式のデータをブラウザ内で相互に変換できるツールです。区切り文字やヘッダー有無を選択でき、変換結果はテーブル形式でプレビューできます。JSON→CSVではファイルとしてダウンロードも可能です。",
    category: "converter",
    icon: FileSpreadsheet,
    keywords: [
      "csv",
      "json",
      "変換",
      "テーブル",
      "スプレッドシート",
      "csv to json",
      "json to csv",
    ],
    path: "/tools/csv-json-converter",
  },
  {
    id: "regex-tester",
    name: "正規表現テスト・テキスト抽出",
    description: "正規表現をリアルタイムでテストし、マッチ箇所を抽出します。",
    longDescription:
      "正規表現パターンとフラグ（g, i, m, s, u）を指定し、対象テキストに対するマッチ箇所をリアルタイムでハイライト表示・一覧化できるツールです。メールアドレスやURLなどのよく使うパターンプリセットも用意しています。",
    category: "developer",
    icon: Regex,
    keywords: [
      "正規表現",
      "regex",
      "regexp",
      "テキスト抽出",
      "パターンマッチ",
      "regular expression",
    ],
    path: "/tools/regex-tester",
  },
  {
    id: "url-encoder",
    name: "URLエンコード・クエリ分解",
    description: "URLのエンコード/デコードと、クエリパラメータの分解・編集を行います。",
    longDescription:
      "URLエンコード（encodeURIComponent / encodeURI）・デコードと、URLのクエリパラメータ（?key=value）を表形式で抽出・編集・再生成できるツールです。すべての処理はブラウザ内で完結します。",
    category: "converter",
    icon: Link2,
    keywords: [
      "url",
      "エンコード",
      "デコード",
      "クエリパラメータ",
      "query parameter",
      "encodeURIComponent",
      "encodeURI",
    ],
    path: "/tools/url-encoder",
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

export function searchTools(query: string): Tool[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return tools;

  return tools.filter((tool) => {
    const haystack = [tool.name, tool.description, ...tool.keywords]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}
