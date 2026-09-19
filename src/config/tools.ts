import type { LucideIcon } from "lucide-react";
import {
  Binary,
  Database,
  FileJson,
  FileSpreadsheet,
  Fingerprint,
  ImageDown,
  KeyRound,
  Link2,
  NotebookText,
  Palette,
  Regex,
  TextCursorInput,
} from "lucide-react";

import type { Locale } from "@/i18n/config";

/** ロケールごとの文字列 */
export type LocalizedText = Record<Locale, string>;
/** ロケールごとの文字列配列 */
export type LocalizedTextArray = Record<Locale, string[]>;

export type ToolFaqItem = {
  question: LocalizedText;
  answer: LocalizedText;
};

export type ToolAbout = {
  heading?: LocalizedText;
  paragraphs: LocalizedTextArray;
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
  /** 「使い方」セクションの手順 */
  howToUse: LocalizedTextArray;
  /** ツールの解説文章 */
  about: ToolAbout;
  /** よくある質問 */
  faq: ToolFaqItem[];
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
  {
    id: "developer",
    label: { ja: "開発者向け", en: "Developer" },
    description: {
      ja: "エンジニア向けの開発支援ツール",
      en: "Development tools for engineers",
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
    howToUse: {
      ja: [
        "テキストエリアに文字数を計測したい文章を入力または貼り付けます。",
        "入力と同時に、文字数・文字数（空白除く）・単語数・行数・バイト数（UTF-8）がリアルタイムに更新されます。",
        "「クリップボードへコピー」で入力したテキストをコピーしたり、「クリア」で入力内容をリセットしたりできます。",
      ],
      en: [
        "Type or paste the text you want to measure into the text area.",
        "As you type, the character count, character count (no spaces), word count, line count, and byte count (UTF-8) update in real time.",
        "Use \"Copy to clipboard\" to copy your input, or \"Clear\" to reset it.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "文字数カウントツールは、入力したテキストの文字数・単語数・行数・バイト数をブラウザ上でリアルタイムに計測できるツールです。Webサイトの原稿執筆、SNS投稿の文字数制限チェック、レポートや論文の文字数確認など、さまざまな場面で活用できます。",
          "「文字数」はテキスト全体の文字数、「文字数（空白除く）」はスペースや改行を除いた文字数です。「バイト数（UTF-8）」は、日本語などの全角文字が1文字あたり複数バイトになることを考慮した、実際のファイルサイズやデータ量の目安として利用できます。",
        ],
        en: [
          "The character count tool measures the character, word, line, and byte counts of your text in real time, right in your browser. It's useful for drafting web copy, checking character limits for social media posts, and confirming word counts for reports or papers.",
          "\"Characters\" is the total character count of the text, and \"Characters (no spaces)\" excludes spaces and line breaks. \"Bytes (UTF-8)\" accounts for the fact that full-width characters like Japanese take up multiple bytes per character, giving you a useful estimate of actual file size or data volume.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "改行やスペースも文字数としてカウントされますか？",
          en: "Are line breaks and spaces counted as characters?",
        },
        answer: {
          ja: "「文字数」には改行やスペースも含まれます。それらを除いた文字数を確認したい場合は「文字数（空白除く）」の数値をご覧ください。",
          en: "Yes, \"Characters\" includes line breaks and spaces. If you want the count without them, check the \"Characters (no spaces)\" value.",
        },
      },
      {
        question: {
          ja: "バイト数はどのように計算されていますか？",
          en: "How is the byte count calculated?",
        },
        answer: {
          ja: "UTF-8エンコーディングでテキストをバイト列に変換した際のバイト数を計算しています。半角英数字は1文字1バイトですが、日本語などの全角文字は1文字あたり3バイトになるため、文字数とバイト数は一致しません。",
          en: "It calculates the number of bytes when the text is encoded as a UTF-8 byte sequence. Half-width alphanumeric characters are 1 byte each, but full-width characters like Japanese are typically 3 bytes each, so the character count and byte count won't match.",
        },
      },
      {
        question: {
          ja: "単語数はどのように数えていますか？",
          en: "How is the word count determined?",
        },
        answer: {
          ja: "空白文字（スペースや改行）で区切られたまとまりの数を単語数として数えています。日本語のように単語間にスペースを入れない文章では、文全体が1つの単語として数えられる点にご注意ください。",
          en: "It counts the number of chunks separated by whitespace (spaces or line breaks). Note that for text without spaces between words, such as Japanese, the entire text may be counted as a single word.",
        },
      },
      {
        question: {
          ja: "入力したテキストはサーバーに送信されますか？",
          en: "Is my input text sent to a server?",
        },
        answer: {
          ja: "送信されません。文字数のカウントはすべてブラウザ内のJavaScriptで行われます。",
          en: "No. Counting is done entirely with JavaScript in your browser.",
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
    howToUse: {
      ja: [
        "「エンコード」または「デコード」を選択します。",
        "エンコードの場合は変換したいテキストを、デコードの場合はBase64文字列を入力欄に貼り付けます。",
        "結果は即座に下の欄に表示されます。「結果を入力欄に反映して切り替え」で、出力結果をそのまま逆方向の変換に使うこともできます。",
        "「クリップボードへコピー」で結果をコピー、「クリア」で入力内容をリセットできます。",
      ],
      en: [
        "Choose \"Encode\" or \"Decode\".",
        "For encoding, paste the text you want to convert; for decoding, paste a Base64 string.",
        "The result appears instantly below. \"Swap result into the input\" lets you feed the output straight into the opposite conversion.",
        "Use \"Copy to clipboard\" to copy the result, or \"Clear\" to reset the input.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "Base64変換ツールは、テキストをBase64形式にエンコードしたり、Base64文字列を元のテキストにデコードしたりできるツールです。メールの添付ファイルやAPIのレスポンス、設定ファイルの中などでBase64エンコードされたデータを扱う際の確認・変換作業に活用できます。",
          "日本語などのマルチバイト文字にも対応しており、TextEncoder/TextDecoderを用いてUTF-8のバイト列を経由して変換するため、絵文字や日本語を含む文字列も正しくエンコード・デコードできます。",
        ],
        en: [
          "The Base64 converter lets you encode text into Base64 or decode a Base64 string back into text. It's useful for inspecting and converting Base64-encoded data found in email attachments, API responses, or configuration files.",
          "It supports multi-byte characters such as Japanese, converting through a UTF-8 byte sequence via TextEncoder/TextDecoder, so strings containing emoji or Japanese text are encoded and decoded correctly.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "日本語や絵文字を含む文字列もエンコードできますか？",
          en: "Can I encode strings that contain Japanese or emoji?",
        },
        answer: {
          ja: "できます。入力されたテキストはUTF-8のバイト列に変換した上でBase64エンコードされるため、日本語や絵文字を含む文字列も問題なく扱えます。",
          en: "Yes. Your input is converted to a UTF-8 byte sequence before Base64 encoding, so text containing Japanese or emoji is handled correctly.",
        },
      },
      {
        question: {
          ja: "デコードでエラーが出るのはなぜですか？",
          en: "Why do I get an error when decoding?",
        },
        answer: {
          ja: "入力された文字列がBase64として不正な形式（使用できない文字が含まれる、長さが不正など）の場合にエラーが表示されます。コピー時に余分な文字や改行が混入していないか確認してください。",
          en: "An error appears when the input isn't valid Base64 (it contains disallowed characters, has an invalid length, etc.). Check that no extra characters or line breaks were included when you copied it.",
        },
      },
      {
        question: {
          ja: "URLセーフなBase64（Base64URL）には対応していますか？",
          en: "Does it support URL-safe Base64 (Base64URL)?",
        },
        answer: {
          ja: "現在は標準のBase64（+ と / を使用する形式）にのみ対応しています。Base64URL形式（- と _ を使用）の文字列は、標準形式に置き換えてから入力してください。",
          en: "Currently only standard Base64 (using + and /) is supported. For Base64URL strings (using - and _), convert them to the standard format before entering them.",
        },
      },
      {
        question: {
          ja: "入力したデータはサーバーに送信されますか？",
          en: "Is my input data sent to a server?",
        },
        answer: {
          ja: "送信されません。エンコード・デコードの処理はすべてブラウザ内のJavaScriptで行われます。",
          en: "No. Encoding and decoding are done entirely with JavaScript in your browser.",
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
  {
    id: "json-formatter",
    name: { ja: "JSON整形・TypeScript型変換", en: "JSON Formatter & TypeScript Converter" },
    description: {
      ja: "JSONの整形・Minifyと、TypeScriptの型定義生成を行います。",
      en: "Format or minify JSON, and generate TypeScript type definitions from it.",
    },
    longDescription: {
      ja: "入力したJSONを2スペース・4スペース・1行化（Minify）で整形したり、TypeScriptのinterface定義コードに変換したりできるツールです。リアルタイムに構文チェックを行い、すべての処理はブラウザ内で完結します。",
      en: "A tool for formatting JSON with 2-space, 4-space, or single-line (minify) indentation, or converting it into TypeScript interface definitions. It checks syntax in real time, and everything runs in your browser.",
    },
    howToUse: {
      ja: [
        "左側の入力欄に整形・変換したいJSONを貼り付けます。",
        "「整形 (Format)」タブでは2スペース・4スペース・1行化 (Minify) のいずれかを選び、読みやすい形式に整形します。",
        "「TypeScript型生成」タブに切り替えると、入力したJSONの構造からTypeScriptのinterface定義コードが自動生成されます。",
        "構文エラーがある場合は該当する行・列番号とエラー内容が表示されるので、修正後に再度確認できます。",
      ],
      en: [
        "Paste the JSON you want to format or convert into the input area on the left.",
        "On the \"Format\" tab, choose 2-space, 4-space, or single-line (minify) indentation to format it in a readable way.",
        "Switch to the \"TypeScript Types\" tab to automatically generate a TypeScript interface definition from the structure of your JSON.",
        "If there's a syntax error, the exact line and column number and the error message are shown, so you can fix it and check again.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "JSON整形・TypeScript型変換ツールは、崩れたJSONを読みやすく整形したり、JSONの構造からTypeScriptの型定義コードを自動生成したりできるツールです。APIレスポンスの確認や、外部から取得したJSONデータに対応する型定義を素早く作成したい場合に活用できます。",
          "構文チェックには独自の簡易JSONパーサーを使用しており、JavaScriptエンジンごとに異なる`JSON.parse`のエラーメッセージ形式に依存せず、常に正確な行・列番号でエラー箇所を特定します。",
          "TypeScript型生成では、配列内に含まれる構造が同じオブジェクトを1つのinterfaceにまとめ、要素によって存在したりしなかったりするフィールドは自動的にオプショナル（`?`）として出力します。",
        ],
        en: [
          "This tool formats messy JSON into a readable structure, or automatically generates TypeScript type definitions from the shape of your JSON. It's handy for inspecting API responses or quickly creating type definitions for JSON data you've fetched from elsewhere.",
          "Syntax checking uses a custom lightweight JSON parser, so error locations are always pinpointed with accurate line and column numbers, unlike the inconsistent `JSON.parse` error formats across JavaScript engines.",
          "For TypeScript generation, objects that share the same shape within an array are merged into a single interface, and fields that are only sometimes present are automatically marked optional (`?`).",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "生成されたTypeScriptの型はそのまま使えますか？",
          en: "Can I use the generated TypeScript types as-is?",
        },
        answer: {
          ja: "生成された`interface`定義はコピーしてそのままプロジェクトに貼り付けて利用できます。ただし、フィールド名や型の意味づけ（IDなど）は自動判定のため、必要に応じて命名や型を調整してください。",
          en: "Yes, the generated `interface` definition can be copied and pasted directly into your project. However, since field names and semantic meaning (like IDs) are inferred automatically, you may want to adjust the naming or types as needed.",
        },
      },
      {
        question: {
          ja: "巨大なJSONでも整形できますか？",
          en: "Can it format very large JSON?",
        },
        answer: {
          ja: "ブラウザのメモリが許す範囲であれば整形可能です。非常に大きなJSONの場合、ブラウザの動作が一時的に重くなることがあります。",
          en: "Yes, as long as your browser's memory allows it. For very large JSON, the browser may become temporarily sluggish.",
        },
      },
      {
        question: {
          ja: "配列のトップレベルのJSONにも対応していますか？",
          en: "Does it support JSON with an array at the top level?",
        },
        answer: {
          ja: "対応しています。配列がトップレベルの場合は、型生成時に配列の要素の型を表す`type`エイリアスが生成されます。",
          en: "Yes. When the top level is an array, type generation produces a `type` alias representing the type of the array's elements.",
        },
      },
      {
        question: {
          ja: "入力したJSONはサーバーに送信されますか？",
          en: "Is my input JSON sent to a server?",
        },
        answer: {
          ja: "送信されません。構文チェック・整形・型生成のすべての処理はブラウザ内のJavaScriptで実行されます。",
          en: "No. Syntax checking, formatting, and type generation all run in your browser's JavaScript.",
        },
      },
    ],
    category: "converter",
    icon: FileJson,
    keywords: {
      ja: "json 整形 フォーマット minify typescript 型定義 interface 変換",
      en: "json formatter minify typescript interface type definition convert",
    },
  },
  {
    id: "image-converter",
    name: { ja: "画像圧縮・フォーマット変換", en: "Image Compressor & Format Converter" },
    description: {
      ja: "画像をJPEG/PNG/WebPに変換し、画質やサイズを調整して圧縮します。",
      en: "Convert images to JPEG, PNG, or WebP and compress them by adjusting quality and size.",
    },
    longDescription: {
      ja: "画像ファイルをJPEG・PNG・WebP形式に変換し、画質（圧縮率）やリサイズを調整しながら圧縮できるツールです。Canvas APIによりブラウザ内で圧縮後のサイズをリアルタイムに試算・プレビューでき、サーバーへ画像がアップロードされることはありません。",
      en: "A tool for converting image files to JPEG, PNG, or WebP while adjusting quality (compression) and resizing. The Canvas API lets you preview and estimate the compressed size in real time, right in your browser — nothing is ever uploaded to a server.",
    },
    howToUse: {
      ja: [
        "画像ファイルをドラッグ＆ドロップするか、クリックしてファイルを選択します（PNG・JPEG・WebP・GIF・BMP・AVIFに対応）。",
        "出力フォーマット（JPEG・PNG・WebP）を選び、画質（圧縮率）のスライダーを調整します。PNGを選択した場合、ロスレス形式のため画質スライダーは無効になります。",
        "リサイズしたい場合は、幅・高さのスライダーまたは数値入力で調整します。「アスペクト比を維持」をONにすると、片方を変更するともう片方が自動的に追従します。",
        "元のサイズ・圧縮後の想定サイズ・削減率とプレビューを確認しながら、「圧縮画像をダウンロード」でファイルを保存します。",
      ],
      en: [
        "Drag and drop an image file, or click to select one (PNG, JPEG, WebP, GIF, BMP, and AVIF are supported).",
        "Choose an output format (JPEG, PNG, or WebP) and adjust the quality (compression) slider. When PNG is selected, the quality slider is disabled since PNG is lossless.",
        "To resize, adjust the width and height sliders or number inputs. With \"Keep aspect ratio\" on, changing one dimension automatically updates the other.",
        "Check the original size, estimated compressed size, reduction rate, and preview, then click \"Download compressed image\" to save the file.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "画像圧縮・フォーマット変換ツールは、画像ファイルをJPEG・PNG・WebP形式に変換し、画質やサイズを調整しながら圧縮できるツールです。Webサイトに掲載する画像の軽量化や、異なる形式への変換が必要な場合に活用できます。",
          "Canvas APIの`toBlob`を使用して、フォーマットや画質・リサイズの設定を変更するたびに非同期で圧縮結果を再生成し、元のサイズとの比較や削減率をリアルタイムに確認できます。",
          "お使いのブラウザが選択した出力フォーマットのエンコードに対応していない場合（一部のSafari/WebKit系ブラウザでのWebP出力など）は、その旨を警告として表示し、実際に生成されたフォーマットに応じてダウンロード時の拡張子を自動調整します。",
        ],
        en: [
          "This tool converts image files to JPEG, PNG, or WebP, letting you compress them while adjusting quality and size. It's useful for shrinking images for a website or converting between formats.",
          "It uses the Canvas API's `toBlob` to asynchronously regenerate the compressed result every time you change the format, quality, or resize settings, so you can compare it against the original size and see the reduction rate in real time.",
          "If your browser doesn't support encoding to the selected output format (such as WebP output on some Safari/WebKit browsers), a warning is shown, and the file extension on download is automatically adjusted to match the format actually produced.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "WebPを選んだのにPNGと同じサイズになるのはなぜですか？",
          en: "Why do I get a PNG-sized file even though I chose WebP?",
        },
        answer: {
          ja: "一部のブラウザ（主にSafariなどのWebKit系）はCanvas APIによるWebPへの変換に対応しておらず、その場合は仕様により自動的にPNG（ロスレス）として出力されます。この場合、画面上に「お使いのブラウザは対応していないため〜で出力されています」という警告が表示されます。Chromeなど対応ブラウザでは正しくWebPとして圧縮されます。",
          en: "Some browsers (mainly WebKit-based ones like Safari) don't support Canvas-based WebP conversion, so by spec they automatically fall back to lossless PNG output. In that case, a warning is shown saying your browser isn't supported and the actual output format used. Supported browsers like Chrome compress correctly to WebP.",
        },
      },
      {
        question: {
          ja: "画質スライダーがPNG選択時に操作できません。",
          en: "Why can't I move the quality slider when PNG is selected?",
        },
        answer: {
          ja: "PNGはロスレス（可逆）圧縮のため、画質（圧縮率）の概念が存在せず、スライダーを操作してもファイルサイズは変化しません。サイズを小さくしたい場合はリサイズ機能をご利用ください。",
          en: "Because PNG is lossless compression, there's no concept of quality/compression level, so moving the slider wouldn't change the file size. Use the resize feature instead if you want a smaller file.",
        },
      },
      {
        question: {
          ja: "アスペクト比を維持せずに画像を変形できますか？",
          en: "Can I resize the image without keeping the aspect ratio?",
        },
        answer: {
          ja: "「アスペクト比を維持」のチェックを外すと、幅と高さを独立して指定できるようになり、意図的に画像を引き伸ばす・押しつぶすこともできます。",
          en: "Yes, unchecking \"Keep aspect ratio\" lets you set width and height independently, so you can intentionally stretch or squash the image.",
        },
      },
      {
        question: {
          ja: "画像はサーバーにアップロードされますか？",
          en: "Are images uploaded to a server?",
        },
        answer: {
          ja: "アップロードされません。画像の読み込み・圧縮・プレビュー生成はすべてブラウザ内のCanvas APIで処理されます。",
          en: "No. Loading, compressing, and generating previews all happen in your browser via the Canvas API.",
        },
      },
    ],
    category: "converter",
    icon: ImageDown,
    keywords: {
      ja: "画像 画像圧縮 画像変換 フォーマット変換 jpeg png webp リサイズ",
      en: "image compress image converter format conversion jpeg png webp resize",
    },
  },
  {
    id: "csv-json-converter",
    name: { ja: "CSV/JSON相互変換", en: "CSV/JSON Converter" },
    description: {
      ja: "CSVとJSONを相互に変換し、テーブル形式でプレビューします。",
      en: "Convert between CSV and JSON with a table preview.",
    },
    longDescription: {
      ja: "CSV形式とJSON形式のデータをブラウザ内で相互に変換できるツールです。区切り文字やヘッダー有無を選択でき、変換結果はテーブル形式でプレビューできます。JSON→CSVではファイルとしてダウンロードも可能です。",
      en: "A tool for converting data between CSV and JSON right in your browser. You can choose the delimiter and whether the first row is a header, and preview the result as a table. For JSON→CSV, you can also download the result as a file.",
    },
    howToUse: {
      ja: [
        "「CSV → JSON」または「JSON → CSV」を選び、変換したいデータを左側の入力欄に貼り付けます。",
        "区切り文字（カンマ・タブ・セミコロン）を選択します。CSV → JSONの場合は「1行目をヘッダーとして扱う」の要否も選べます。",
        "右側に変換結果がリアルタイムに表示されます。下部にはテーブル形式のプレビューも表示されます。",
        "「クリップボードへコピー」で結果をコピーするか、JSON → CSVの場合は「CSVをダウンロード」でファイルとして保存できます。",
      ],
      en: [
        "Choose \"CSV → JSON\" or \"JSON → CSV\" and paste the data you want to convert into the input area on the left.",
        "Choose a delimiter (comma, tab, or semicolon). For CSV → JSON, you can also choose whether to treat the first row as a header.",
        "The converted result appears in real time on the right, with a table preview underneath.",
        "Use \"Copy to clipboard\" to copy the result, or, for JSON → CSV, \"Download CSV\" to save it as a file.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "CSV/JSON相互変換ツールは、CSV形式とJSON形式のデータをブラウザ内で相互に変換できるツールです。スプレッドシートからエクスポートしたCSVをAPIやプログラムで扱いやすいJSONに変換したり、逆にJSONデータを表計算ソフトで開けるCSVに変換したりする際に活用できます。",
          "引用符で囲まれたフィールドやフィールド内の改行・エスケープされたダブルクォートにも対応した簡易CSVパーサーを実装しており、実務で扱う複雑なCSVでも崩れずに変換できます。変換結果はテーブル形式でもプレビューされるため、意図した通りにデータが解釈されているかをその場で確認できます。",
          "入力したデータがサーバーに送信されることはなく、すべての変換処理はお使いのブラウザ内のJavaScriptだけで完結します。",
        ],
        en: [
          "This tool converts data between CSV and JSON right in your browser. It's useful for turning a CSV exported from a spreadsheet into JSON that's easy to work with in an API or program, or the other way around, converting JSON into a CSV you can open in spreadsheet software.",
          "It implements a lightweight CSV parser that handles quoted fields, line breaks within fields, and escaped double quotes, so it can correctly convert complex real-world CSV files. The result is also previewed as a table so you can immediately check that the data was interpreted as intended.",
          "Your input data is never sent to a server — all conversion happens entirely with JavaScript in your browser.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "大きなCSVファイルでも変換できますか？",
          en: "Can it convert large CSV files?",
        },
        answer: {
          ja: "ブラウザのメモリが許す範囲であれば変換可能です。ただしテーブルプレビューは処理の負荷を抑えるため最初の200行のみ表示します（変換結果自体は全件が出力されます）。",
          en: "Yes, as long as your browser's memory allows it. However, to keep things responsive, the table preview only shows the first 200 rows (the full conversion result still includes every row).",
        },
      },
      {
        question: {
          ja: "ヘッダーがないCSVはどう扱われますか？",
          en: "How is a CSV without a header handled?",
        },
        answer: {
          ja: "「1行目をヘッダーとして扱う」のチェックを外すと、各行を配列としてJSON化し、列見出しは「列1」「列2」のように自動で採番されます。",
          en: "If you uncheck \"Treat first row as header\", each row is converted to a JSON array, and column headers are automatically numbered like \"Column 1\", \"Column 2\", and so on.",
        },
      },
      {
        question: {
          ja: "JSONの構造に制限はありますか？",
          en: "Are there any restrictions on the JSON structure?",
        },
        answer: {
          ja: "オブジェクトの配列（例: [{\"a\":1}]）、配列の配列、単一オブジェクトのいずれもCSVに変換できます。オブジェクトごとにキーが異なる場合は、全オブジェクトのキーを統合した列見出しが生成され、存在しない値は空欄になります。",
          en: "You can convert an array of objects (e.g. [{\"a\":1}]), an array of arrays, or a single object to CSV. If objects have differing keys, column headers are generated from the union of all keys, and missing values are left blank.",
        },
      },
      {
        question: {
          ja: "変換したデータはサーバーに保存されますか？",
          en: "Is my converted data saved on a server?",
        },
        answer: {
          ja: "いいえ。入力・変換・ダウンロードのすべての処理はブラウザ内で完結し、外部サーバーへデータが送信されることはありません。",
          en: "No. Input, conversion, and download all happen entirely in your browser, and no data is ever sent to an external server.",
        },
      },
    ],
    category: "converter",
    icon: FileSpreadsheet,
    keywords: {
      ja: "csv json 変換 テーブル スプレッドシート",
      en: "csv json convert table spreadsheet csv to json json to csv",
    },
  },
  {
    id: "regex-tester",
    name: { ja: "正規表現テスト・テキスト抽出", en: "Regex Tester & Text Extractor" },
    description: {
      ja: "正規表現をリアルタイムでテストし、マッチ箇所を抽出します。",
      en: "Test regular expressions in real time and extract matches.",
    },
    longDescription: {
      ja: "正規表現パターンとフラグ（g, i, m, s, u）を指定し、対象テキストに対するマッチ箇所をリアルタイムでハイライト表示・一覧化できるツールです。メールアドレスやURLなどのよく使うパターンプリセットも用意しています。",
      en: "A tool for specifying a regular expression pattern and flags (g, i, m, s, u) and highlighting and listing matches against your text in real time. It also includes presets for common patterns like email addresses and URLs.",
    },
    howToUse: {
      ja: [
        "パターン欄に正規表現を入力するか、右側の「よく使うパターン」からプリセットを選択します。",
        "g・i・m・s・uの各フラグをクリックしてON/OFFを切り替えます。gを有効にすると全マッチを検索します。",
        "対象テキスト欄に検索したいテキストを入力すると、マッチ箇所が右側にリアルタイムでハイライト表示されます。",
        "下部の「マッチ一覧」でマッチ位置・マッチ文字列・キャプチャグループを確認し、「クリップボードへコピー」で抽出結果を改行区切りでコピーできます。",
      ],
      en: [
        "Enter a regular expression in the pattern field, or choose one from \"Common patterns\" on the right.",
        "Click the g, i, m, s, and u flags to toggle them on/off. Enabling g searches for all matches.",
        "Type the text you want to search in the target text field, and matches are highlighted on the right in real time.",
        "Check the match position, matched string, and capture groups in the \"Matches\" list below, and use \"Copy to clipboard\" to copy the extracted results, one per line.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "正規表現テスト・テキスト抽出ツールは、JavaScriptの正規表現をブラウザ上で試しながら、テキストからのパターン抽出結果をその場で確認できるツールです。ログファイルからの情報抽出、フォームの入力値検証、データクレンジングなど、正規表現を使うさまざまな作業の動作確認に活用できます。",
          "g・i・m・s・uといった主要なフラグの切り替えに対応しており、gフラグを外した場合は実際のJavaScriptの挙動と同じく最初のマッチのみが検出されます。マッチした文字列は元のテキスト上でハイライト表示されるため、意図した箇所を正しく抽出できているかを視覚的に確認できます。",
          "メールアドレスやURL、電話番号など、実務でよく使われる正規表現パターンをプリセットとして用意しているため、ゼロからパターンを書かなくても目的のパターンをすぐに試すことができます。",
        ],
        en: [
          "This tool lets you try out JavaScript regular expressions right in your browser and immediately see the results of extracting patterns from text. It's useful for verifying regex used for extracting data from log files, validating form input, cleaning data, and more.",
          "It supports toggling the main flags — g, i, m, s, and u. With the g flag off, only the first match is detected, matching actual JavaScript behavior. Matched strings are highlighted directly in the original text so you can visually confirm you're extracting the right parts.",
          "Presets for commonly used patterns — email addresses, URLs, phone numbers, and more — are included, so you can try out a pattern right away without writing one from scratch.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "名前付きキャプチャグループには対応していますか？",
          en: "Does it support named capture groups?",
        },
        answer: {
          ja: "対応しています。「(?<name>パターン)」のように名前付きグループを使用すると、マッチ一覧に「name: 値」の形式で表示されます。",
          en: "Yes. When you use a named group like \"(?<name>pattern)\", it's shown in the match list as \"name: value\".",
        },
      },
      {
        question: {
          ja: "gフラグを外すとどうなりますか？",
          en: "What happens if I turn off the g flag?",
        },
        answer: {
          ja: "実際のJavaScriptの正規表現と同じ挙動になり、最初にマッチした1件のみが検出されます。複数のマッチをすべて確認したい場合はgフラグを有効にしてください。",
          en: "It behaves the same as actual JavaScript regular expressions, detecting only the first match. Enable the g flag if you want to see all matches.",
        },
      },
      {
        question: {
          ja: "無効な正規表現を入力するとどうなりますか？",
          en: "What happens if I enter an invalid regular expression?",
        },
        answer: {
          ja: "パターンの下にエラーメッセージが表示され、マッチ処理は行われません。括弧の対応やエスケープを見直してください。",
          en: "An error message appears below the pattern field, and no matching is performed. Check that parentheses are balanced and escaping is correct.",
        },
      },
      {
        question: {
          ja: "入力したテキストはサーバーに送信されますか？",
          en: "Is my input text sent to a server?",
        },
        answer: {
          ja: "送信されません。正規表現の評価とマッチングはすべてブラウザ内のJavaScriptエンジンで実行されます。",
          en: "No. Regular expression evaluation and matching all run in your browser's JavaScript engine.",
        },
      },
    ],
    category: "developer",
    icon: Regex,
    keywords: {
      ja: "正規表現 regex regexp テキスト抽出 パターンマッチ",
      en: "regex regexp regular expression text extraction pattern match",
    },
  },
  {
    id: "url-encoder",
    name: { ja: "URLエンコード・クエリ分解", en: "URL Encoder & Query Parser" },
    description: {
      ja: "URLのエンコード/デコードと、クエリパラメータの分解・編集を行います。",
      en: "Encode/decode URLs and break down and edit query parameters.",
    },
    longDescription: {
      ja: "URLエンコード（encodeURIComponent / encodeURI）・デコードと、URLのクエリパラメータ（?key=value）を表形式で抽出・編集・再生成できるツールです。すべての処理はブラウザ内で完結します。",
      en: "A tool for URL encoding (encodeURIComponent / encodeURI) and decoding, plus extracting, editing, and regenerating a URL's query parameters (?key=value) as a table. Everything runs entirely in your browser.",
    },
    howToUse: {
      ja: [
        "「エンコード/デコード」タブでは、テキストを入力し、encodeURIComponent（値のエンコードに最適）またはencodeURI（URL全体のエンコードに最適）を選んで変換します。",
        "「クエリパラメータ分解」タブでは、URLを入力して「分解する」を押すと、ベースURLとクエリパラメータが自動で抽出されます。",
        "抽出されたパラメータはキー・値を直接編集したり、「パラメータを追加」で新規追加、×ボタンで削除したりできます。",
        "編集内容は「再生成されたURL」欄にリアルタイムで反映されるので、「クリップボードへコピー」でそのまま利用できます。",
      ],
      en: [
        "On the \"Encode / Decode\" tab, enter text and choose encodeURIComponent (best for encoding a single value) or encodeURI (best for encoding a whole URL) to convert it.",
        "On the \"Parse Query Parameters\" tab, enter a URL and click \"Parse\" to automatically extract the base URL and query parameters.",
        "You can directly edit the extracted parameters' keys and values, add a new one with \"Add parameter\", or remove one with the × button.",
        "Your edits are reflected in the \"Regenerated URL\" field in real time, ready to use via \"Copy to clipboard\".",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "URLエンコード・クエリパラメータ分解ツールは、URLに含まれる日本語や記号のエンコード・デコードと、クエリパラメータの内容確認・編集をブラウザ内で行えるツールです。APIのリクエストURLを組み立てる際や、長いURLに含まれるパラメータの意味を調べたいときに役立ちます。",
          "encodeURIComponentとencodeURIは、エンコード対象とする文字の範囲が異なります。encodeURIComponentはクエリパラメータの値など文字列全体を丸ごとエンコードしたい場合に、encodeURIは「:」「/」「?」「#」などURLの構造を表す記号を保持したままURL全体をエンコードしたい場合に使用します。",
          "クエリパラメータ分解機能では、URLSearchParamsを利用して「?key1=value1&key2=value2」の形式を表形式に変換し、キーや値の追加・編集・削除を行った結果を即座に新しいURLとして再生成します。",
        ],
        en: [
          "This tool encodes and decodes Japanese text and symbols in URLs, and lets you inspect and edit query parameters, all in your browser. It's useful when building an API request URL or figuring out what the parameters in a long URL mean.",
          "encodeURIComponent and encodeURI differ in which characters they encode. Use encodeURIComponent when you want to encode an entire string, such as a query parameter value; use encodeURI when you want to encode a whole URL while preserving structural characters like \":\", \"/\", \"?\", and \"#\".",
          "The query parameter parsing feature uses URLSearchParams to convert a \"?key1=value1&key2=value2\" string into a table, and immediately regenerates a new URL as you add, edit, or remove keys and values.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "encodeURIComponentとencodeURIはどちらを使えばいいですか？",
          en: "Should I use encodeURIComponent or encodeURI?",
        },
        answer: {
          ja: "クエリパラメータの値など、URLの一部として埋め込む単一の文字列をエンコードする場合はencodeURIComponentを使用してください。すでに完成しているURL全体をエンコードしたい場合はencodeURIを使うと、URLの構造を表す記号（:/?#など）がエンコードされずに保持されます。",
          en: "Use encodeURIComponent when encoding a single string you'll embed as part of a URL, such as a query parameter value. Use encodeURI when encoding an already-complete URL, since it preserves structural characters (:/?# etc.) without encoding them.",
        },
      },
      {
        question: {
          ja: "同じキーが複数あるクエリパラメータは扱えますか？",
          en: "Can it handle query parameters with the same key repeated?",
        },
        answer: {
          ja: "扱えます。例えば「tag=a&tag=b」のように同じキーが複数存在する場合も、それぞれ別の行として表示・編集できます。",
          en: "Yes. When the same key appears multiple times, like \"tag=a&tag=b\", each occurrence is shown and editable as a separate row.",
        },
      },
      {
        question: {
          ja: "ハッシュ（#以降のフラグメント）はどうなりますか？",
          en: "What happens to the hash (the fragment after #)?",
        },
        answer: {
          ja: "ハッシュ部分はクエリパラメータとは区別して保持され、URLを再生成する際に末尾にそのまま付加されます。",
          en: "It's kept separate from the query parameters and appended back to the end when the URL is regenerated.",
        },
      },
      {
        question: {
          ja: "入力したURLはサーバーに送信されますか？",
          en: "Is my input URL sent to a server?",
        },
        answer: {
          ja: "送信されません。URLの分解・編集・再生成、エンコード・デコードのすべての処理はブラウザ内のJavaScriptで完結します。",
          en: "No. Parsing, editing, and regenerating URLs, as well as encoding and decoding, all happen entirely with JavaScript in your browser.",
        },
      },
    ],
    category: "converter",
    icon: Link2,
    keywords: {
      ja: "url エンコード デコード クエリパラメータ",
      en: "url encode decode query parameter encodeURIComponent encodeURI",
    },
  },
  {
    id: "hash-generator",
    name: { ja: "ハッシュ値生成・照合", en: "Hash Generator & Checker" },
    description: {
      ja: "MD5/SHA-1/SHA-256/SHA-384/SHA-512を計算し、期待値と照合します。",
      en: "Compute MD5, SHA-1, SHA-256, SHA-384, and SHA-512, and compare against an expected value.",
    },
    longDescription: {
      ja: "テキストやファイルからMD5・SHA-1・SHA-256・SHA-384・SHA-512のハッシュ値をWeb Crypto APIでブラウザ内で計算できるツールです。ファイルのドラッグ＆ドロップに対応し、期待値との一致（Match/Mismatch）判定も行えます。",
      en: "A tool that computes MD5, SHA-1, SHA-256, SHA-384, and SHA-512 hashes from text or a file using the Web Crypto API, right in your browser. It supports drag-and-drop file input and can check whether a hash matches an expected value.",
    },
    howToUse: {
      ja: [
        "テキストを入力するか、ファイルをドラッグ＆ドロップ（または「ファイルを選択」）します。",
        "MD5・SHA-1・SHA-256・SHA-384・SHA-512の各ハッシュ値がリアルタイムに計算され、一覧表示されます。",
        "各ハッシュ値はコピーボタンでクリップボードにコピーできます。",
        "配布元などで公開されている「期待値」のハッシュ値を入力欄に貼り付けると、一致する行に「Match」、一致しない行に「Mismatch」と表示されます。",
      ],
      en: [
        "Type text, or drag and drop a file (or click \"Choose file\").",
        "MD5, SHA-1, SHA-256, SHA-384, and SHA-512 hashes are computed in real time and listed.",
        "Each hash can be copied to the clipboard with its copy button.",
        "Paste an \"expected\" hash value published by a distributor into the input field, and the matching row shows \"Match\" while a mismatched row shows \"Mismatch\".",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "ハッシュ値生成・照合ツールは、テキストやファイルからMD5・SHA-1・SHA-256・SHA-384・SHA-512のハッシュ値をブラウザ内で計算できるツールです。ダウンロードしたファイルの改ざん検知や、配布されているチェックサムとの照合、APIキーやパスワードのハッシュ化の動作確認などに利用できます。",
          "SHA-1・SHA-256・SHA-384・SHA-512の計算にはブラウザ標準のWeb Crypto API（SubtleCrypto）を使用しています。MD5はセキュリティ上の理由からWeb Crypto APIには実装されていないため、本ツールでは検証済みの純粋なJavaScript実装によって計算しています。",
          "ファイルはサイズの大きなものでも、ブラウザのメモリが許す範囲であれば処理できます。ファイルの中身がサーバーに送信されることはありません。",
        ],
        en: [
          "This tool computes MD5, SHA-1, SHA-256, SHA-384, and SHA-512 hashes from text or a file, right in your browser. It's useful for detecting tampering in a downloaded file, checking it against a published checksum, or verifying the hashing behavior of an API key or password.",
          "SHA-1, SHA-256, SHA-384, and SHA-512 are computed using the browser's standard Web Crypto API (SubtleCrypto). MD5 isn't implemented in the Web Crypto API for security reasons, so this tool uses a verified pure JavaScript implementation for it instead.",
          "Even large files can be processed as long as your browser's memory allows it. File contents are never sent to a server.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "MD5やSHA-1はもう安全ではないと聞きました。使っても大丈夫ですか？",
          en: "I've heard MD5 and SHA-1 aren't secure anymore. Is it okay to use them?",
        },
        answer: {
          ja: "MD5やSHA-1は衝突攻撃に対して脆弱であることが知られており、パスワード保存や署名など、セキュリティが重要な用途には推奨されません。ファイルの改ざんチェックなど、配布元が提供する形式に合わせて照合する目的であれば、本ツールで問題なく利用できます。",
          en: "MD5 and SHA-1 are known to be vulnerable to collision attacks and aren't recommended for security-critical uses like password storage or signatures. But for purposes like checking file integrity against a checksum in the format a distributor provides, they're fine to use with this tool.",
        },
      },
      {
        question: {
          ja: "大文字・小文字が違うと一致と判定されませんか？",
          en: "Won't a case difference cause a match to fail?",
        },
        answer: {
          ja: "期待値との照合では大文字・小文字の違いや前後の空白を無視して比較するため、「ABCDEF」と「abcdef」のような表記の違いは一致として扱われます。",
          en: "No. Comparison against the expected value ignores case and surrounding whitespace, so differences like \"ABCDEF\" vs. \"abcdef\" are treated as a match.",
        },
      },
      {
        question: {
          ja: "ファイルとテキストを同時にハッシュ化できますか？",
          en: "Can I hash a file and text at the same time?",
        },
        answer: {
          ja: "できません。ファイルをドロップ・選択すると入力はファイルの内容に切り替わります。テキストに戻したい場合は「別の入力に戻る」を押してください。",
          en: "No. Dropping or selecting a file switches the input to the file's contents. To go back to text, click \"Back to another input\".",
        },
      },
      {
        question: {
          ja: "入力したファイルやテキストはサーバーに送信されますか？",
          en: "Is my input file or text sent to a server?",
        },
        answer: {
          ja: "送信されません。ハッシュ計算はすべてブラウザ内のWeb Crypto APIおよびJavaScriptで実行されます。",
          en: "No. Hash computation all happens in your browser using the Web Crypto API and JavaScript.",
        },
      },
    ],
    category: "developer",
    icon: Fingerprint,
    keywords: {
      ja: "ハッシュ hash md5 sha1 sha256 sha384 sha512 チェックサム",
      en: "hash md5 sha1 sha256 sha384 sha512 checksum",
    },
  },
  {
    id: "sql-formatter",
    name: { ja: "SQL整形・クエリフォーマッター", en: "SQL Formatter" },
    description: {
      ja: "崩れたSQLを自動でインデント整形し、方言や大文字小文字を調整します。",
      en: "Automatically indent-format messy SQL, adjusting for dialect and keyword case.",
    },
    longDescription: {
      ja: "崩れたSQLをsql-formatterライブラリで自動整形するツールです。Standard SQL・MySQL・PostgreSQLなどの方言選択、予約語の大文字/小文字変換、1行化（Minify）に対応しています。",
      en: "A tool that automatically formats messy SQL using the sql-formatter library. It supports choosing a dialect (Standard SQL, MySQL, PostgreSQL, and more), converting keyword case, and minifying to a single line.",
    },
    howToUse: {
      ja: [
        "左側の入力欄に整形したいSQLを貼り付けます。",
        "「整形 (Format)」タブでSQL方言（Standard, MySQL, PostgreSQLなど）と、予約語の大文字/小文字/そのままを選択します。",
        "右側にインデント・改行が整えられたSQLがリアルタイムに表示されます。",
        "1行のSQLに戻したい場合は「1行化 (Minify)」タブに切り替えると、コメントを除いた1行のSQLが生成されます。",
      ],
      en: [
        "Paste the SQL you want to format into the input area on the left.",
        "On the \"Format\" tab, choose a SQL dialect (Standard, MySQL, PostgreSQL, etc.) and whether reserved words should be uppercase, lowercase, or left as-is.",
        "The right side shows the indented, formatted SQL in real time.",
        "To collapse it back to a single line, switch to the \"Minify\" tab, which generates a single-line SQL statement with comments removed.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "SQL整形・クエリフォーマッターは、改行やインデントが崩れたSQLを読みやすい形式に自動整形できるツールです。ログに出力された1行のSQLや、他のツールが生成したSQLを確認・レビューする際に、構造をひと目で把握できるようになります。",
          "整形処理には人気のオープンソースライブラリ「sql-formatter」を使用しており、Standard SQLのほか、MySQL・PostgreSQL・SQLite・MariaDB・Transact-SQL（SQL Server）・BigQueryといった主要な方言ごとの構文の違いに対応した整形が可能です。",
          "予約語（SELECT、FROM、WHEREなど）の大文字・小文字を統一するオプションや、逆にSQLを1行に圧縮する機能も備えており、コーディング規約への統一やログ出力用のコンパクトなSQL生成にも活用できます。",
        ],
        en: [
          "This tool automatically reformats SQL with broken line breaks and indentation into a readable structure. It makes it easy to grasp the structure at a glance when reviewing a single-line SQL statement from a log, or SQL generated by another tool.",
          "Formatting is powered by the popular open-source library \"sql-formatter\", supporting Standard SQL as well as dialect-specific syntax for MySQL, PostgreSQL, SQLite, MariaDB, Transact-SQL (SQL Server), and BigQuery.",
          "It also offers an option to normalize the case of reserved words (SELECT, FROM, WHERE, etc.), plus a feature to compress SQL down to a single line — useful for enforcing a coding convention or producing compact SQL for logging.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "どのSQL方言を選べばよいかわかりません。",
          en: "I'm not sure which SQL dialect to choose.",
        },
        answer: {
          ja: "使用しているデータベース製品に合わせて選択してください。特定の方言固有の構文を使っていない場合は「標準SQL (Standard)」を選んでも多くの場合問題なく整形できます。",
          en: "Choose the one matching the database you're using. If you're not using syntax specific to a particular dialect, \"Standard SQL\" will usually format it fine.",
        },
      },
      {
        question: {
          ja: "整形結果の構文が実行環境と少し異なることがあります。",
          en: "The formatted syntax sometimes differs slightly from my actual environment.",
        },
        answer: {
          ja: "本ツールはSQLの構文を解析してインデントを整えるものであり、実際にSQLを実行して検証するものではありません。方言固有の関数や構文によっては意図通りに整形されない場合があります。",
          en: "This tool parses SQL syntax to adjust indentation — it doesn't actually execute or validate the SQL. Some dialect-specific functions or syntax may not format exactly as intended.",
        },
      },
      {
        question: {
          ja: "1行化（Minify）ではコメントはどうなりますか？",
          en: "What happens to comments when minifying?",
        },
        answer: {
          ja: "「--」による行コメントと「/* */」によるブロックコメントはいずれも除去され、残りの空白・改行が1つのスペースに畳まれた1行のSQLが生成されます。",
          en: "Both line comments starting with \"--\" and block comments using \"/* */\" are removed, and the remaining whitespace and line breaks are collapsed into single spaces to produce a single-line SQL statement.",
        },
      },
      {
        question: {
          ja: "入力したSQLはサーバーに送信されますか？",
          en: "Is my input SQL sent to a server?",
        },
        answer: {
          ja: "送信されません。SQLの整形・1行化はすべてブラウザ内のJavaScriptで実行されます。",
          en: "No. Formatting and minifying SQL both run entirely with JavaScript in your browser.",
        },
      },
    ],
    category: "developer",
    icon: Database,
    keywords: {
      ja: "sql 整形 フォーマッター mysql postgresql クエリ",
      en: "sql formatter mysql postgresql query minify",
    },
  },
  {
    id: "color-converter",
    name: { ja: "カラーコード変換・アクセシビリティ判定", en: "Color Converter & Accessibility Checker" },
    description: {
      ja: "HEX/RGB/HSL/HSV/CMYKを相互変換し、WCAGコントラスト比を判定します。",
      en: "Convert between HEX, RGB, HSL, HSV, and CMYK, and check WCAG contrast ratios.",
    },
    longDescription: {
      ja: "HEX・RGB・HSL・HSV・CMYKのカラーコードを相互変換し、コピーできるツールです。カラーピッカーにも対応しています。WCAG 2.1に基づくコントラスト比を計算し、AA/AAA基準のPass/Fail判定をサンプルテキストとともに確認できます。",
      en: "A tool for converting between HEX, RGB, HSL, HSV, and CMYK color codes and copying them, with color picker support. It also calculates contrast ratios based on WCAG 2.1 and shows AA/AAA pass/fail results with sample text.",
    },
    howToUse: {
      ja: [
        "カラーピッカーをクリックするか、HEX・RGB・HSL・HSV・CMYKのいずれかの欄に値を入力すると、他のすべての形式に自動で変換されます。",
        "各欄の右側のコピーボタンで、その形式の値をクリップボードにコピーできます。",
        "「コントラスト比判定」セクションで文字色と背景色を指定すると、WCAG 2.1に基づくコントラスト比と、AA/AAA基準のPass/Fail判定がサンプルテキストとともに表示されます。",
      ],
      en: [
        "Click the color picker, or enter a value in the HEX, RGB, HSL, HSV, or CMYK field, and it's automatically converted to all the other formats.",
        "Use the copy button next to each field to copy that format's value to the clipboard.",
        "In the \"Contrast Ratio Check\" section, specify a text color and background color to see the WCAG 2.1 contrast ratio and AA/AAA pass/fail results alongside sample text.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "カラーコード変換・アクセシビリティ判定ツールは、HEX・RGB・HSL・HSV・CMYKという5つの主要なカラー表記を相互に変換できるツールです。デザインツールとコードエディタで異なる表記が使われている場合の変換や、印刷用のCMYK値の確認などに活用できます。",
          "コントラスト比判定機能では、WCAG（Web Content Accessibility Guidelines）2.1で定められた計算式に基づき、2色間のコントラスト比を算出します。AA基準（通常テキストで4.5:1以上、大きいテキストで3:1以上）とAAA基準（通常テキストで7:1以上、大きいテキストで4.5:1以上）のそれぞれについて、Pass/Failをひと目で確認できます。",
          "Webサイトやアプリのテキストと背景色の組み合わせが、視覚に障害のあるユーザーにとっても読みやすいかどうかを、実装前に手軽にチェックするのに役立ちます。",
        ],
        en: [
          "This tool converts between the five major color notations — HEX, RGB, HSL, HSV, and CMYK. It's useful for converting between the notation used by a design tool and a code editor, or checking CMYK values for print.",
          "The contrast ratio checker calculates the contrast ratio between two colors based on the formula defined in WCAG (Web Content Accessibility Guidelines) 2.1. You can see pass/fail results at a glance for both the AA level (4.5:1 for normal text, 3:1 for large text) and the AAA level (7:1 for normal text, 4.5:1 for large text).",
          "It's handy for quickly checking, before implementation, whether a text and background color combination on a website or app is readable for users with visual impairments.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "AAとAAAの基準はどう違いますか？",
          en: "What's the difference between the AA and AAA levels?",
        },
        answer: {
          ja: "AAはWCAGの標準的な達成基準で、多くのWebサイトが目標とするレベルです。AAAはより厳しい基準で、より高いコントラストを要求します。公的機関のサイトなど、高いアクセシビリティが求められる場合にAAAが参照されることがあります。",
          en: "AA is WCAG's standard conformance level, and the target for most websites. AAA is a stricter level requiring higher contrast. It's sometimes referenced when high accessibility is required, such as for government sites.",
        },
      },
      {
        question: {
          ja: "「大きいテキスト」とは具体的にどのくらいのサイズですか？",
          en: "What size counts as \"large text\"?",
        },
        answer: {
          ja: "WCAGでは、18ポイント（24px相当）以上の通常のテキスト、または14ポイント（約18.66px相当）以上の太字のテキストを「大きいテキスト」として、やや緩やかな基準を適用します。",
          en: "WCAG defines \"large text\" as regular text at 18 points (about 24px) or larger, or bold text at 14 points (about 18.66px) or larger, and applies a slightly relaxed standard to it.",
        },
      },
      {
        question: {
          ja: "CMYKへの変換は印刷用途でそのまま使えますか？",
          en: "Can the CMYK conversion be used as-is for printing?",
        },
        answer: {
          ja: "本ツールのCMYK変換は一般的な数式変換（デバイス非依存の簡易変換）であり、実際の印刷機やインクの特性は考慮していません。正確な色再現が必要な印刷用途では、印刷会社が提供するカラープロファイルでの確認をおすすめします。",
          en: "This tool's CMYK conversion is a generic, device-independent mathematical conversion — it doesn't account for the characteristics of actual printers or inks. For printing where accurate color reproduction matters, we recommend checking against a color profile provided by your print vendor.",
        },
      },
      {
        question: {
          ja: "入力した色の情報はサーバーに送信されますか？",
          en: "Is my color information sent to a server?",
        },
        answer: {
          ja: "送信されません。色の変換やコントラスト比の計算は、すべてブラウザ内のJavaScriptで行われます。",
          en: "No. Color conversion and contrast ratio calculation all happen with JavaScript in your browser.",
        },
      },
    ],
    category: "converter",
    icon: Palette,
    keywords: {
      ja: "カラーコード 色変換 hex rgb hsl hsv cmyk コントラスト比 wcag アクセシビリティ",
      en: "color code color converter hex rgb hsl hsv cmyk contrast ratio wcag accessibility",
    },
  },
  {
    id: "jwt-decoder",
    name: { ja: "JWTデコーダー・構造解析", en: "JWT Decoder" },
    description: {
      ja: "JWTをHeader/Payload/Signatureに分解し、有効期限を判定します。",
      en: "Break a JWT down into Header, Payload, and Signature, and check its expiry.",
    },
    longDescription: {
      ja: "JWT（JSON Web Token）文字列をHeader・Payload・Signatureに分解し、それぞれをJSON整形表示できるツールです。exp・nbfなどのUnixタイムスタンプを日時に自動変換し、有効期限切れを警告表示します。署名の検証は行いません。",
      en: "A tool that breaks a JWT (JSON Web Token) string down into its Header, Payload, and Signature, displaying each as formatted JSON. It automatically converts Unix timestamp claims like exp and nbf into readable dates and warns when a token has expired. It does not verify the signature.",
    },
    howToUse: {
      ja: [
        "入力欄にJWT（JSON Web Token）文字列を貼り付けます。",
        "Header・Payloadが整形されたJSONとして自動的に表示されます。",
        "PayloadにexpやnbfなどのUnixタイムスタンプが含まれる場合、日時表記に変換した一覧が表示され、有効期限切れの場合は警告バッジが表示されます。",
        "Signature部分はデコードされた値がそのまま（Base64URL文字列として）表示されます。",
      ],
      en: [
        "Paste a JWT (JSON Web Token) string into the input field.",
        "The Header and Payload are automatically shown as formatted JSON.",
        "If the payload contains Unix timestamp claims like exp or nbf, a list showing them converted to readable dates is displayed, along with a warning badge if the token has expired.",
        "The Signature is shown decoded as-is (as a Base64URL string).",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "JWTデコーダー・構造解析ツールは、JWT（JSON Web Token）文字列をHeader・Payload・Signatureの3つの部分に分解し、それぞれの内容を確認できるツールです。認証・認可の実装時に、発行されたトークンの中身をデバッグする用途で活用できます。",
          "JWTのHeaderとPayloadはBase64URLでエンコードされたJSONです。本ツールはこれをデコードして整形表示するとともに、`exp`（有効期限）・`nbf`（Not Before）・`iat`（発行日時）といった標準クレームのUnixタイムスタンプを人間が読める日時形式に自動変換します。",
          "本ツールはJWTの内容を可視化するものであり、署名の検証は行いません。署名が正しいかどうかを確認するには、発行元のシークレットキーまたは公開鍵を用いたサーバーサイドでの検証が必要です。",
        ],
        en: [
          "This tool breaks a JWT (JSON Web Token) string down into its three parts — Header, Payload, and Signature — and lets you inspect each one. It's useful for debugging the contents of an issued token while implementing authentication or authorization.",
          "A JWT's Header and Payload are Base64URL-encoded JSON. This tool decodes and formats them, and automatically converts standard claim timestamps like `exp` (expiry), `nbf` (not before), and `iat` (issued at) into human-readable dates.",
          "This tool only visualizes the token's contents — it does not verify the signature. Confirming whether a signature is valid requires server-side verification using the issuer's secret or public key.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "このツールで署名の正当性を確認できますか？",
          en: "Can this tool verify whether the signature is valid?",
        },
        answer: {
          ja: "できません。署名の検証にはJWTの発行に使われた秘密鍵または公開鍵が必要ですが、本ツールはそれらを扱わず、あくまでHeader・Payloadの中身をデコードして表示するだけです。",
          en: "No. Verifying a signature requires the private or public key used to issue the JWT, which this tool doesn't handle — it only decodes and displays the contents of the Header and Payload.",
        },
      },
      {
        question: {
          ja: "「有効期限切れ」と表示されるのはどのような場合ですか？",
          en: "When does it show \"Expired\"?",
        },
        answer: {
          ja: "PayloadにExp（exp）クレームが含まれており、その値が現在時刻より過去である場合に表示されます。逆にNot Before（nbf）クレームが未来の場合は「まだ有効ではありません」と表示されます。",
          en: "It's shown when the payload contains an exp claim and its value is earlier than the current time. Conversely, if the nbf (not before) claim is in the future, \"Not yet valid\" is shown.",
        },
      },
      {
        question: {
          ja: "貼り付けたJWTがデコードできないのはなぜですか？",
          en: "Why can't my pasted JWT be decoded?",
        },
        answer: {
          ja: "JWTは「ヘッダー.ペイロード.署名」の3つの部分がピリオドで区切られた形式である必要があります。コピー時に余分な空白や改行が混入していないか、3つの部分がすべて揃っているかを確認してください。",
          en: "A JWT must have three parts — header, payload, and signature — separated by periods. Check that no extra whitespace or line breaks were included when copying, and that all three parts are present.",
        },
      },
      {
        question: {
          ja: "入力したJWTはサーバーに送信されますか？",
          en: "Is my input JWT sent to a server?",
        },
        answer: {
          ja: "送信されません。デコード処理はすべてブラウザ内のJavaScriptで実行され、外部に送信されることはありません。ただし、本物の認証トークンを第三者のツールに貼り付けること自体にリスクが伴う場合があるため、取り扱いには注意してください。",
          en: "No. Decoding all happens with JavaScript in your browser and is never sent externally. That said, pasting a real authentication token into any third-party tool carries some inherent risk, so please handle tokens with care.",
        },
      },
    ],
    category: "developer",
    icon: KeyRound,
    keywords: {
      ja: "jwt json web token デコード 認証 header payload 有効期限",
      en: "jwt json web token decode auth header payload expiry",
    },
  },
  {
    id: "markdown-editor",
    name: { ja: "Markdownエディタ・HTML変換", en: "Markdown Editor & HTML Converter" },
    description: {
      ja: "Markdownをリアルタイムプレビューし、HTMLへ変換・出力します。",
      en: "Preview Markdown in real time and convert or export it to HTML.",
    },
    longDescription: {
      ja: "Markdownをリアルタイムプレビューしながら編集できるエディタです。GitHub Flavored Markdown（テーブル・タスクリスト・取り消し線など）に対応し、変換後のHTMLコードのコピーや、.md/.htmlファイルとしてのダウンロードができます。",
      en: "An editor for writing Markdown with a real-time preview. It supports GitHub Flavored Markdown (tables, task lists, strikethrough, and more), and lets you copy the converted HTML or download it as .md/.html files.",
    },
    howToUse: {
      ja: [
        "左側のエディタにMarkdownを入力すると、右側に変換結果がリアルタイムに反映されます。",
        "「プレビュー」タブでは、実際にどのように表示されるかを確認できます。テーブル・タスクリスト・取り消し線などのGitHub Flavored Markdown（GFM）記法にも対応しています。",
        "「HTMLコード」タブに切り替えると、変換後のHTMLソースコードが表示され、「クリップボードへコピー」でそのまま他のシステムに貼り付けられます。",
        "「Markdown (.md) をダウンロード」「HTML (.html) をダウンロード」で、それぞれの形式のファイルとして保存できます。",
      ],
      en: [
        "Type Markdown into the editor on the left, and the result updates in real time on the right.",
        "The \"Preview\" tab shows how it will actually be rendered, including GitHub Flavored Markdown (GFM) syntax like tables, task lists, and strikethrough.",
        "Switch to the \"HTML Code\" tab to see the converted HTML source, ready to paste elsewhere with \"Copy to clipboard\".",
        "Use \"Download Markdown (.md)\" or \"Download HTML (.html)\" to save it as a file in either format.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "Markdownリアルタイムプレビュー・HTML変換ツールは、Markdownで書いた文章をリアルタイムにプレビューしながら、HTMLへの変換・抽出も行えるツールです。READMEファイルの下書き、ブログ記事の執筆、ドキュメントのHTML化など、Markdownを扱うさまざまな場面で活用できます。",
          "テーブル、タスクリスト（チェックボックス）、取り消し線、コードブロックのシンタックスハイライト用クラス付与といった、GitHub Flavored Markdown（GFM）の主要な拡張記法に対応しています。",
          "生成されたHTMLは、ブラウザ内でDOMPurifyによるサニタイズ処理を行った上で表示・出力しており、Markdown内に埋め込まれた不正なスクリプトなどが実行されないよう配慮しています。",
        ],
        en: [
          "This tool lets you preview Markdown text in real time while also converting and extracting it to HTML. It's useful for drafting README files, writing blog posts, converting documentation to HTML, and other Markdown-related tasks.",
          "It supports the major GitHub Flavored Markdown (GFM) extensions — tables, task lists (checkboxes), strikethrough, and syntax-highlighting classes on code blocks.",
          "The generated HTML is sanitized with DOMPurify in your browser before being displayed or exported, so that any malicious script embedded in the Markdown can't be executed.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "GitHub Flavored Markdown（GFM）とは何ですか？",
          en: "What is GitHub Flavored Markdown (GFM)?",
        },
        answer: {
          ja: "GitHubで採用されている、標準のMarkdownを拡張した記法です。テーブル、取り消し線（~~text~~）、タスクリスト（- [ ] や - [x]）などが追加で使用できます。本ツールはこれらの記法に対応しています。",
          en: "It's an extension of standard Markdown used by GitHub, adding tables, strikethrough (~~text~~), task lists (- [ ] and - [x]), and more. This tool supports all of these.",
        },
      },
      {
        question: {
          ja: "Markdown内にHTMLタグを直接書くことはできますか？",
          en: "Can I write raw HTML tags directly inside the Markdown?",
        },
        answer: {
          ja: "生のHTMLタグを含むMarkdownも変換されますが、出力時にDOMPurifyによってスクリプトタグなど危険な要素は除去されます。安全性を優先しているため、一部の高度なHTML表現は反映されない場合があります。",
          en: "Markdown containing raw HTML tags is converted, but dangerous elements like script tags are stripped by DOMPurify on output. Because safety is prioritized, some advanced HTML may not be preserved.",
        },
      },
      {
        question: {
          ja: "ダウンロードしたHTMLファイルはそのまま公開できますか？",
          en: "Can I publish the downloaded HTML file as-is?",
        },
        answer: {
          ja: "ダウンロードされるHTMLファイルは、最小限のスタイル（見出し・表・コードブロックなど）を含む単体のHTML文書として出力されるため、そのままブラウザで開いたり、簡易的なページとして利用したりできます。本格的なデザインを適用したい場合は、CSSを追加で調整してください。",
          en: "The downloaded HTML file is exported as a self-contained document with minimal styling (headings, tables, code blocks, etc.), so you can open it directly in a browser or use it as a simple page. For a more polished design, add your own CSS.",
        },
      },
      {
        question: {
          ja: "入力したMarkdownはサーバーに送信されますか？",
          en: "Is my input Markdown sent to a server?",
        },
        answer: {
          ja: "送信されません。プレビューへの変換、HTMLコードの生成、ファイルのダウンロードは、すべてブラウザ内のJavaScriptで完結します。",
          en: "No. Converting to a preview, generating HTML code, and downloading files all happen entirely with JavaScript in your browser.",
        },
      },
    ],
    category: "converter",
    icon: NotebookText,
    keywords: {
      ja: "markdown マークダウン html 変換 プレビュー gfm エディタ",
      en: "markdown html convert preview gfm editor",
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
