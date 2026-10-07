import type { LocalizedText } from "@/config/tools";

export type ReleaseNoteType = "feature" | "improvement" | "fix" | "chore";

export type ReleaseNoteEntry = {
  type: ReleaseNoteType;
  title: LocalizedText;
};

export type ReleaseNoteGroup = {
  /** ISO形式の日付（YYYY-MM-DD） */
  date: string;
  entries: ReleaseNoteEntry[];
};

/**
 * リリースノート。日付が新しい順に記載する。
 * GitHubのコミット履歴を基に、リリース内容を人が読みやすい形にまとめたもの。
 */
export const releaseNotes: ReleaseNoteGroup[] = [
  {
    date: "2026-10-07",
    entries: [
      {
        type: "feature",
        title: {
          ja: "画像の背景除去ツールを追加（透過・単色・ぼかし・画像への差し替え、ブラシ修正に対応）",
          en: "Added a background remover (transparent, solid color, blurred, or image backgrounds, with brush touch-ups)",
        },
      },
      {
        type: "feature",
        title: {
          ja: "動画→GIF変換・動画圧縮ツールを追加（トリミング・ディザリング・目標サイズ指定に対応）",
          en: "Added a video to GIF converter and video compressor (trimming, dithering, and target file size)",
        },
      },
    ],
  },
  {
    date: "2026-10-06",
    entries: [
      {
        type: "feature",
        title: {
          ja: "日本語テキスト正規化・不可視文字検出ツールを追加（表記ゆれの統一・機種依存文字の展開・差分表示に対応）",
          en: "Added a Japanese text normalizer and invisible character detector (unifies variants, expands platform-dependent characters, and shows a diff)",
        },
      },
      {
        type: "feature",
        title: {
          ja: "Mermaid図エディタを追加（8種類のテンプレート、SVG・PNG書き出し、URLでの共有に対応）",
          en: "Added a Mermaid diagram editor (8 templates, SVG and PNG export, and sharing via URL)",
        },
      },
      {
        type: "feature",
        title: {
          ja: "HTML/CSS/JS整形・Minifyツールを追加（SCSS・Less・TypeScriptの整形、gzip後のサイズ比較に対応）",
          en: "Added an HTML/CSS/JS formatter and minifier (formats SCSS, Less, and TypeScript, with gzip size comparison)",
        },
      },
      {
        type: "feature",
        title: {
          ja: "cURL→コード変換ツールを追加（fetch・axios・Python・C#・Goに対応、機密情報のマスキング付き）",
          en: "Added a cURL to code converter (fetch, axios, Python, C#, and Go, with secret masking)",
        },
      },
      {
        type: "feature",
        title: {
          ja: "請求書・見積書作成ツールを追加（インボイス制度の記載事項・税率ごとの端数処理・源泉徴収・PDF出力に対応）",
          en: "Added an invoice and estimate generator (Japanese qualified invoice details, per-rate tax rounding, withholding tax, and PDF output)",
        },
      },
      {
        type: "feature",
        title: {
          ja: "OCR（画像から文字認識）ツールを追加（日本語・縦書き・範囲指定・前処理に対応）",
          en: "Added an OCR tool to extract text from images (supports Japanese, vertical text, area selection, and preprocessing)",
        },
      },
      {
        type: "feature",
        title: {
          ja: "Excel（xlsx）→CSV/JSON変換ツールを追加（xls・ods、Shift_JIS出力、全シートのZIP保存に対応）",
          en: "Added an Excel (xlsx) to CSV/JSON converter (supports xls and ods, Shift_JIS output, and a ZIP of every sheet)",
        },
      },
    ],
  },
  {
    date: "2026-10-03",
    entries: [
      {
        type: "chore",
        title: {
          ja: "プライバシーポリシーページを追加",
          en: "Added a Privacy Policy page",
        },
      },
    ],
  },
  {
    date: "2026-09-28",
    entries: [
      {
        type: "feature",
        title: {
          ja: "フォルダ構成ツリー出力ツールを追加（ZIP・TAR・TAR.GZの中身の表示にも対応）",
          en: "Added a folder tree generator (also lists the contents of ZIP, TAR, and TAR.GZ archives)",
        },
      },
    ],
  },
  {
    date: "2026-09-25",
    entries: [
      {
        type: "improvement",
        title: {
          ja: "Markdownエディタで、Markdownファイル（.md など）の読み込みに対応",
          en: "The Markdown editor can now open Markdown files (.md, etc.)",
        },
      },
    ],
  },
  {
    date: "2026-09-23",
    entries: [
      {
        type: "improvement",
        title: {
          ja: "メニューとトップページのツールの並び順を、関連するツールが隣り合うように整理",
          en: "Reordered tools in the menu and on the home page so related tools appear together",
        },
      },
      {
        type: "feature",
        title: {
          ja: "QRコード生成・読み取りツールを追加",
          en: "Added a QR code generator & reader",
        },
      },
      {
        type: "feature",
        title: {
          ja: "SVG最適化・PNG変換ツールを追加",
          en: "Added an SVG optimizer & PNG converter",
        },
      },
      {
        type: "feature",
        title: {
          ja: "ファビコン一括生成ツールを追加",
          en: "Added a favicon generator",
        },
      },
      {
        type: "feature",
        title: {
          ja: "SQL DDL→Prisma変換ツールを追加",
          en: "Added a SQL DDL to Prisma schema converter",
        },
      },
      {
        type: "feature",
        title: {
          ja: "Prisma→Zodスキーマ生成ツールを追加",
          en: "Added a Prisma to Zod schema generator",
        },
      },
      {
        type: "feature",
        title: {
          ja: "X.509証明書（PEM）デコーダーを追加",
          en: "Added an X.509 certificate (PEM) decoder",
        },
      },
      {
        type: "feature",
        title: {
          ja: "JSONPathクエリ抽出ツールを追加",
          en: "Added a JSONPath query tool",
        },
      },
      {
        type: "feature",
        title: {
          ja: "YAML/TOML/JSON相互変換ツールを追加",
          en: "Added a YAML/TOML/JSON converter",
        },
      },
      {
        type: "feature",
        title: {
          ja: "cron式の解説・次回実行日時ツールを追加",
          en: "Added a cron expression explainer with next run times",
        },
      },
      {
        type: "feature",
        title: {
          ja: "Unixタイムスタンプ・タイムゾーン変換ツールを追加",
          en: "Added a Unix timestamp & time zone converter",
        },
      },
      {
        type: "feature",
        title: {
          ja: "UUID/ULID・パスワード生成ツールを追加",
          en: "Added a UUID/ULID & password generator",
        },
      },
      {
        type: "feature",
        title: {
          ja: "ログ・HARの機密情報マスキングツールを追加",
          en: "Added a log & HAR sensitive data masking tool",
        },
      },
      {
        type: "feature",
        title: {
          ja: "テキスト差分比較（Diff）ツールを追加",
          en: "Added a text diff comparison tool",
        },
      },
      {
        type: "feature",
        title: {
          ja: "画像のEXIF・位置情報削除ツールを追加",
          en: "Added an image EXIF & location data remover",
        },
      },
      {
        type: "feature",
        title: {
          ja: "PDF結合・分割・ページ抽出ツールを追加",
          en: "Added a PDF merge, split & page extraction tool",
        },
      },
    ],
  },
  {
    date: "2026-09-21",
    entries: [
      {
        type: "feature",
        title: {
          ja: "スクリーンショット加工ツールを追加",
          en: "Added a screenshot editor tool",
        },
      },
      {
        type: "feature",
        title: {
          ja: "トップページにファイルのスマートドロップ機能を追加",
          en: "Added smart file drop to the home page",
        },
      },
    ],
  },
  {
    date: "2026-09-20",
    entries: [
      {
        type: "feature",
        title: {
          ja: "CSV加工ツール（テーブル編集）を追加",
          en: "Added a CSV editing tool (table editor)",
        },
      },
      {
        type: "fix",
        title: {
          ja: "モバイルドロワーの高さ計算を修正しはみ出しを防止",
          en: "Fixed the mobile drawer height calculation to prevent overflow",
        },
      },
      {
        type: "improvement",
        title: {
          ja: "モバイルドロワーのスクロールとカテゴリ別開閉に対応",
          en: "Improved mobile drawer scrolling and per-category collapse",
        },
      },
      {
        type: "feature",
        title: {
          ja: "モックデータ&テストコード生成器を追加",
          en: "Added a mock data & test code generator",
        },
      },
      {
        type: "feature",
        title: {
          ja: "Prisma Schema ビジュアルER図ツールを追加",
          en: "Added a Prisma schema visual ER diagram tool",
        },
      },
      {
        type: "feature",
        title: {
          ja: "Prisma Repositoryコード生成ツールを追加",
          en: "Added a Prisma repository code generator",
        },
      },
      {
        type: "feature",
        title: {
          ja: "HARアナライザー（自動診断ダッシュボード）を追加",
          en: "Added a HAR analyzer with an automated diagnostics dashboard",
        },
      },
      {
        type: "improvement",
        title: {
          ja: "言語に依存しないfavicon/OGP画像を作成し、全ページに適用",
          en: "Applied locale-independent favicon/OGP images across all pages",
        },
      },
      {
        type: "improvement",
        title: {
          ja: "日英2言語対応（i18n）へリファクタリング（全11ツール対応）",
          en: "Refactored the site for Japanese/English i18n across all 11 tools",
        },
      },
      {
        type: "feature",
        title: {
          ja: "Markdownリアルタイムプレビュー・HTML変換ツールを追加",
          en: "Added a Markdown live preview & HTML conversion tool",
        },
      },
      {
        type: "feature",
        title: {
          ja: "JWTデコーダーツールを追加",
          en: "Added a JWT decoder tool",
        },
      },
    ],
  },
  {
    date: "2026-09-19",
    entries: [
      {
        type: "improvement",
        title: {
          ja: "既存ツールに共通の使い方・解説・FAQセクションを適用",
          en: "Added shared usage, about, and FAQ sections to existing tools",
        },
      },
      {
        type: "feature",
        title: {
          ja: "カラーコード変換・アクセシビリティ判定ツールを追加",
          en: "Added a color code converter & accessibility checker",
        },
      },
      {
        type: "feature",
        title: {
          ja: "SQL整形・クエリフォーマッターを追加",
          en: "Added a SQL formatter / query beautifier",
        },
      },
      {
        type: "feature",
        title: {
          ja: "ハッシュ値生成・照合ツールを追加",
          en: "Added a hash generator & verifier",
        },
      },
      {
        type: "feature",
        title: {
          ja: "URLエンコード・クエリパラメータ分解ツールを追加",
          en: "Added a URL encoder & query parameter parser",
        },
      },
      {
        type: "feature",
        title: {
          ja: "正規表現テスト・テキスト抽出ツールを追加",
          en: "Added a regex tester & text extractor",
        },
      },
      {
        type: "feature",
        title: {
          ja: "CSV/JSON変換ツールを追加",
          en: "Added a CSV/JSON converter",
        },
      },
      {
        type: "improvement",
        title: {
          ja: "画像圧縮ツールのリサイズをスライダー操作＆アスペクト比維持チェックに対応",
          en: "Improved the image compression tool with resize sliders & aspect-ratio lock",
        },
      },
      {
        type: "fix",
        title: {
          ja: "画像圧縮ツールでWebP非対応ブラウザのフォールバックを検知して警告表示",
          en: "Added WebP fallback detection and a warning for unsupported browsers",
        },
      },
      {
        type: "feature",
        title: {
          ja: "画像圧縮・フォーマット変換ツールを追加",
          en: "Added an image compression & format conversion tool",
        },
      },
      {
        type: "feature",
        title: {
          ja: "JSON整形・TypeScript型変換ツールを追加",
          en: "Added a JSON formatter & TypeScript type generator",
        },
      },
      {
        type: "improvement",
        title: {
          ja: "トップページから特徴セクションを削除",
          en: "Removed the features section from the home page",
        },
      },
      {
        type: "chore",
        title: {
          ja: "Cloudflare Pages向けにwrangler.jsoncを追加",
          en: "Added wrangler.jsonc for Cloudflare Pages",
        },
      },
      {
        type: "feature",
        title: {
          ja: "ClientKitを公開（プロジェクト基盤を構築）",
          en: "Launched ClientKit (initial project foundation)",
        },
      },
    ],
  },
];
