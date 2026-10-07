import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeftRight,
  Binary,
  Braces,
  CalendarClock,
  Clock,
  CodeXml,
  Database,
  DatabaseZap,
  Dices,
  EyeOff,
  FileBadge,
  FileJson,
  FileSpreadsheet,
  FileStack,
  Fingerprint,
  FlaskConical,
  FolderTree,
  GitCompare,
  ImageDown,
  ImageOff,
  ImagePlus,
  KeyRound,
  Layers,
  Link2,
  NotebookText,
  Palette,
  QrCode,
  ReceiptJapaneseYen,
  Regex,
  ScanText,
  Shapes,
  Sheet,
  ShieldCheck,
  Sparkles,
  SpellCheck,
  Table,
  Terminal,
  TextCursorInput,
  Waypoints,
  Workflow,
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

/** ファイルドロップ時にツールを対象として提示するための判定条件 */
export type FileMatch = {
  /** trueの場合、ファイルの種類を問わずマッチする（例: ハッシュ生成） */
  any?: boolean;
  /** MIMEタイプの前方一致（例: "image/" は "image/png" にマッチ） */
  mimePrefixes?: string[];
  /** MIMEタイプの完全一致 */
  mimeTypes?: string[];
  /** ファイル拡張子（先頭のドットなし、小文字） */
  extensions?: string[];
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
  /** スマートドロップ機能でこのツールを対象として表示するための条件 */
  fileMatch?: FileMatch;
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
          "コピペで混入したゼロ幅スペースなどの見えない文字も1文字として数えられるため、文字数が合わない場合は「日本語テキスト正規化・不可視文字検出」ツールで確認・除去できます。",
        ],
        en: [
          "The character count tool measures the character, word, line, and byte counts of your text in real time, right in your browser. It's useful for drafting web copy, checking character limits for social media posts, and confirming word counts for reports or papers.",
          "\"Characters\" is the total character count of the text, and \"Characters (no spaces)\" excludes spaces and line breaks. \"Bytes (UTF-8)\" accounts for the fact that full-width characters like Japanese take up multiple bytes per character, giving you a useful estimate of actual file size or data volume.",
          "Invisible characters picked up when copying and pasting, such as zero-width spaces, are also counted as characters. If a count looks off, check for and remove them with the Japanese Text Normalizer & Invisible Character Detector.",
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
    id: "text-diff",
    name: { ja: "テキスト差分比較（Diff）", en: "Text Diff Checker" },
    description: {
      ja: "2つのテキストの違いを、左右比較・統合表示で行単位／文字単位にハイライトします。",
      en: "Highlight differences between two texts line by line or character by character, side by side or unified.",
    },
    longDescription: {
      ja: "2つのテキストを比較し、追加・削除された行や文字をハイライト表示するDiffツールです。左右比較と統合表示の切り替え、行単位・文字単位の差分表示、空白の違いの無視に対応し、すべてブラウザ内で処理されます。",
      en: "A diff tool that compares two texts and highlights added and removed lines and characters. Switch between side-by-side and unified views, show differences per line or per character, and ignore whitespace differences — all processed in your browser.",
    },
    howToUse: {
      ja: [
        "左側に変更前、右側に変更後のテキストを入力または貼り付けます。「ファイルを開く」やドラッグ＆ドロップでテキストファイルを読み込むこともできます。",
        "入力と同時に差分が計算され、下の比較結果に追加行は緑、削除行は赤で表示されます。",
        "「左右比較」「統合表示」で表示形式を、「行単位」「文字単位」でハイライトの細かさを切り替えます。空白の違いを無視したり、変更箇所の前後だけを表示したりすることもできます。",
        "「クリップボードへコピー」で、差分をunified diff形式（パッチ形式）でコピーできます。",
      ],
      en: [
        "Enter or paste the original text on the left and the changed text on the right. You can also load text files with \"Open file\" or by drag and drop.",
        "Differences are calculated as you type and shown in the result below, with added lines in green and removed lines in red.",
        "Switch the layout with \"Side by side\" / \"Unified\" and the highlight granularity with \"Line\" / \"Character\". You can also ignore whitespace differences or show only the lines around changes.",
        "Use \"Copy to clipboard\" to copy the differences in unified diff (patch) format.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "テキスト差分比較ツールは、文章の修正前後の比較、設定ファイルの変更点の確認、APIレスポンスやログの違いの調査などに使えるDiffツールです。gitなどのツールを使わなくても、2つのテキストを貼り付けるだけで変更点をすばやく確認できます。",
          "差分は行単位で計算し、変更された行どうしについては文字単位の違いも強調表示します。「文字単位」表示では、1行の中のどの文字が変わったのかが一目でわかるため、数字1文字の修正や全角・半角の違いなど、見落としやすい変更を見つけるのに便利です。",
          "比較処理はすべてブラウザ内で完結し、入力したテキストがサーバーへ送信されることはありません。非常に大きなテキストや差分が多い場合は、ブラウザが固まらないよう一定時間で比較を打ち切り、表示する行数にも上限を設けています。",
        ],
        en: [
          "The text diff checker is useful for comparing drafts before and after edits, reviewing changes to config files, and investigating differences between API responses or logs. Just paste two texts to see what changed — no git or other tools required.",
          "Differences are calculated line by line, and character-level differences are highlighted within changed lines. The character view shows exactly which characters changed in a line, making it easy to spot subtle edits such as a single digit or a full-width versus half-width character.",
          "All comparison happens in your browser, and your text is never sent to a server. For very large texts or heavily changed content, the comparison stops after a set time and the number of displayed lines is capped to keep your browser responsive.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "「行単位」と「文字単位」の違いは何ですか？",
          en: "What's the difference between \"Line\" and \"Character\"?",
        },
        answer: {
          ja: "「行単位」は変更のあった行全体を色付けします。「文字単位」はそれに加えて、変更された行の中で実際に変わった文字を濃い色で強調表示します。",
          en: "\"Line\" colors entire changed lines. \"Character\" additionally highlights, in a darker color, the specific characters that changed within those lines.",
        },
      },
      {
        question: {
          ja: "改行コード（CRLFとLF）の違いは差分になりますか？",
          en: "Do line ending differences (CRLF vs LF) show up as changes?",
        },
        answer: {
          ja: "なりません。比較の前に改行コードをLFに統一しているため、WindowsとmacOS/Linuxで作成したファイルどうしでも内容の違いだけを確認できます。",
          en: "No. Line endings are normalized to LF before comparing, so files created on Windows and macOS/Linux show only real content differences.",
        },
      },
      {
        question: {
          ja: "差分をパッチとして保存できますか？",
          en: "Can I save the differences as a patch?",
        },
        answer: {
          ja: "「クリップボードへコピー」で、unified diff形式（git diffなどと同じ形式）のテキストをコピーできます。テキストエディタに貼り付けて .diff や .patch ファイルとして保存してください。",
          en: "Yes. \"Copy to clipboard\" copies the differences in unified diff format (the same format as git diff). Paste it into a text editor and save it as a .diff or .patch file.",
        },
      },
      {
        question: {
          ja: "入力したテキストはサーバーに送信されますか？",
          en: "Is my text sent to a server?",
        },
        answer: {
          ja: "送信されません。差分の計算はすべてブラウザ内のJavaScriptで行われます。",
          en: "No. All differences are calculated with JavaScript in your browser.",
        },
      },
    ],
    category: "text",
    icon: GitCompare,
    keywords: {
      ja: "差分 比較 diff テキスト 文章 変更点 ハイライト 文字単位 行単位",
      en: "diff compare text difference changes highlight side by side unified patch",
    },
    fileMatch: {
      mimeTypes: ["text/plain"],
      extensions: ["txt"],
    },
  },
  {
    id: "text-normalizer",
    name: { ja: "日本語テキスト正規化・不可視文字検出", en: "Japanese Text Normalizer & Invisible Character Detector" },
    description: {
      ja: "全角・半角や記号の表記ゆれを整え、コピペで混入した不可視文字や機種依存文字を検出・除去します。",
      en: "Unify full-width/half-width characters and symbols, and find and remove invisible and platform-dependent characters.",
    },
    longDescription: {
      ja: "日本語テキストの全角・半角、半角カタカナ、記号、ハイフン・チルダ、句読点、空白・改行などの表記ゆれをまとめて整え、ゼロ幅スペースやBOM、方向制御文字などの不可視文字、丸数字や㈱などの機種依存文字を検出・除去できるツールです。変換前後の差分と項目別の変換件数を確認でき、処理はすべてブラウザ内で行われます。",
      en: "A tool that unifies variations in Japanese text — full-width/half-width characters, half-width katakana, symbols, hyphens and tildes, punctuation, spaces, and line breaks — and finds and removes invisible characters such as zero-width spaces, BOMs, and bidi controls, plus platform-dependent characters such as circled numbers and ㈱. You can review a diff and a per-item count of changes, and everything runs in your browser.",
    },
    howToUse: {
      ja: [
        "変換前の欄にテキストを貼り付けるか、テキストファイルをドラッグ＆ドロップします。",
        "用途に合わせてプリセット（Excel/CSV取り込み用・データベース登録用・文書校正用・コピペ事故の掃除）を選ぶか、各項目のチェックボックスや選択肢を個別に設定します。",
        "変換後の欄に結果が表示されます。「変換件数」で項目ごとの件数を、「変換前後の差分」で変更箇所を確認できます。",
        "「検出した特殊文字」では、不可視文字や機種依存文字の位置と種類が一覧と本文中の印で表示されます。「不可視文字を除去」で入力欄から一度に取り除けます。",
        "結果は「クリップボードへコピー」または「ダウンロード」で保存します。",
      ],
      en: [
        "Paste text into the \"Before\" box, or drag and drop a text file.",
        "Choose a preset (Excel/CSV import, database entry, proofreading, or copy-paste cleanup), or set each checkbox and option individually.",
        "The result appears in the \"After\" box. Check the per-item counts under \"Changes\" and the changed spots under \"Differences\".",
        "\"Special characters found\" lists the position and type of invisible and platform-dependent characters and marks them in the text. \"Remove invisible characters\" strips them from the input in one click.",
        "Save the result with \"Copy to clipboard\" or \"Download\".",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "日本語テキスト正規化ツールは、全角と半角が混在した英数字、半角カタカナ、ハイフンや波ダッシュの種類の違いなど、日本語のテキストで起きやすい表記ゆれを整えるツールです。CSVやデータベースに取り込む前のデータの整形、文書校正の前処理、検索や重複チェックの精度向上に役立ちます。文字数を数える場合は「文字数カウント」ツールと組み合わせて使うと便利です。",
          "Webページやチャット、PDFからコピーしたテキストには、ゼロ幅スペースやBOM、ノーブレークスペース、文字の表示方向を変える制御文字など、目に見えない文字が混入していることがあります。これらはプログラムやExcelでの照合の失敗、思わぬ表示崩れの原因になります。このツールでは位置と種類を一覧にし、本文中に赤い印で表示します。",
          "ハイフン・ダッシュ類の統一では、カタカナ・ひらがなの直後にあるものは長音符「ー」とみなすため、「コンピュ－タ」は「コンピュータ」に、「03－1234」は「03-1234」になります。半角の「,」「.」や「~」は、数値・英文・URLを壊さないよう日本語や数字に隣接するものだけを変換します。変換はすべて自前の変換表で行い、テキストがサーバーへ送信されることはありません。",
        ],
        en: [
          "The Japanese Text Normalizer cleans up variations common in Japanese text, such as letters and digits mixing full-width and half-width forms, half-width katakana, and different kinds of hyphens and wave dashes. It's useful for preparing data before importing it into CSV files or databases, preprocessing documents for proofreading, and improving search and duplicate detection. Pair it with the Character Count tool when you also need to count characters.",
          "Text copied from web pages, chats, or PDFs can contain invisible characters such as zero-width spaces, BOMs, no-break spaces, and controls that change text direction. These can make matching fail in programs or Excel and cause unexpected display problems. This tool lists their positions and types and marks them in red in the text.",
          "When unifying hyphens and dashes, those right after katakana or hiragana are treated as the prolonged sound mark \"ー\", so \"コンピュ－タ\" becomes \"コンピュータ\" while \"03－1234\" becomes \"03-1234\". Half-width \",\", \".\", and \"~\" are converted only when next to Japanese text or digits, so numbers, English, and URLs stay intact. All conversions use built-in tables, and your text is never sent to a server.",
        ],
      },
    },
    faq: [
      {
        question: { ja: "NFKCとは何ですか？", en: "What is NFKC?" },
        answer: {
          ja: "Unicodeの正規化形式の1つで、全角英数字や半角カタカナ、①や㌔などの互換文字を標準的な文字にまとめて変換します。変換が広範囲に及ぶため、「①」が「1」になるなど意味が変わる場合があります。細かく制御したい場合はNFCを選び、各項目を個別に設定してください。",
          en: "It's one of Unicode's normalization forms; it converts full-width letters and digits, half-width katakana, and compatibility characters such as ① and ㌔ into standard characters. Because it converts so broadly, meaning can change (for example, ① becomes 1). For finer control, choose NFC and set each item individually.",
        },
      },
      {
        question: { ja: "不可視文字を除去すると絵文字が変わることはありますか？", en: "Can removing invisible characters change emoji?" },
        answer: {
          ja: "家族の絵文字などは、複数の絵文字をゼロ幅接合子（ZWJ）でつないで1つに見せています。ZWJを除去すると個別の絵文字に分かれるため、絵文字を含むテキストでは結果を確認してください。",
          en: "Some emoji, such as family emoji, join several emoji with zero-width joiners (ZWJ) to display as one. Removing ZWJ splits them into separate emoji, so check the result when your text contains emoji.",
        },
      },
      {
        question: { ja: "異体字セレクタ（IVS）とは何ですか？", en: "What are variation selectors (IVS)?" },
        answer: {
          ja: "「葛」などの漢字の字形を指定するために文字の直後に付ける見えない文字です。人名などで意図的に使われることがあるため、このツールでは検出して表示するだけで、不可視文字の除去の対象にはしていません。",
          en: "They are invisible characters placed right after a kanji such as 葛 to specify its glyph. Because they're sometimes used intentionally, for example in names, this tool only detects and shows them and does not remove them with the invisible character cleanup.",
        },
      },
      {
        question: { ja: "入力したテキストは送信されますか？", en: "Is my text sent anywhere?" },
        answer: {
          ja: "送信されません。変換・検出はすべてブラウザ内で行われます。",
          en: "No. All conversion and detection happen in your browser.",
        },
      },
    ],
    category: "text",
    icon: SpellCheck,
    keywords: {
      ja: "正規化 表記ゆれ 全角 半角 カタカナ 不可視文字 ゼロ幅スペース bom 機種依存文字 丸数字 nfkc ハイフン 波ダッシュ 句読点 改行",
      en: "japanese text normalize full-width half-width katakana invisible characters zero width space bom nfkc hyphen wave dash",
    },
    fileMatch: {
      mimeTypes: ["text/plain"],
      extensions: ["txt"],
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
    id: "data-format-converter",
    name: { ja: "YAML/TOML/JSON相互変換", en: "YAML / TOML / JSON Converter" },
    description: {
      ja: "YAML・TOML・JSONを相互に変換し、構文エラーがあれば行と列を表示します。",
      en: "Convert between YAML, TOML, and JSON, with line and column shown for syntax errors.",
    },
    longDescription: {
      ja: "YAML・TOML・JSONの3形式を相互に変換できるツールです。入力に構文エラーがある場合は、エラーの行・列と該当箇所を表示します。設定ファイルの形式変換やCI設定の確認などに使え、すべてブラウザ内で処理されます。",
      en: "A tool for converting between YAML, TOML, and JSON. When the input has a syntax error, it shows the line, column, and surrounding lines. Use it to convert config files or check CI settings — everything runs in your browser.",
    },
    howToUse: {
      ja: [
        "上部のボタンで、変換元と変換先の形式（JSON・YAML・TOML）を選びます。中央の矢印ボタンで入れ替えることもできます。",
        "左側にデータを入力または貼り付けるか、「ファイルを開く」やドラッグ＆ドロップでファイルを読み込みます。ファイルの拡張子から変換元の形式を自動で選択します。",
        "入力と同時に右側へ変換結果が表示されます。構文エラーがある場合は、エラーの行・列と前後の行が表示されます。",
        "「クリップボードへコピー」または「ダウンロード」で変換結果を保存します。JSON・YAMLではインデント幅も選べます。",
      ],
      en: [
        "Use the buttons at the top to choose the source and target formats (JSON, YAML, TOML). The arrow button in the middle swaps them.",
        "Type or paste data on the left, or load a file with \"Open file\" or by drag and drop. The source format is selected automatically from the file extension.",
        "The converted result appears on the right as you type. If there's a syntax error, the line, column, and surrounding lines are shown.",
        "Save the result with \"Copy to clipboard\" or \"Download\". For JSON and YAML you can also choose the indentation width.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "YAML・TOML・JSONは、いずれも設定ファイルやデータ交換に広く使われるテキスト形式です。KubernetesやGitHub ActionsではYAML、RustのCargoやPythonのpyproject.tomlではTOML、APIやpackage.jsonではJSONが使われるなど、用途によって形式が異なるため、形式間の変換が必要になる場面がよくあります。",
          "このツールでは、YAMLの解析・生成にyaml（ISCライセンス）、TOMLの解析・生成にsmol-toml（BSD-3-Clauseライセンス）を使用しています。構文エラーがあると変換結果の代わりにエラー箇所を表示するため、インデントのずれや括弧の閉じ忘れなどをすぐに見つけられます。",
          "形式ごとに表現できるデータには違いがあります。TOMLにはnullがなく最上位は必ずキーと値の組になるため、そのような値は変換時に除外されるか、エラーとして表示されます。また、TOMLの日時型はISO 8601形式の文字列として出力されます。変換はすべてブラウザ内で完結し、データがサーバーへ送信されることはありません。",
        ],
        en: [
          "YAML, TOML, and JSON are all text formats widely used for configuration files and data exchange. Kubernetes and GitHub Actions use YAML, Rust's Cargo and Python's pyproject.toml use TOML, and APIs and package.json use JSON — so you often need to convert between them.",
          "This tool uses yaml (ISC license) to parse and generate YAML, and smol-toml (BSD-3-Clause license) for TOML. When there's a syntax error, it shows where the problem is instead of a result, so you can quickly spot misaligned indentation or missing brackets.",
          "Each format can represent slightly different data. TOML has no null and its top level must be key/value pairs, so such values are either left out or reported as errors. TOML date-time values are output as ISO 8601 strings. All conversion happens in your browser, and your data is never sent to a server.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "YAMLのコメントは変換後も残りますか？",
          en: "Are YAML comments preserved after conversion?",
        },
        answer: {
          ja: "残りません。JSONにはコメントの仕組みがないため、データとして解析した値だけを変換します。TOMLやYAMLへ変換した場合も、元のコメントは出力されません。",
          en: "No. JSON has no concept of comments, so only the parsed data values are converted. Original comments are not included when converting to TOML or YAML either.",
        },
      },
      {
        question: {
          ja: "null を含むデータをTOMLに変換するとどうなりますか？",
          en: "What happens when data with null is converted to TOML?",
        },
        answer: {
          ja: "TOMLにはnullに相当する値がないため、値がnullの項目は出力から除外され、その旨の警告が表示されます。",
          en: "TOML has no equivalent of null, so entries with null values are left out and a warning is shown.",
        },
      },
      {
        question: {
          ja: "複数ドキュメント（---区切り）のYAMLは変換できますか？",
          en: "Can I convert multi-document YAML (separated by ---)?",
        },
        answer: {
          ja: "1つのドキュメントのみに対応しています。複数のドキュメントを含む場合はエラーになるため、ドキュメントごとに分けて変換してください。",
          en: "Only a single document is supported. Input with multiple documents results in an error, so convert each document separately.",
        },
      },
      {
        question: {
          ja: "入力したデータはサーバーに送信されますか？",
          en: "Is my data sent to a server?",
        },
        answer: {
          ja: "送信されません。解析と変換はすべてブラウザ内のJavaScriptで行われます。",
          en: "No. All parsing and conversion is done with JavaScript in your browser.",
        },
      },
    ],
    category: "converter",
    icon: ArrowLeftRight,
    keywords: {
      ja: "YAML TOML JSON 変換 相互変換 設定ファイル 構文チェック バリデーション",
      en: "yaml toml json converter convert config file syntax validate",
    },
    fileMatch: {
      mimeTypes: ["application/yaml", "application/x-yaml", "text/yaml", "application/toml"],
      extensions: ["yaml", "yml", "toml", "json"],
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
    id: "csv-editor",
    name: { ja: "CSV加工ツール", en: "CSV Editor" },
    description: {
      ja: "CSVを表形式で表示し、行・列の追加や削除、セルの編集、保存が行えます。",
      en: "View a CSV as a table and add, remove, and edit rows, columns, and cells, then save.",
    },
    longDescription: {
      ja: "CSVファイルやテキストを読み込んで見やすい表形式で表示し、行・列の追加や削除、セルや列名の編集をその場で行えるツールです。編集した結果はCSVファイルとしてダウンロードしたり、クリップボードにコピーしたりできます。",
      en: "A tool that loads a CSV file or pasted text into an easy-to-read table, letting you add or remove rows and columns and edit cells and column names in place. Once edited, you can download the result as a CSV file or copy it to the clipboard.",
    },
    howToUse: {
      ja: [
        "区切り文字（カンマ・タブ・セミコロン）と「1行目をヘッダーとして扱う」の要否を選び、CSVファイルをドラッグ＆ドロップするか、テキストエリアに貼り付けます。",
        "「テーブルに読み込む」を押すと、内容が編集可能な表として表示されます。",
        "セルや列名をクリックして直接書き換えたり、「行を追加」「列を追加」で新しい行・列を増やしたり、各行・各列のゴミ箱アイコンで削除したりできます。",
        "編集が終わったら「クリップボードへコピー」または「CSVをダウンロード」で結果を保存します。「新しいデータを読み込む」から別のCSVを読み込み直すこともできます。",
      ],
      en: [
        "Choose a delimiter (comma, tab, or semicolon) and whether to treat the first row as a header, then drag and drop a CSV file or paste text into the text area.",
        "Click \"Load into table\" to display the content as an editable table.",
        "Click a cell or column name to edit it directly, use \"Add row\" / \"Add column\" to insert new rows or columns, and use the trash icon on each row or column to remove it.",
        "When you're done editing, use \"Copy to clipboard\" or \"Download CSV\" to save the result. Use \"Load new data\" to start over with a different CSV.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "CSV加工ツールは、CSVファイルやテキストを見やすい表形式で表示し、ブラウザ上で行・列の追加や削除、セルの編集をその場で行えるツールです。表計算ソフトを開かずに、ちょっとしたデータの修正や整形をしたい場合に活用できます。",
          "引用符で囲まれたフィールドやフィールド内の改行にも対応した簡易CSVパーサーを使用しており、実務で扱う複雑なCSVでも崩れずに読み込めます。列名やセルの値はテーブル上のテキストボックスに直接入力するだけで反映され、変更内容はリアルタイムに保持されます。",
          "編集結果はCSV形式のテキストとしていつでも組み立て直され、クリップボードへのコピーやCSVファイルとしてのダウンロードが行えます。入力したデータがサーバーに送信されることはなく、すべての処理はブラウザ内で完結します。",
        ],
        en: [
          "The CSV Editor loads a CSV file or pasted text into an easy-to-read table and lets you add or remove rows and columns and edit cells right in your browser. It's useful for making small fixes or adjustments to data without opening spreadsheet software.",
          "It uses a lightweight CSV parser that handles quoted fields and line breaks within fields, so it can load complex real-world CSV files without breaking them. Column names and cell values update as soon as you type into the table's text boxes, and your changes are kept in real time.",
          "The edited result is rebuilt as CSV text at any time, ready to copy to the clipboard or download as a CSV file. Your data is never sent to a server — everything happens entirely in your browser.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "大きなCSVファイルでも編集できますか？",
          en: "Can I edit large CSV files?",
        },
        answer: {
          ja: "ブラウザのメモリが許す範囲であれば編集可能です。ただし表の全行が編集可能な状態で描画されるため、非常に大きなCSV（数万行など）では表示や入力が重くなる場合があります。",
          en: "Yes, as long as your browser's memory allows it. However, since every row is rendered as editable, very large CSVs (tens of thousands of rows, for example) may feel sluggish to display and edit.",
        },
      },
      {
        question: {
          ja: "ヘッダーがないCSVはどう扱われますか？",
          en: "How is a CSV without a header handled?",
        },
        answer: {
          ja: "「1行目をヘッダーとして扱う」のチェックを外して読み込むと、すべての行がデータ行として扱われ、列見出しは「列1」「列2」のように自動で採番されます。列名はあとから自由に書き換えられます。",
          en: "If you uncheck \"Treat first row as header\" before loading, every row is treated as data and column headers are automatically numbered like \"Column 1\", \"Column 2\", and so on. You can rename them freely afterward.",
        },
      },
      {
        question: {
          ja: "列をすべて削除してしまった場合はどうすればいいですか？",
          en: "What if I delete all the columns?",
        },
        answer: {
          ja: "「列を追加」ボタンから新しい列を作り直せます。編集内容を破棄してやり直したい場合は「新しいデータを読み込む」で最初の読み込み画面に戻れます。",
          en: "You can recreate columns with the \"Add column\" button. If you want to discard your edits and start over, use \"Load new data\" to return to the initial import screen.",
        },
      },
      {
        question: {
          ja: "編集したデータはサーバーに保存されますか？",
          en: "Is my edited data saved on a server?",
        },
        answer: {
          ja: "いいえ。読み込み・編集・保存のすべての処理はブラウザ内で完結し、外部サーバーへデータが送信されることはありません。",
          en: "No. Loading, editing, and saving all happen entirely in your browser, and no data is ever sent to an external server.",
        },
      },
    ],
    category: "converter",
    icon: Table,
    keywords: {
      ja: "csv 加工 編集 表 テーブル 行 列 追加 削除",
      en: "csv editor edit table row column add remove",
    },
    fileMatch: {
      mimeTypes: ["text/csv"],
      extensions: ["csv"],
    },
  },
  {
    id: "excel-converter",
    name: { ja: "Excel（xlsx）→CSV/JSON変換", en: "Excel (xlsx) to CSV/JSON Converter" },
    description: {
      ja: "Excel・ODSファイルのシートをCSVやJSONに変換します。Shift_JIS出力や全シートの一括ZIP保存にも対応。",
      en: "Convert sheets in Excel or ODS files to CSV or JSON, with Shift_JIS output and a ZIP of every sheet.",
    },
    longDescription: {
      ja: "Excel（.xlsx / .xlsm / .xls）やODSファイルをブラウザ上で読み込み、シートごとにCSVまたはJSONへ変換してダウンロードできるツールです。結合セル・日付・数式の扱いや区切り文字、文字コード（BOM付きUTF-8・Shift_JIS）を指定でき、ファイルがサーバーへ送信されることはありません。",
      en: "A tool that reads Excel (.xlsx / .xlsm / .xls) and ODS files in your browser and converts each sheet to CSV or JSON for download. You can choose how merged cells, dates, and formulas are handled, plus the delimiter and encoding (UTF-8 with BOM or Shift_JIS). Your file is never sent to a server.",
    },
    howToUse: {
      ja: [
        "Excel・ODSファイルをドラッグ＆ドロップするか、「ファイルを選択」から読み込みます。",
        "読み込むとシートの一覧が表示されます。変換したいシートを選ぶと、先頭100行のプレビューと変換結果が表示されます。",
        "「変換設定」で出力形式（CSV・JSON）、開始行、空行・空列の除去、結合セルや日付セルの扱いなどを指定します。CSVの場合は区切り文字・改行コード・文字コードも選べます。",
        "「このシートをダウンロード」で保存するか、「全シートをZIPでダウンロード」でまとめて保存します。「CSV加工ツールで開く」から、変換結果をそのまま編集することもできます。",
      ],
      en: [
        "Drag and drop an Excel or ODS file, or load one with \"Choose file\".",
        "Once loaded, the list of sheets appears. Pick a sheet to see a preview of its first 100 rows and the converted output.",
        "Use \"Conversion settings\" to choose the output format (CSV or JSON), start row, whether to remove empty rows and columns, and how merged cells and dates are handled. For CSV you can also choose the delimiter, line endings, and encoding.",
        "Save with \"Download this sheet\", or save every sheet at once with \"Download all sheets as ZIP\". You can also continue editing the result with \"Open in CSV Editor\".",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "Excel（xlsx）→CSV/JSON変換ツールは、表計算ソフトのファイルをCSVやJSONに変換するツールです。Excelを持っていない環境でデータを取り出したいとき、システムへの取り込み用にCSVを作りたいとき、プログラムで扱いやすいJSONにしたいときなどに役立ちます。",
          "日付セルはISO 8601形式（2026-01-31）・Excelの表示形式・シリアル値から選んで出力でき、1904年基準のブックにも対応しています。結合セルは左上のセルだけに値を入れるか、結合範囲のすべてに値を入れるかを選べます。数式セルは計算結果を出力し、必要に応じて数式そのものを出力することもできます。",
          "CSVはExcelで文字化けせずに開けるBOM付きUTF-8のほか、従来のシステム向けにShift_JIS（CP932）でも保存できます。ファイルの解析にはSheetJS Community Edition（Apache-2.0）を使用し、処理はすべてブラウザ内のWeb Workerで行われるため、大きなファイルでも画面が固まりにくく、データが外部に送信されることもありません。",
        ],
        en: [
          "The Excel (xlsx) to CSV/JSON Converter turns spreadsheet files into CSV or JSON. It's handy when you need data out of a spreadsheet without Excel installed, want a CSV to import into another system, or need JSON that's easy to work with in code.",
          "Date cells can be output as ISO 8601 (2026-01-31), as displayed in Excel, or as serial numbers, and workbooks using the 1904 date system are supported. Merged cells can either keep the value only in the top-left cell or repeat it across the whole range. Formula cells output their calculated values, or the formulas themselves if you prefer.",
          "CSV can be saved as UTF-8 with a BOM so it opens cleanly in Excel, or as Shift_JIS (CP932) for legacy systems. Files are parsed with SheetJS Community Edition (Apache-2.0) inside a Web Worker in your browser, so the page stays responsive with large files and no data is ever sent anywhere.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "パスワード付きのファイルは変換できますか？",
          en: "Can I convert password-protected files?",
        },
        answer: {
          ja: "対応していません。Excelでファイルを開き、パスワードを解除して保存し直してから読み込んでください。",
          en: "No. Open the file in Excel, remove the password, save it, and then load it here.",
        },
      },
      {
        question: {
          ja: "CSVをExcelで開くと文字化けします。",
          en: "My CSV shows garbled text when opened in Excel.",
        },
        answer: {
          ja: "文字コードに「UTF-8（BOM付き）」を選んで保存してください。古いシステムに取り込む場合など、Shift_JISが必要なときは「Shift_JIS（CP932）」を選べます。Shift_JISで表現できない文字（一部の絵文字や記号）は「?」に置き換わります。",
          en: "Save with the \"UTF-8 with BOM\" encoding. If a legacy system needs Shift_JIS, choose \"Shift_JIS (CP932)\" instead. Characters that Shift_JIS can't represent (some emoji and symbols) are replaced with \"?\".",
        },
      },
      {
        question: {
          ja: "数式やマクロはどうなりますか？",
          en: "What happens to formulas and macros?",
        },
        answer: {
          ja: "数式セルは、ファイルに保存されている計算結果の値を出力します。「数式セルは数式を出力する」をオンにすると =SUM(A1:A3) のような数式を出力します。マクロ（.xlsm）は実行されず、セルの値だけを読み取ります。",
          en: "Formula cells output the calculated values saved in the file. Turn on \"Output formulas for formula cells\" to output formulas such as =SUM(A1:A3) instead. Macros in .xlsm files are never run; only cell values are read.",
        },
      },
      {
        question: {
          ja: "ファイルがサーバーに送信されることはありますか？",
          en: "Is my file sent to a server?",
        },
        answer: {
          ja: "ありません。読み込みから変換・ダウンロードまで、すべてブラウザ内で処理されます。",
          en: "No. Everything from loading to converting and downloading happens in your browser.",
        },
      },
    ],
    category: "converter",
    icon: Sheet,
    keywords: {
      ja: "excel エクセル xlsx xls xlsm ods スプレッドシート csv json 変換 シート shift_jis",
      en: "excel xlsx xls xlsm ods spreadsheet csv json convert sheet export shift_jis",
    },
    fileMatch: {
      mimeTypes: [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/vnd.ms-excel.sheet.macroEnabled.12",
        "application/vnd.oasis.opendocument.spreadsheet",
      ],
      extensions: ["xlsx", "xls", "xlsm", "ods"],
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
      ja: "Markdownをリアルタイムプレビューしながら編集できるエディタです。GitHub Flavored Markdown（テーブル・タスクリスト・取り消し線など）に対応し、変換後のHTMLコードのコピーや、.md/.htmlファイルとしてのダウンロードができます。手元のMarkdownファイル（.md など）を読み込んで表示・編集することもできます。",
      en: "An editor for writing Markdown with a real-time preview. It supports GitHub Flavored Markdown (tables, task lists, strikethrough, and more), and lets you copy the converted HTML or download it as .md/.html files. You can also open a Markdown file (.md, etc.) from your device to view and edit it.",
    },
    howToUse: {
      ja: [
        "左側のエディタにMarkdownを入力すると、右側に変換結果がリアルタイムに反映されます。",
        "既存のMarkdownファイルを編集したい場合は、「ファイルを開く」ボタンから選択するか、エディタにファイルをドラッグ&ドロップすると内容が読み込まれます。",
        "「プレビュー」タブでは、実際にどのように表示されるかを確認できます。テーブル・タスクリスト・取り消し線などのGitHub Flavored Markdown（GFM）記法にも対応しています。",
        "「HTMLコード」タブに切り替えると、変換後のHTMLソースコードが表示され、「クリップボードへコピー」でそのまま他のシステムに貼り付けられます。",
        "「Markdown (.md) をダウンロード」「HTML (.html) をダウンロード」で、それぞれの形式のファイルとして保存できます。ファイルを読み込んだ場合は、元のファイル名で保存されます。",
      ],
      en: [
        "Type Markdown into the editor on the left, and the result updates in real time on the right.",
        "To edit an existing Markdown file, pick it with the \"Open file\" button or drag & drop it onto the editor to load its contents.",
        "The \"Preview\" tab shows how it will actually be rendered, including GitHub Flavored Markdown (GFM) syntax like tables, task lists, and strikethrough.",
        "Switch to the \"HTML Code\" tab to see the converted HTML source, ready to paste elsewhere with \"Copy to clipboard\".",
        "Use \"Download Markdown (.md)\" or \"Download HTML (.html)\" to save it as a file in either format. If you loaded a file, it is saved under the original file name.",
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
          ja: "送信されません。ファイルの読み込み、プレビューへの変換、HTMLコードの生成、ファイルのダウンロードは、すべてブラウザ内のJavaScriptで完結します。",
          en: "No. Loading files, converting to a preview, generating HTML code, and downloading files all happen entirely with JavaScript in your browser.",
        },
      },
    ],
    category: "converter",
    icon: NotebookText,
    keywords: {
      ja: "markdown マークダウン html 変換 プレビュー gfm エディタ ファイル 読み込み md ビューア",
      en: "markdown html convert preview gfm editor file open md viewer",
    },
    fileMatch: {
      mimeTypes: ["text/markdown", "text/x-markdown"],
      extensions: ["md", "markdown", "mdown", "mkd", "mdx"],
    },
  },
  {
    id: "timestamp-converter",
    name: { ja: "Unixタイムスタンプ・タイムゾーン変換", en: "Unix Timestamp & Time Zone Converter" },
    description: {
      ja: "Unixタイムスタンプと日時を相互変換し、複数のタイムゾーンでの時刻を同時に表示します。",
      en: "Convert between Unix timestamps and dates, and see the time in multiple time zones at once.",
    },
    longDescription: {
      ja: "Unixタイムスタンプ（秒・ミリ秒・マイクロ秒・ナノ秒を自動判定）をISO 8601などの日時に変換し、複数のタイムゾーンでの時刻を一覧表示できるツールです。日時からUnix時刻への逆変換にも対応し、すべてブラウザ内で処理されます。",
      en: "A tool that converts Unix timestamps — auto-detecting seconds, milliseconds, microseconds, or nanoseconds — to ISO 8601 and other formats, and lists the time across multiple time zones. It also converts dates back to Unix time, all within your browser.",
    },
    howToUse: {
      ja: [
        "「タイムスタンプまたは日時」にUnix時刻（例: 1700000000）や日時文字列（例: 2026-09-23T12:00:00+09:00）を入力します。数値は桁数から単位を自動判定しますが、単位を明示的に選ぶこともできます。",
        "右側に、Unix時刻（秒・ミリ秒）、ISO 8601（UTC・この端末のタイムゾーン）、HTTP日付形式、現在からの差が表示されます。各値はコピーボタンでコピーできます。",
        "「タイムゾーン別の日時」で、複数のタイムゾーンでの日時とUTCからのオフセットを同時に確認できます。タイムゾーンは検索して追加・削除できます。",
        "「日時からUnix時刻に変換」では、日時とタイムゾーンを指定してUnix時刻を求められます。",
      ],
      en: [
        "Enter a Unix time (e.g. 1700000000) or a date string (e.g. 2026-09-23T12:00:00+09:00) under \"Timestamp or date\". Units are auto-detected from the number of digits, but you can also choose one explicitly.",
        "On the right, you'll see Unix time (seconds and milliseconds), ISO 8601 (UTC and your device's time zone), the HTTP date format, and the time relative to now. Copy any value with its copy button.",
        "\"Time in each time zone\" shows the date, time, and UTC offset in several time zones at once. Search to add time zones, or remove ones you don't need.",
        "\"Convert a date to Unix time\" calculates the Unix time for a date and time in the time zone you choose.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "Unixタイムスタンプ（Unix時刻）は、1970年1月1日0時0分0秒（UTC）からの経過秒数で日時を表す形式で、ログやデータベース、APIのレスポンスなどで広く使われています。言語やシステムによって秒・ミリ秒・マイクロ秒・ナノ秒と単位が異なるため、このツールでは数値の桁数から単位を自動で判定します。",
          "タイムゾーンの変換にはブラウザ標準のIntl APIを使用しており、夏時間（サマータイム）の切り替えも考慮して各地域のUTCからのオフセットを求めています。海外拠点とのやり取りや、UTCで記録されたログを現地時刻で確認したい場合などに便利です。",
          "入力したタイムスタンプや日時はサーバーへ送信されず、すべてブラウザ内で変換されます。現在時刻やローカルのタイムゾーンも、お使いの端末の設定から取得しています。",
        ],
        en: [
          "A Unix timestamp (Unix time) represents a moment as the number of seconds elapsed since 00:00:00 UTC on January 1, 1970, and it's widely used in logs, databases, and API responses. Because languages and systems use different units — seconds, milliseconds, microseconds, or nanoseconds — this tool detects the unit automatically from the number of digits.",
          "Time zone conversion uses your browser's built-in Intl API, which accounts for daylight saving time when calculating each region's offset from UTC. It's handy when coordinating with overseas teams or reading UTC logs in local time.",
          "The timestamps and dates you enter are never sent to a server — all conversion happens in your browser. The current time and your local time zone are read from your device settings.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "秒とミリ秒はどのように判定していますか？",
          en: "How are seconds and milliseconds told apart?",
        },
        answer: {
          ja: "整数部の桁数で判定しています。11桁以下は秒、12〜14桁はミリ秒、15〜17桁はマイクロ秒、18桁以上はナノ秒とみなします。判定が意図と異なる場合は、単位を手動で選択してください。",
          en: "By the number of integer digits: up to 11 digits is treated as seconds, 12–14 as milliseconds, 15–17 as microseconds, and 18 or more as nanoseconds. If the detection isn't what you intended, choose the unit manually.",
        },
      },
      {
        question: {
          ja: "夏時間（サマータイム）は考慮されますか？",
          en: "Is daylight saving time taken into account?",
        },
        answer: {
          ja: "考慮されます。ブラウザに組み込まれたタイムゾーンデータベースを使って、指定した日時における各タイムゾーンのオフセットを求めています。",
          en: "Yes. The offset for each time zone at the given moment is calculated using the time zone database built into your browser.",
        },
      },
      {
        question: {
          ja: "マイナスのタイムスタンプ（1970年より前）も変換できますか？",
          en: "Can I convert negative timestamps (before 1970)?",
        },
        answer: {
          ja: "変換できます。「-86400」のようにマイナス記号を付けて入力してください。",
          en: "Yes. Enter it with a minus sign, like \"-86400\".",
        },
      },
      {
        question: {
          ja: "入力した値はサーバーに送信されますか？",
          en: "Are the values I enter sent to a server?",
        },
        answer: {
          ja: "送信されません。変換処理はすべてブラウザ内のJavaScriptで行われます。",
          en: "No. All conversion is done with JavaScript in your browser.",
        },
      },
    ],
    category: "converter",
    icon: CalendarClock,
    keywords: {
      ja: "Unix タイムスタンプ エポック 秒 ミリ秒 日時 変換 タイムゾーン ISO 8601 UTC JST 時差",
      en: "unix timestamp epoch seconds milliseconds date converter time zone iso 8601 utc",
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
    fileMatch: {
      mimePrefixes: ["image/"],
      extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"],
    },
  },
  {
    id: "screenshot-editor",
    name: { ja: "スクリーンショット加工", en: "Screenshot Editor" },
    description: {
      ja: "スクリーンショットにモザイク・矢印・テキストなどを加えて、トリミングや結合まで行えます。",
      en: "Annotate screenshots with mosaic, arrows, and text, then crop, add padding, or merge them.",
    },
    longDescription: {
      ja: "スクリーンショットや画像にモザイク・ぼかし・四角形・矢印・テキストを加えたり、トリミング・余白追加・角丸・複数画像の結合を行えるツールです。すべてブラウザ内で処理され、画像がサーバーへ送信されることはありません。",
      en: "A tool for annotating screenshots and images with mosaic, blur, rectangles, arrows, and text, plus cropping, adding padding, rounding corners, and merging multiple images. Everything runs in your browser, and images are never uploaded to a server.",
    },
    howToUse: {
      ja: [
        "画像をドラッグ＆ドロップ、ファイル選択、またはクリップボードからの貼り付け（Ctrl/Cmd + V）で読み込みます。複数の画像を読み込むと、あとで1枚に結合できます。",
        "左側のツールから「モザイク」「ぼかし」「四角形」「矢印」「テキスト」などを選び、画像上をドラッグ（テキストはクリック）して配置します。配置した要素は「選択」ツールでクリックして選び直し、移動・リサイズ・削除ができます。",
        "「トリミング」「余白」「角丸」では、範囲や数値を指定して画像全体に変換を適用できます。操作はいつでもUndo（元に戻す）・Redo（やり直す）できます。",
        "仕上がったら出力フォーマット（PNG/JPEG/WebP）と画質を選び、「画像をダウンロード」で元の解像度のまま保存します。",
      ],
      en: [
        "Load an image by dragging and dropping it, choosing a file, or pasting from the clipboard (Ctrl/Cmd + V). Load multiple images and you can merge them into one later.",
        "Pick a tool on the left — Mosaic, Blur, Rectangle, Arrow, Text, and more — then drag on the image (or click, for text) to place it. Use the Select tool to click an existing element and move, resize, or delete it.",
        "Crop, Padding, and Rounded corners apply a whole-image transform based on a selected area or a numeric value. Every action can be undone (Undo) and redone (Redo) at any time.",
        "When you're done, choose an output format (PNG/JPEG/WebP) and quality, then click \"Download image\" to save it at the original resolution.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "スクリーンショット加工ツールは、SNSへ投稿する前に個人情報を隠したり、説明用のスクリーンショットに矢印や枠を付けたり、複数のスクリーンショットを1枚にまとめて共有したりする用途に特化したツールです。画像編集ソフトのような複雑さを避け、「少し加工してすぐ共有する」操作に絞っています。",
          "モザイク・ぼかし・四角形・矢印・テキストはあとから選び直して移動・リサイズ・削除できるベクター要素として保持され、Delete/Backspaceキーでも削除できます。トリミング・余白追加・角丸・画像結合は画像全体に対する変換として適用され、それぞれの操作はUndo（Cmd/Ctrl + Z）・Redo（Cmd/Ctrl + Shift + Z）の対象になります。",
          "画像はキャンバス上では表示用に縮小されるだけで、元の解像度のデータはそのまま保持されます。書き出し時には常に元の解像度を基準にPNG・JPEG・WebPへ変換されるため、画質が劣化することはありません。読み込みから書き出しまで、画像データがサーバーへ送信されることは一切ありません。",
        ],
        en: [
          "The screenshot editor is built specifically for hiding personal information before posting to social media, adding arrows and boxes to explanatory screenshots, and combining multiple screenshots into one image to share. It avoids the complexity of full image editors and focuses on quick touch-ups you can share right away.",
          "Mosaic, blur, rectangle, arrow, and text are kept as vector-like elements you can reselect later to move, resize, or delete — including with the Delete/Backspace key. Crop, padding, rounded corners, and merging images are applied as whole-image transforms, and every action can be undone (Cmd/Ctrl+Z) or redone (Cmd/Ctrl+Shift+Z).",
          "The image is only ever scaled down for on-screen display — the original resolution data is preserved throughout. Exporting always renders at the original resolution when converting to PNG, JPEG, or WebP, so there's no loss of quality. From loading to exporting, your image data is never sent to a server.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "配置したモザイクや矢印はあとから調整できますか？",
          en: "Can I adjust a mosaic or arrow after placing it?",
        },
        answer: {
          ja: "できます。「選択」ツールで要素をクリックすると、ハンドルをドラッグしての移動・リサイズや、右下パネルからの色・太さ・強さの変更、Delete/Backspaceキーでの削除が行えます。",
          en: "Yes. With the Select tool, click an element to drag its handles for moving and resizing, adjust its color, width, or strength from the panel below, or delete it with the Delete/Backspace key.",
        },
      },
      {
        question: {
          ja: "サイズが異なる複数のスクリーンショットを結合できますか？",
          en: "Can I merge screenshots of different sizes?",
        },
        answer: {
          ja: "できます。結合方向（縦・横）を選ぶと、幅または高さが異なる画像は中央揃えで配置され、画像間の余白と背景色も指定できます。結合順はサムネイルをドラッグ＆ドロップして入れ替えられます。",
          en: "Yes. Choose a merge direction (vertical or horizontal) and images with different widths or heights are centered along the cross axis. You can also set the gap and background color between images, and reorder them by dragging the thumbnails.",
        },
      },
      {
        question: {
          ja: "角丸にすると画像の四隅が透明になりません。",
          en: "The corners aren't transparent after rounding them.",
        },
        answer: {
          ja: "出力フォーマットにJPEGを選んでいると、透過に対応していないため角丸部分が白などで塗りつぶされます。角丸部分を透明にしたい場合はPNGまたはWebPを選んで書き出してください。",
          en: "If you export as JPEG, which doesn't support transparency, the rounded-off corners will be filled with a solid color instead. Export as PNG or WebP to keep the corners transparent.",
        },
      },
      {
        question: {
          ja: "画像はサーバーにアップロードされますか？",
          en: "Are images uploaded to a server?",
        },
        answer: {
          ja: "アップロードされません。画像の読み込み・加工・書き出しはすべてブラウザ内のCanvas APIで処理され、外部サーバーへ送信されることはありません。",
          en: "No. Loading, editing, and exporting all happen in your browser via the Canvas API, and nothing is ever sent to an external server.",
        },
      },
    ],
    category: "converter",
    icon: ImagePlus,
    keywords: {
      ja: "スクリーンショット 画像編集 モザイク ぼかし トリミング 矢印 テキスト 余白 角丸 結合",
      en: "screenshot editor image annotation mosaic blur crop arrow text padding rounded corners merge",
    },
    fileMatch: {
      mimePrefixes: ["image/"],
      extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"],
    },
  },
  {
    id: "ocr",
    name: { ja: "OCR（画像から文字認識・日本語対応）", en: "OCR (Image to Text, Japanese Support)" },
    description: {
      ja: "画像やスクリーンショットから日本語・英語の文字を読み取ります。縦書きにも対応。",
      en: "Extract Japanese and English text from images and screenshots, including vertical Japanese.",
    },
    longDescription: {
      ja: "画像やスクリーンショットに写った日本語・英語の文字を、ブラウザ上だけで読み取ってテキストにするOCRツールです。範囲指定、グレースケール・二値化・拡大などの前処理、日本語の不要なスペースの除去に対応し、画像がサーバーへ送信されることはありません。",
      en: "An OCR tool that reads Japanese and English text in images and screenshots and turns it into text, entirely in your browser. It supports selecting an area, preprocessing such as grayscale, binarization, and upscaling, and removing stray spaces in Japanese text. Your image is never sent to a server.",
    },
    howToUse: {
      ja: [
        "画像をドラッグ＆ドロップするか、「画像を選択」から読み込みます。スクリーンショットは Ctrl/⌘+V で貼り付けることもできます。",
        "「認識する言語」を選びます。日本語と英語が混在する場合は「日本語＋英語」、縦書きの文章は「日本語（縦書き）」を選びます。",
        "必要に応じて前処理（グレースケール・コントラスト・二値化・拡大・回転）を調整します。プレビュー上をドラッグすると、その範囲だけを認識できます。",
        "「文字を認識」を押すと、結果がテキストエリアに表示されます。初回のみ認識モデルのダウンロードが行われます。",
        "結果は編集でき、「クリップボードへコピー」または「.txtでダウンロード」で保存できます。",
      ],
      en: [
        "Drag and drop an image, or load one with \"Choose image\". You can also paste a screenshot with Ctrl/⌘+V.",
        "Choose the language. Use \"Japanese + English\" for mixed text and \"Japanese (vertical)\" for vertical writing.",
        "Adjust preprocessing (grayscale, contrast, binarization, upscaling, rotation) if needed. Drag on the preview to recognize only that area.",
        "Click \"Recognize text\" to see the result in the text area. The recognition model is downloaded only the first time.",
        "The result is editable. Save it with \"Copy to clipboard\" or \"Download .txt\".",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "OCRツールは、画像に写った文字を読み取ってテキストデータに変換するツールです。紙の資料を撮影した写真やスクリーンショット、PDFを画像にしたものなどから、文字を入力し直さずに取り出したいときに役立ちます。",
          "認識にはオープンソースのOCRエンジンTesseractをWebAssembly化したtesseract.js（Apache-2.0）を使い、Web Worker上で処理するため認識中も画面が固まりません。日本語の認識結果では文字の間に半角スペースが入りやすいため、それを除去する後処理や、段落内の改行を結合する後処理も用意しています。",
          "認識エンジンと言語データはこのサイトから配信され、外部のCDNは使用しません。言語データは初回のみダウンロードしてブラウザに保存するため、2回目以降はすぐに使えます。画像はブラウザの外に出ることはありません。",
        ],
        en: [
          "The OCR tool reads text in images and converts it into editable text. It's handy for pulling text out of photos of printed documents, screenshots, or PDFs saved as images without retyping it.",
          "Recognition uses tesseract.js (Apache-2.0), a WebAssembly build of the open-source Tesseract OCR engine, running in a Web Worker so the page stays responsive. Because Japanese results often contain stray spaces between characters, post-processing options are included to remove them and to join line breaks within paragraphs.",
          "The recognition engine and language data are served from this site, not from an external CDN. Language data is downloaded only once and saved in your browser, so later runs start right away. Your image never leaves your browser.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "認識精度を上げるにはどうすればいいですか？",
          en: "How can I improve accuracy?",
        },
        answer: {
          ja: "文字が小さい場合は「拡大」を、背景に色や模様がある場合は「二値化」を試してください。傾いている画像は回転で向きを合わせ、認識したい部分だけを範囲指定すると精度が上がることがあります。手書き文字や装飾の多いフォントは苦手です。",
          en: "Try \"Upscale\" for small text and \"Binarize\" when the background has colors or patterns. Rotate the image to the correct orientation, and select only the area you need. Handwriting and decorative fonts are difficult to recognize.",
        },
      },
      {
        question: {
          ja: "どのくらいのデータをダウンロードしますか？",
          en: "How much data is downloaded?",
        },
        answer: {
          ja: "初回のみ、認識エンジン（約3.9MB）と言語データ（日本語・縦書きは約2MB、英語は約2.9MB）をダウンロードします。言語データはブラウザに保存され、2回目以降は再ダウンロードしません。",
          en: "The first time only, the recognition engine (about 3.9 MB) and language data (about 2 MB for Japanese or vertical Japanese, about 2.9 MB for English) are downloaded. Language data is saved in your browser and isn't downloaded again.",
        },
      },
      {
        question: {
          ja: "PDFから文字を読み取れますか？",
          en: "Can I read text from a PDF?",
        },
        answer: {
          ja: "PDFは直接読み込めません。PDFのページをスクリーンショットするなどして画像にしてから読み込んでください。",
          en: "PDFs can't be loaded directly. Take a screenshot of the page or otherwise convert it to an image first.",
        },
      },
      {
        question: {
          ja: "画像がサーバーに送信されることはありますか？",
          en: "Is my image sent to a server?",
        },
        answer: {
          ja: "ありません。ダウンロードするのは認識モデルだけで、画像の読み込みから文字認識まですべてブラウザ内で処理されます。",
          en: "No. Only the recognition model is downloaded; everything from loading the image to recognizing text happens in your browser.",
        },
      },
    ],
    category: "converter",
    icon: ScanText,
    keywords: {
      ja: "ocr 文字認識 文字起こし 画像 テキスト 抽出 読み取り スクリーンショット 日本語 縦書き tesseract",
      en: "ocr text recognition image to text extract screenshot japanese vertical tesseract",
    },
    fileMatch: {
      mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/bmp"],
      extensions: ["png", "jpg", "jpeg", "webp", "bmp"],
    },
  },
  {
    id: "exif-remover",
    name: { ja: "画像のEXIF・位置情報削除", en: "EXIF & Location Remover" },
    description: {
      ja: "写真に含まれるEXIF情報やGPS位置情報を確認し、削除した画像をダウンロードできます。",
      en: "Inspect EXIF and GPS location data in photos, then download clean copies with it removed.",
    },
    longDescription: {
      ja: "JPEG・PNG・WebP画像に含まれるEXIF情報（撮影日時・カメラ機種・GPS位置情報など）を一覧表示し、メタデータを削除した画像をダウンロードできるツールです。複数ファイルの一括処理にも対応し、すべてブラウザ内で処理されます。",
      en: "A tool that lists the EXIF data in JPEG, PNG, and WebP images — capture time, camera model, GPS location, and more — and lets you download copies with the metadata removed. It supports batch processing, and everything runs in your browser.",
    },
    howToUse: {
      ja: [
        "画像をドラッグ＆ドロップするか、クリックして選択します。複数の画像をまとめて読み込めます。",
        "画像ごとに、含まれているメタデータの種類がバッジで表示されます。位置情報（GPS）が含まれている場合は、緯度・経度とともに警告が表示されます。",
        "「詳細を表示」で、カメラ機種や撮影日時などのEXIF情報を項目ごとに確認できます。",
        "「削除済み画像をダウンロード」で1枚ずつ、または「まとめてダウンロード（ZIP）」で全画像を、メタデータを取り除いた状態で保存します。",
      ],
      en: [
        "Drag and drop images or click to choose them. You can load several images at once.",
        "Each image shows badges for the types of metadata it contains. If it includes GPS location data, a warning is shown along with the latitude and longitude.",
        "Click \"Show details\" to review each EXIF field, such as camera model and capture time.",
        "Save images with metadata removed one at a time with \"Download cleaned image\", or all at once with \"Download all (ZIP)\".",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "スマートフォンやデジタルカメラで撮影した写真には、撮影日時やカメラの機種、レンズの情報に加え、撮影した場所のGPS座標が「EXIF」というメタデータとして記録されていることがあります。この情報が残ったまま画像をSNSやブログ、フリマアプリなどで公開すると、自宅や職場の場所が特定されるおそれがあります。",
          "このツールはJPEGのAPP1（EXIF・XMP）・APP13（IPTC）・コメント、PNGのeXIf・テキストチャンク、WebPのEXIF・XMPチャンクを取り除きます。画像データそのものは再エンコードせずにそのままコピーするため、画質が劣化することはありません。色の再現に必要なICCプロファイルは保持されます。",
          "「画像の向きは残す」をオンにすると、Orientation（向き）の情報だけを最小限のEXIFとして書き戻します。スマートフォンの写真は向きの情報で縦横を切り替えていることが多く、これを消すと横倒しで表示される場合があるためです。読み込みから保存まで、画像がサーバーへ送信されることは一切ありません。",
        ],
        en: [
          "Photos taken with smartphones and digital cameras can carry \"EXIF\" metadata such as the capture time, camera model, and lens information — and sometimes the GPS coordinates of where the photo was taken. Posting such images on social media, blogs, or marketplace apps can reveal where you live or work.",
          "This tool removes JPEG APP1 (EXIF, XMP), APP13 (IPTC), and comment segments; PNG eXIf and text chunks; and WebP EXIF and XMP chunks. The image data itself is copied as-is without re-encoding, so there's no loss of quality. ICC color profiles needed for accurate color are kept.",
          "With \"Keep image orientation\" turned on, only the Orientation tag is written back as a minimal EXIF block. Smartphone photos often rely on this tag to switch between portrait and landscape, and removing it can make them appear sideways. From loading to saving, your images are never sent to a server.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "メタデータを削除すると画質は落ちますか？",
          en: "Does removing metadata reduce image quality?",
        },
        answer: {
          ja: "落ちません。メタデータ部分だけを取り除き、画像データは再エンコードせずにそのままコピーしているため、画質は元の画像と同じです。",
          en: "No. Only the metadata sections are removed, and the image data is copied as-is without re-encoding, so the quality is identical to the original.",
        },
      },
      {
        question: {
          ja: "削除後の画像が横向きに表示されます。",
          en: "The cleaned image is displayed sideways.",
        },
        answer: {
          ja: "「画像の向き（Orientation）は残す」をオンにしてから、もう一度ダウンロードしてください。向きの情報だけを残し、位置情報などその他のEXIF情報は削除されます。",
          en: "Turn on \"Keep image orientation\" and download again. Only the orientation tag is kept, while location data and all other EXIF fields are removed.",
        },
      },
      {
        question: {
          ja: "HEICやGIFなどの形式にも対応していますか？",
          en: "Are formats like HEIC or GIF supported?",
        },
        answer: {
          ja: "現在はJPEG・PNG・WebPに対応しています。HEICの写真は、端末の設定や画像変換ツールでJPEGに変換してから読み込んでください。",
          en: "JPEG, PNG, and WebP are currently supported. Convert HEIC photos to JPEG using your device settings or an image converter before loading them.",
        },
      },
      {
        question: {
          ja: "画像はサーバーにアップロードされますか？",
          en: "Are images uploaded to a server?",
        },
        answer: {
          ja: "アップロードされません。メタデータの解析と削除はすべてブラウザ内のJavaScriptで行われます。",
          en: "No. Analyzing and removing metadata is done entirely with JavaScript in your browser.",
        },
      },
    ],
    category: "converter",
    icon: ImageOff,
    keywords: {
      ja: "EXIF 位置情報 GPS 削除 メタデータ 写真 プライバシー 撮影情報 一括",
      en: "exif remove gps location metadata photo privacy strip batch",
    },
    fileMatch: {
      mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      extensions: ["jpg", "jpeg", "png", "webp"],
    },
  },
  {
    id: "svg-optimizer",
    name: { ja: "SVG最適化・PNG変換", en: "SVG Optimizer & PNG Converter" },
    description: {
      ja: "SVGを最適化してサイズの削減率を表示し、指定したサイズのPNGに変換します。",
      en: "Optimize SVGs, see how much smaller they get, and convert them to PNG at any size.",
    },
    longDescription: {
      ja: "SVGファイルから不要なメタデータやコメント、冗長な記述を取り除いて最適化し、サイズの削減率を表示するツールです。最適化したSVGを指定した幅・高さのPNG画像に変換することもでき、すべてブラウザ内で処理されます。",
      en: "A tool that optimizes SVG files by removing unneeded metadata, comments, and redundant markup, and shows how much smaller the file gets. You can also convert the optimized SVG to a PNG at the width and height you choose. Everything runs in your browser.",
    },
    howToUse: {
      ja: [
        "SVGのコードを貼り付けるか、「ファイルを開く」やドラッグ＆ドロップで .svg ファイルを読み込みます。",
        "自動で最適化が行われ、元のサイズ・最適化後のサイズ・削減率と、見た目のプレビューが表示されます。",
        "「最適化オプション」で数値の精度やwidth・height属性の削除、インデントの有無を調整し、「SVGをダウンロード」で保存します。",
        "PNGが必要な場合は「PNGに変換」で幅・高さ（または1x・2x・4x）を指定し、「PNGをダウンロード」を押します。",
      ],
      en: [
        "Paste SVG code, or load an .svg file with \"Open file\" or by drag and drop.",
        "The SVG is optimized automatically, and the original size, optimized size, reduction, and a visual preview are shown.",
        "Adjust numeric precision, removal of width/height attributes, and indentation under \"Optimization options\", then save with \"Download SVG\".",
        "If you need a PNG, set the width and height (or 1x, 2x, 4x) under \"Convert to PNG\" and click \"Download PNG\".",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "デザインツールから書き出したSVGには、編集用のメタデータやコメント、使われていない定義、必要以上に細かい小数など、表示には不要な情報が多く含まれていることがあります。これらを取り除くことで、見た目を変えずにファイルサイズを大きく削減でき、Webページの読み込みを速くできます。",
          "最適化にはオープンソースのsvgo（MITライセンス）を使用しています。パスデータの短縮、色の表記の短縮、不要な属性やグループの削除などを複数回繰り返して行い、できるだけ小さなSVGにします。「数値の精度」を小さくするとさらにサイズを減らせますが、細かい図形では形がずれる場合があるため、プレビューで確認しながら調整してください。",
          "PNGへの変換はブラウザのCanvasで行うため、アイコンやロゴを任意の解像度のPNGとして書き出せます。SVGの読み込みから最適化、PNGの書き出しまで、データがサーバーへ送信されることはありません。",
        ],
        en: [
          "SVGs exported from design tools often contain information that isn't needed for display — editor metadata, comments, unused definitions, and overly precise decimals. Removing them can shrink files significantly without changing how they look, making web pages load faster.",
          "Optimization uses the open-source svgo (MIT license). It shortens path data and color notation and removes unneeded attributes and groups, repeating the process several times to make the SVG as small as possible. Lowering \"Numeric precision\" reduces size further but can shift fine shapes, so adjust it while checking the preview.",
          "PNG conversion uses your browser's Canvas, so you can export icons and logos as PNGs at any resolution. From loading to optimizing and exporting, your data is never sent to a server.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "最適化で見た目が変わることはありますか？",
          en: "Can optimization change how the SVG looks?",
        },
        answer: {
          ja: "通常は変わりません。ただし「数値の精度」を小さくしすぎると、細かい図形がわずかにずれることがあります。プレビューで元のSVGと比べて確認してください。",
          en: "Usually not. However, setting \"Numeric precision\" too low can slightly shift fine shapes. Compare against the original in the preview.",
        },
      },
      {
        question: {
          ja: "width・height属性を削除するとどうなりますか？",
          en: "What happens if I remove the width and height attributes?",
        },
        answer: {
          ja: "SVGが親要素の大きさに合わせて拡大縮小されるようになり、CSSでサイズを指定しやすくなります。viewBoxは残るため縦横比は保たれます。",
          en: "The SVG scales to fit its parent element, making it easier to size with CSS. The viewBox is kept, so the aspect ratio is preserved.",
        },
      },
      {
        question: {
          ja: "PNGに変換すると文字や画像が表示されません。",
          en: "Text or images are missing after converting to PNG.",
        },
        answer: {
          ja: "SVGが外部のフォントや画像ファイルを参照している場合、ブラウザの制限によりPNGには描画されません。文字はアウトライン化し、画像はSVG内に埋め込んでから変換してください。",
          en: "If the SVG references external fonts or image files, browser restrictions prevent them from being drawn in the PNG. Convert text to outlines and embed images in the SVG before converting.",
        },
      },
      {
        question: {
          ja: "SVGはサーバーにアップロードされますか？",
          en: "Are SVGs uploaded to a server?",
        },
        answer: {
          ja: "アップロードされません。最適化とPNGへの変換はすべてブラウザ内で行われます。",
          en: "No. Optimization and PNG conversion both happen in your browser.",
        },
      },
    ],
    category: "converter",
    icon: Shapes,
    keywords: {
      ja: "SVG 最適化 圧縮 軽量化 svgo PNG 変換 ベクター アイコン ロゴ",
      en: "svg optimize minify compress svgo png convert vector icon logo",
    },
    fileMatch: {
      mimeTypes: ["image/svg+xml"],
      extensions: ["svg"],
    },
  },
  {
    id: "favicon-generator",
    name: { ja: "ファビコン一括生成", en: "Favicon Generator" },
    description: {
      ja: "1枚の画像から、ICO・各サイズのPNG・apple-touch-icon・manifest.json用アイコンをまとめて生成します。",
      en: "Generate an ICO, PNGs in every size, an apple-touch-icon, and manifest.json icons from a single image.",
    },
    longDescription: {
      ja: "1枚の画像から、favicon.ico（16・32・48px）、各サイズのPNG、apple-touch-icon（180px）、manifest.json用のアイコン（192・512px）とmanifest.jsonをまとめて生成し、ZIPでダウンロードできるツールです。余白や背景色、角丸も調整でき、すべてブラウザ内で処理されます。",
      en: "A tool that generates favicon.ico (16, 32, 48px), PNGs in each size, an apple-touch-icon (180px), manifest.json icons (192 and 512px), and the manifest.json itself from a single image, and lets you download them all as a ZIP. You can adjust padding, background color, and corner radius, and everything runs in your browser.",
    },
    howToUse: {
      ja: [
        "アイコンの元になる画像をドラッグ＆ドロップするか、クリックして選択します。512×512px以上の正方形の画像がおすすめです。",
        "「アイコンの見た目」で余白、背景色、角丸を調整します。変更はすぐにプレビューに反映されます。",
        "「manifest.json の設定」でアプリ名やテーマカラーを入力します。",
        "「すべてZIPでダウンロード」で一式を保存し、Webサイトの公開ディレクトリに配置して、表示されたタグをHTMLの<head>に追加します。",
      ],
      en: [
        "Drag and drop the image to use for your icon, or click to choose it. A square image of at least 512×512px works best.",
        "Adjust padding, background color, and corner radius under \"Icon appearance\". Changes are reflected in the preview right away.",
        "Enter your app name and theme color under \"manifest.json settings\".",
        "Click \"Download all as ZIP\", place the files in your site's public directory, and add the displayed tags to your HTML <head>.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "ファビコンは、ブラウザのタブやブックマーク、スマートフォンのホーム画面などに表示されるWebサイトのアイコンです。表示される場所によって必要なサイズや形式が異なり、従来のfavicon.ico、高解像度ディスプレイ向けのPNG、iPhoneのホーム画面用のapple-touch-icon、Androidやインストール可能なWebアプリ（PWA）向けのmanifest.jsonのアイコンなどを用意する必要があります。",
          "このツールは、1枚の画像からこれらをまとめて生成します。favicon.icoには16・32・48pxのPNG画像を格納しており、現在の主要なブラウザで表示できます。大きな画像から小さなアイコンを作るときは段階的に縮小して、細部がつぶれにくいようにしています。",
          "ZIPには、アイコン画像に加えてmanifest.jsonと、HTMLに追加するタグの例（favicon-snippet.html）が含まれます。画像の読み込みから生成、ZIPの作成まで、すべてブラウザ内で完結し、画像がサーバーへ送信されることはありません。",
        ],
        en: [
          "A favicon is the icon for your website shown in browser tabs, bookmarks, and smartphone home screens. Different places need different sizes and formats: the classic favicon.ico, PNGs for high-resolution displays, an apple-touch-icon for iPhone home screens, and icons referenced from manifest.json for Android and installable web apps (PWAs).",
          "This tool generates all of them from a single image. favicon.ico contains 16, 32, and 48px PNG images, which today's major browsers can display. When making small icons from a large image, it scales down in steps so that fine details are less likely to get lost.",
          "Besides the icon images, the ZIP includes manifest.json and example tags to add to your HTML (favicon-snippet.html). Everything from loading the image to generating the icons and building the ZIP happens in your browser, and your image is never sent to a server.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "SVG画像からも生成できますか？",
          en: "Can I generate icons from an SVG?",
        },
        answer: {
          ja: "できます。SVGはベクター画像のため、どのサイズでもくっきりしたアイコンを生成できます。幅・高さの指定がないSVGは512×512pxとして扱います。",
          en: "Yes. Because SVG is a vector format, it produces crisp icons at every size. SVGs without a specified width and height are treated as 512×512px.",
        },
      },
      {
        question: {
          ja: "生成したファイルはどこに置けばよいですか？",
          en: "Where should I put the generated files?",
        },
        answer: {
          ja: "Webサイトのルート（ドメイン直下）に置くのが一般的です。Next.jsなどのフレームワークでは public ディレクトリに配置してください。別の場所に置く場合は、HTMLのタグとmanifest.json内のパスを書き換えてください。",
          en: "They're usually placed at the root of your site. In frameworks like Next.js, put them in the public directory. If you place them elsewhere, update the paths in the HTML tags and manifest.json.",
        },
      },
      {
        question: {
          ja: "透過PNGの背景はどうなりますか？",
          en: "What happens to transparent backgrounds?",
        },
        answer: {
          ja: "「背景色を付ける」をオフにすると透過のまま出力します。ただしiPhoneのホーム画面では透過部分が黒く表示されることがあるため、apple-touch-icon用には背景色の指定をおすすめします。",
          en: "With \"Add a background color\" off, transparency is preserved. However, iPhone home screens may display transparent areas as black, so a background color is recommended for the apple-touch-icon.",
        },
      },
      {
        question: {
          ja: "画像はサーバーにアップロードされますか？",
          en: "Are images uploaded to a server?",
        },
        answer: {
          ja: "アップロードされません。アイコンの生成とZIPの作成はすべてブラウザ内で行われます。",
          en: "No. Icon generation and ZIP creation both happen in your browser.",
        },
      },
    ],
    category: "converter",
    icon: Sparkles,
    keywords: {
      ja: "ファビコン favicon ICO アイコン 生成 apple-touch-icon manifest.json PWA",
      en: "favicon ico icon generator apple-touch-icon manifest.json pwa png",
    },
    fileMatch: {
      mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
      extensions: ["png", "jpg", "jpeg", "webp", "svg"],
    },
  },
  {
    id: "qr-code",
    name: { ja: "QRコード生成・読み取り", en: "QR Code Generator & Reader" },
    description: {
      ja: "テキストやURLからQRコードを生成し、画像ファイルからQRコードを読み取ります。",
      en: "Create QR codes from text or URLs, and read QR codes from image files.",
    },
    longDescription: {
      ja: "テキストやURLからQRコードを生成し、PNG・SVGでダウンロードできるツールです。サイズ・誤り訂正レベル・色・余白を指定でき、画像ファイルに写ったQRコードの読み取りにも対応します。すべてブラウザ内で処理されます。",
      en: "A tool that creates QR codes from text or URLs and lets you download them as PNG or SVG. You can set the size, error correction level, colors, and quiet zone, and it can also read QR codes from image files. Everything runs in your browser.",
    },
    howToUse: {
      ja: [
        "「生成」タブで、QRコードにしたいテキストやURLを入力します。入力と同時にプレビューが更新されます。",
        "誤り訂正レベル、画像サイズ、余白、前景色・背景色を調整します。色の組み合わせが読み取りにくい場合は警告が表示されます。",
        "「PNGをダウンロード」または「SVGをダウンロード」で保存します。印刷物にはサイズを変えても劣化しないSVGがおすすめです。",
        "QRコードを読み取るときは「読み取り」タブで画像をドラッグ＆ドロップするか、クリップボードから貼り付けます。",
      ],
      en: [
        "On the \"Generate\" tab, enter the text or URL to encode. The preview updates as you type.",
        "Adjust the error correction level, image size, quiet zone, and foreground/background colors. A warning appears if the color combination may be hard to scan.",
        "Save with \"Download PNG\" or \"Download SVG\". For print, SVG is recommended because it scales without losing quality.",
        "To read a QR code, drag and drop an image on the \"Read\" tab, or paste it from the clipboard.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "QRコードは、URLやテキストを白黒の模様として表現する2次元コードで、スマートフォンのカメラで簡単に読み取れます。このツールでは、Webサイトやイベントの案内、Wi-Fiの接続情報の共有などに使うQRコードを、ブラウザだけで作成できます。",
          "誤り訂正レベルは、QRコードの一部が汚れたり隠れたりしても読み取れるようにするための冗長なデータの量です。レベルを上げるほど読み取りに強くなりますが、同じ内容でもQRコードの模様が細かくなります。中央にロゴを重ねたい場合はHを、できるだけ単純な模様にしたい場合はLやMを選んでください。",
          "QRコードの生成と読み取りにはオープンソースのZXing（@zxing/library、Apache-2.0ライセンス）を使用し、必要になったときだけ読み込みます。オンラインのQRコード生成サービスとは異なり、入力したURLや読み取った画像がサーバーへ送信・記録されることはありません。",
        ],
        en: [
          "A QR code is a 2D code that represents URLs or text as a black-and-white pattern, and it can be scanned easily with a smartphone camera. With this tool, you can create QR codes for websites, event information, or sharing Wi-Fi details — all in your browser.",
          "The error correction level controls how much redundant data is added so the code can still be read if part of it is dirty or covered. Higher levels are more robust, but the pattern becomes denser for the same content. Choose H if you want to place a logo in the center, or L or M for the simplest pattern.",
          "Generation and reading use the open-source ZXing library (@zxing/library, Apache-2.0 license), which is loaded only when needed. Unlike online QR code services, the URLs you enter and the images you read are never sent to or stored on a server.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "日本語のテキストもQRコードにできますか？",
          en: "Can I encode Japanese or other non-ASCII text?",
        },
        answer: {
          ja: "できます。テキストはUTF-8で格納するため、日本語や絵文字を含むテキストも一般的なスマートフォンのカメラで読み取れます。",
          en: "Yes. Text is stored as UTF-8, so text containing Japanese characters or emoji can be read by typical smartphone cameras.",
        },
      },
      {
        question: {
          ja: "どのくらいの文字数まで入れられますか？",
          en: "How much text can a QR code hold?",
        },
        answer: {
          ja: "誤り訂正レベルLで英数字なら最大約4,000文字、UTF-8のバイト数では最大約2,900バイトです。レベルを上げると格納できる量は少なくなります。長すぎる場合はエラーが表示されます。",
          en: "At level L, up to about 4,000 alphanumeric characters or about 2,900 bytes of UTF-8. Higher levels hold less. An error is shown if the text is too long.",
        },
      },
      {
        question: {
          ja: "スクリーンショットや写真からも読み取れますか？",
          en: "Can it read QR codes from screenshots or photos?",
        },
        answer: {
          ja: "読み取れます。ただし、QRコードが小さすぎる、ぼやけている、大きく傾いている場合は検出できないことがあります。その場合はQRコードの部分を切り抜いた画像でお試しください。",
          en: "Yes. However, detection may fail if the QR code is too small, blurry, or heavily skewed. In that case, try an image cropped to the QR code.",
        },
      },
      {
        question: {
          ja: "入力したURLや画像はサーバーに送信されますか？",
          en: "Are my URLs or images sent to a server?",
        },
        answer: {
          ja: "送信されません。QRコードの生成・読み取りはすべてブラウザ内で行われます。",
          en: "No. QR codes are generated and read entirely in your browser.",
        },
      },
    ],
    category: "converter",
    icon: QrCode,
    keywords: {
      ja: "QRコード 生成 作成 読み取り スキャン URL 誤り訂正 SVG PNG",
      en: "qr code generator reader scanner decode url error correction svg png",
    },
    fileMatch: {
      mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"],
      extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"],
    },
  },
  {
    id: "pdf-toolkit",
    name: { ja: "PDF結合・分割・ページ抽出", en: "PDF Merge, Split & Extract" },
    description: {
      ja: "複数PDFの結合、ページ範囲での分割、ページの抽出・並べ替え・回転をブラウザだけで行えます。",
      en: "Merge PDFs, split by page ranges, and extract, reorder, or rotate pages — all in your browser.",
    },
    longDescription: {
      ja: "複数のPDFを1つに結合したり、ページ範囲や一定ページごとに分割したり、必要なページだけを抽出・並べ替え・回転したりできるツールです。すべてブラウザ内で処理され、PDFがサーバーへ送信されることはありません。",
      en: "A tool for merging multiple PDFs into one, splitting by page ranges or every N pages, and extracting, reordering, or rotating pages. Everything runs in your browser, and your PDFs are never uploaded to a server.",
    },
    howToUse: {
      ja: [
        "PDFファイルをドラッグ＆ドロップするか、クリックして選択します。複数のPDFを選ぶと、読み込んだ順にページ一覧へ追加されます。",
        "ページ一覧でドラッグ＆ドロップまたは矢印ボタンを使ってページを並べ替え、回転ボタンで向きを直し、不要なページは削除します。",
        "「結合・並べ替え」ではページ一覧のとおりに1つのPDFとして書き出します。「分割」ではページ範囲（例: 1-3, 4-6）または一定ページごとに分割し、「ページ抽出」では指定したページ（例: 1, 3, 5-7）だけを1つのPDFにまとめます。",
        "ダウンロードボタンを押すと、処理済みのPDF（分割で複数になる場合はZIP）が保存されます。",
      ],
      en: [
        "Drag and drop PDF files or click to choose them. When you select multiple PDFs, their pages are added to the page list in the order they're loaded.",
        "In the page list, reorder pages by drag and drop or the arrow buttons, fix orientation with the rotate buttons, and delete pages you don't need.",
        "\"Merge & reorder\" exports a single PDF that matches the page list. \"Split\" splits by page ranges (e.g. 1-3, 4-6) or every N pages, and \"Extract pages\" combines only the pages you specify (e.g. 1, 3, 5-7) into one PDF.",
        "Click the download button to save the processed PDF (or a ZIP when a split produces multiple files).",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "PDF結合・分割・ページ抽出ツールは、請求書や契約書、スキャンした書類などのPDFを、専用ソフトをインストールせずに整理するためのツールです。複数のPDFを1つにまとめる、長いPDFを章ごとに分ける、必要なページだけを抜き出して共有する、といった作業をブラウザだけで行えます。",
          "ページの並べ替え・回転・削除は、書き出し前のページ一覧上で自由に試せます。回転は元のページの向きに90度単位で加算され、ページの内容（テキスト・画像・リンクなど）は再圧縮されずにそのまま新しいPDFへコピーされるため、画質や文字の検索性が損なわれることはありません。",
          "PDFの読み込みから書き出しまで、処理はすべてブラウザ内で完結します。オンラインのPDF結合サービスのようにファイルをアップロードする必要がないため、社外秘の資料や個人情報を含む書類も安心して扱えます。なお、パスワードで保護（暗号化）されたPDFには対応していません。",
        ],
        en: [
          "The PDF merge, split & extract tool lets you organize PDFs such as invoices, contracts, and scanned documents without installing dedicated software. Combine multiple PDFs into one, break a long PDF into chapters, or pull out just the pages you need to share — all in your browser.",
          "You can freely try reordering, rotating, and deleting pages in the page list before exporting. Rotation is added to each page's original orientation in 90° steps, and page content (text, images, links, and so on) is copied into the new PDF as-is without recompression, so quality and text searchability are preserved.",
          "Everything from loading to exporting happens entirely in your browser. Unlike online PDF merging services, there's no need to upload your files, so you can safely work with confidential or personal documents. Note that password-protected (encrypted) PDFs are not supported.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "ページ範囲はどのように指定しますか？",
          en: "How do I specify page ranges?",
        },
        answer: {
          ja: "「1-3」のようにハイフンで範囲を、「1, 3, 5」のようにカンマで複数の指定を区切ります。「7-」は7ページ目から最後まで、「-3」は先頭から3ページ目までを表します。「分割」ではカンマで区切った範囲ごとに別々のPDFになり、「ページ抽出」ではすべてのページを1つのPDFにまとめます。",
          en: "Use a hyphen for ranges like \"1-3\" and commas to separate multiple entries like \"1, 3, 5\". \"7-\" means page 7 to the end, and \"-3\" means the first page through page 3. In Split, each comma-separated range becomes a separate PDF; in Extract pages, all specified pages are combined into one PDF.",
        },
      },
      {
        question: {
          ja: "画質が落ちたり、テキストが検索できなくなったりしませんか？",
          en: "Will quality drop or text become unsearchable?",
        },
        answer: {
          ja: "ページの内容は再圧縮や画像化をせずにそのままコピーするため、画質やテキストの選択・検索性はそのまま保たれます。",
          en: "No. Page content is copied as-is without recompression or rasterization, so image quality and text selection/search are preserved.",
        },
      },
      {
        question: {
          ja: "パスワード付きのPDFは扱えますか？",
          en: "Can I use password-protected PDFs?",
        },
        answer: {
          ja: "暗号化されたPDFには対応していません。PDFビューアなどでパスワードを解除して保存し直してから読み込んでください。",
          en: "Encrypted PDFs are not supported. Remove the password in a PDF viewer and save the file again before loading it.",
        },
      },
      {
        question: {
          ja: "PDFはサーバーにアップロードされますか？",
          en: "Are PDFs uploaded to a server?",
        },
        answer: {
          ja: "アップロードされません。PDFの読み込み・結合・分割・書き出しはすべてブラウザ内のJavaScriptで処理され、外部へ送信されることはありません。",
          en: "No. Loading, merging, splitting, and exporting are all handled by JavaScript in your browser, and nothing is sent externally.",
        },
      },
    ],
    category: "converter",
    icon: FileStack,
    keywords: {
      ja: "PDF 結合 分割 抽出 ページ 並べ替え 回転 マージ 削除",
      en: "pdf merge split extract pages reorder rotate combine delete",
    },
    fileMatch: {
      mimeTypes: ["application/pdf"],
      extensions: ["pdf"],
    },
  },
  {
    id: "invoice-generator",
    name: { ja: "請求書・見積書作成（インボイス対応・PDF出力）", en: "Invoice & Estimate Generator (Japanese Qualified Invoice, PDF)" },
    description: {
      ja: "インボイス制度の記載事項に対応した請求書・見積書・納品書・領収書を作成し、PDFで保存できます。",
      en: "Create invoices, estimates, delivery notes, and receipts that meet Japan's qualified invoice requirements, and save them as PDF.",
    },
    longDescription: {
      ja: "個人事業主・フリーランス向けに、適格請求書（インボイス）の記載事項を満たした請求書・見積書・納品書・領収書をブラウザ上で作成し、PDFで保存できるツールです。税率ごとの集計と消費税額の計算、源泉徴収税、テンプレート保存に対応し、入力内容はサーバーに送信されず端末内にのみ保存されます。",
      en: "A tool for sole proprietors and freelancers to create invoices, estimates, delivery notes, and receipts that meet Japan's qualified invoice (インボイス) requirements, right in the browser, and save them as PDF. It totals amounts and consumption tax by rate, supports withholding tax and templates, and keeps your data only on your device — nothing is sent to a server. Documents are generated in Japanese.",
    },
    howToUse: {
      ja: [
        "上部のボタンで帳票の種類（請求書・見積書・納品書・領収書）を選びます。",
        "書類情報・宛先・発行者を入力します。適格請求書として発行する場合は登録番号（T＋13桁）を入力してください。「自動採番」で INV-2026-001 のような書類番号を付けられます。",
        "明細に品名・数量・単位・単価・税率を入力します。税抜・税込の入力方法と端数処理を選べ、軽減税率（8%）の品目には自動で「※」が付きます。値引きはマイナスの単価で入力します。",
        "右側のA4プレビューで仕上がりを確認し、「記載事項の確認」に警告が出ていないか確かめてから「PDFをダウンロード」を押します。",
        "よく使う発行者情報や取引先、明細は「テンプレートに保存」で端末に保存できます。JSONでのエクスポート・インポートも可能です。",
      ],
      en: [
        "Choose the document type (invoice, estimate, delivery note, or receipt) with the buttons at the top.",
        "Enter the document details, recipient, and issuer. For a qualified invoice, enter the registration number (T + 13 digits). \"Auto number\" assigns numbers like INV-2026-001.",
        "Enter each line item's name, quantity, unit, unit price, and tax rate. Choose tax-excluded or tax-included entry and the rounding method; reduced-rate (8%) items are marked with \"※\" automatically. Enter discounts as negative unit prices.",
        "Check the result in the A4 preview, make sure there are no warnings under \"Required details\", and click \"Download PDF\".",
        "Save frequently used issuer details, recipients, and items with \"Save as template\". You can also export and import JSON.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "請求書・見積書作成ツールは、2023年10月に始まったインボイス制度（適格請求書等保存方式）の記載事項に対応した帳票を作成するツールです。発行者の氏名または名称と登録番号、取引年月日、取引内容（軽減税率の対象品目である旨）、税率ごとに区分して合計した対価の額と適用税率、税率ごとの消費税額、宛先を記載できます。",
          "消費税の端数処理は、インボイス制度のルールに合わせて「1枚の書類につき、税率ごとに1回」だけ行い、切り捨て・四捨五入・切り上げから選べます。金額は浮動小数点の誤差が出ないよう整数で計算しています。報酬に対する源泉徴収税（100万円以下は10.21%、超える部分は20.42%）の差し引きにも対応しています。",
          "PDFには日本語フォント（Noto Sans JP、SIL Open Font License）を使った文字だけをサブセット化して埋め込むため、どの環境でも文字化けしません。プレビューとPDFは同じレイアウト計算から描画しているので、見た目がずれません。入力内容・テンプレートはこの端末のブラウザにのみ保存されます。本ツールは書類作成の補助であり、税務・法律上の判断は税理士等にご確認ください。",
        ],
        en: [
          "The Invoice & Estimate Generator creates documents that meet the requirements of Japan's qualified invoice system (インボイス制度), introduced in October 2023. It can include the issuer's name and registration number, the transaction date, the transaction details (including which items are reduced-rate), the amounts totaled by tax rate with the applicable rates, the consumption tax for each rate, and the recipient.",
          "Following the system's rules, consumption tax is rounded only once per tax rate per document, using round down, round half up, or round up. Amounts are calculated with integers to avoid floating-point errors. Withholding tax on fees (10.21% up to ¥1,000,000 and 20.42% above) can also be deducted.",
          "PDFs embed only the characters used from a Japanese font (Noto Sans JP, SIL Open Font License), so text displays correctly everywhere. The preview and the PDF are drawn from the same layout, so they always match. Your entries and templates are stored only in this browser. This tool only assists with document creation; consult a tax accountant for tax and legal decisions.",
        ],
      },
    },
    faq: [
      {
        question: { ja: "消費税の端数はどのように計算されますか？", en: "How is consumption tax rounded?" },
        answer: {
          ja: "インボイス制度のルールに合わせて、明細ごとではなく、書類全体で税率（10%・8%）ごとに合計した金額に対して1回だけ端数処理を行います。端数処理の方法は切り捨て・四捨五入・切り上げから選べます。",
          en: "Following the qualified invoice rules, tax is rounded once on the total for each tax rate (10% and 8%) across the whole document, not per line item. You can choose round down, round half up, or round up.",
        },
      },
      {
        question: { ja: "源泉徴収税はどう計算されますか？", en: "How is withholding tax calculated?" },
        answer: {
          ja: "税抜の合計金額に対して、100万円以下の部分は10.21%、100万円を超える部分は20.42%で計算し、1円未満を切り捨てます。消費税額が明確に区分されている場合は税抜金額を対象にできるという扱いに基づいています。",
          en: "It's calculated on the pre-tax total: 10.21% on the portion up to ¥1,000,000 and 20.42% on the portion above, with fractions of a yen dropped. This follows the rule that the pre-tax amount may be used when consumption tax is clearly stated separately.",
        },
      },
      {
        question: { ja: "入力したデータはどこに保存されますか？", en: "Where is my data stored?" },
        answer: {
          ja: "この端末のブラウザ（localStorage）にのみ保存され、サーバーには送信されません。別の端末で使いたい場合はJSONでエクスポートし、移行先でインポートしてください。ブラウザのデータを消去すると保存内容も消えます。",
          en: "Only in this browser (localStorage); nothing is sent to a server. To use it on another device, export JSON and import it there. Clearing your browser data also removes what you saved.",
        },
      },
      {
        question: { ja: "作成した書類はそのまま使えますか？", en: "Can I use the documents as is?" },
        answer: {
          ja: "記載事項の確認機能はありますが、本ツールは書類作成の補助です。取引の内容や税務上の扱いについては、税理士等の専門家にご確認ください。",
          en: "The tool checks the required details, but it only assists with creating documents. Consult a tax accountant or other professional about your transactions and their tax treatment.",
        },
      },
    ],
    category: "converter",
    icon: ReceiptJapaneseYen,
    keywords: {
      ja: "請求書 見積書 納品書 領収書 インボイス 適格請求書 登録番号 消費税 軽減税率 源泉徴収 pdf フリーランス 個人事業主",
      en: "invoice estimate quote delivery note receipt qualified invoice japan consumption tax withholding pdf freelance",
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
    id: "jsonpath-tester",
    name: { ja: "JSONPathクエリ抽出", en: "JSONPath Query Tester" },
    description: {
      ja: "JSONに対してJSONPathを実行し、一致した値やパスをリアルタイムで表示します。",
      en: "Run JSONPath queries against JSON and see matching values and paths in real time.",
    },
    longDescription: {
      ja: "JSONデータに対してJSONPath式を実行し、一致した値とそのパスをリアルタイムで表示するツールです。フィルター式（?()）やワイルドカード、再帰検索（..）に対応し、APIレスポンスから必要なデータを取り出す式の作成・確認に使えます。すべてブラウザ内で処理されます。",
      en: "A tool that runs JSONPath expressions against JSON data and shows matching values and their paths in real time. It supports filter expressions (?()), wildcards, and recursive descent (..), making it easy to build and verify expressions that pull data from API responses. Everything runs in your browser.",
    },
    howToUse: {
      ja: [
        "「JSON」にデータを入力または貼り付けるか、ファイルを読み込みます。「サンプルを入力」で動作を試すこともできます。",
        "「JSONPath」に式を入力します（例: $.store.book[*].author）。よく使う式の例はボタンから入力できます。",
        "入力と同時に「抽出結果」に一致した値が表示されます。「パス」に切り替えると、一致した要素のパスを一覧で確認できます。",
        "「クリップボードへコピー」で、抽出した値（JSON配列）またはパスの一覧をコピーできます。",
      ],
      en: [
        "Type or paste data into \"JSON\", or load a file. You can also try it out with \"Load sample\".",
        "Enter an expression under \"JSONPath\" (e.g. $.store.book[*].author). Common examples can be inserted with the buttons.",
        "Matching values appear under \"Results\" as you type. Switch to \"Paths\" to list the paths of the matching elements.",
        "Use \"Copy to clipboard\" to copy the extracted values (as a JSON array) or the list of paths.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "JSONPathは、JSONの中から特定の値を取り出すためのクエリ言語で、XMLにおけるXPathのような役割を持ちます。「$」がルート要素を表し、「.」や「[]」で子要素を、「*」ですべての要素を、「..」で階層を問わない再帰検索を、「[?()]」で条件に一致する要素の絞り込みを指定します。",
          "APIテストツールやKubernetes（kubectl -o jsonpath）、各種ログ基盤など、JSONPathはさまざまな場面で使われています。このツールでは、式を入力するたびに結果が更新されるため、期待どおりの値が取り出せるかを試しながら式を組み立てられます。一致した要素のパスも確認できるので、特定の値がJSONのどこにあるかを調べる用途にも便利です。",
          "クエリの実行にはオープンソースライブラリのjsonpath-plus（MITライセンス）を使用し、フィルター式は任意のJavaScriptを実行できない安全な評価モードで処理しています。入力したJSONがサーバーへ送信されることはありません。",
        ],
        en: [
          "JSONPath is a query language for extracting specific values from JSON, much like XPath for XML. \"$\" is the root, \".\" and \"[]\" select children, \"*\" selects all elements, \"..\" searches recursively at any depth, and \"[?()]\" filters elements that match a condition.",
          "JSONPath is used in many places, including API testing tools, Kubernetes (kubectl -o jsonpath), and log platforms. Because this tool updates the results every time you type, you can build an expression while checking that it extracts exactly what you expect. It also shows the paths of matching elements, which is handy for finding where a value lives inside a JSON document.",
          "Queries run on the open-source jsonpath-plus library (MIT license), and filter expressions are evaluated in a safe mode that can't execute arbitrary JavaScript. Your JSON is never sent to a server.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "フィルター式ではどのような条件が使えますか？",
          en: "What conditions can I use in filter expressions?",
        },
        answer: {
          ja: "@ で現在の要素を参照し、比較演算子（== != < <= > >=）や論理演算子（&& ||）を組み合わせられます。例えば「$..book[?(@.price < 10 && @.category == 'fiction')]」のように指定します。",
          en: "Use @ to refer to the current element, combined with comparison operators (== != < <= > >=) and logical operators (&& ||). For example: \"$..book[?(@.price < 10 && @.category == 'fiction')]\".",
        },
      },
      {
        question: {
          ja: "配列の最後の要素を取り出すには？",
          en: "How do I get the last element of an array?",
        },
        answer: {
          ja: "「$.store.book[-1:]」のようにスライス記法で負のインデックスを指定します。「[0:2]」のように範囲を指定すると先頭から2件を取り出せます。",
          en: "Use slice notation with a negative index, like \"$.store.book[-1:]\". A range such as \"[0:2]\" returns the first two elements.",
        },
      },
      {
        question: {
          ja: "フィルター式でJavaScriptが実行されることはありませんか？",
          en: "Can filter expressions execute JavaScript?",
        },
        answer: {
          ja: "実行されません。フィルター式は安全な評価モードで処理しており、関数の呼び出しなど任意のコードの実行はできないようになっています。",
          en: "No. Filter expressions are processed in a safe evaluation mode that doesn't allow arbitrary code execution such as function calls.",
        },
      },
      {
        question: {
          ja: "入力したJSONはサーバーに送信されますか？",
          en: "Is my JSON sent to a server?",
        },
        answer: {
          ja: "送信されません。JSONの解析とクエリの実行はすべてブラウザ内で行われます。",
          en: "No. Parsing the JSON and running the query both happen in your browser.",
        },
      },
    ],
    category: "developer",
    icon: Braces,
    keywords: {
      ja: "JSONPath JSON クエリ 抽出 フィルター 検索 パス XPath API レスポンス",
      en: "jsonpath json query extract filter search path evaluator tester api response",
    },
    fileMatch: {
      mimeTypes: ["application/json"],
      extensions: ["json"],
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
    fileMatch: {
      any: true,
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
    id: "certificate-decoder",
    name: { ja: "X.509証明書（PEM）デコーダー", en: "X.509 Certificate Decoder" },
    description: {
      ja: "PEM形式の証明書から発行者・サブジェクト・有効期限・SAN・フィンガープリントを表示し、期限切れを判定します。",
      en: "Decode PEM certificates to see issuer, subject, expiry, SANs, and fingerprints, and check whether they've expired.",
    },
    longDescription: {
      ja: "PEM・DER形式のX.509証明書を解析し、発行者、サブジェクト、有効期限、サブジェクト代替名（SAN）、SHA-256/SHA-1フィンガープリント、公開鍵の種類などを表示するツールです。期限切れやまもなく期限切れの証明書を判定し、証明書チェーンにも対応します。すべてブラウザ内で処理されます。",
      en: "A tool that parses X.509 certificates in PEM or DER format and shows the issuer, subject, expiry date, Subject Alternative Names (SANs), SHA-256/SHA-1 fingerprints, public key type, and more. It flags expired or soon-to-expire certificates and supports certificate chains. Everything runs in your browser.",
    },
    howToUse: {
      ja: [
        "「-----BEGIN CERTIFICATE-----」から始まるPEM形式の証明書を貼り付けるか、.pem / .crt / .cer / .der ファイルを読み込みます。",
        "証明書の内容が一覧で表示されます。上部のバッジで、有効・まもなく期限切れ（30日以内）・期限切れ・有効期間前かを確認できます。",
        "サブジェクト代替名（SAN）で、証明書が有効なドメイン名やIPアドレスを確認します。フィンガープリントはコピーボタンでコピーできます。",
        "証明書チェーン（サーバー証明書と中間証明書など）をまとめて貼り付けると、各証明書を順番に表示します。",
      ],
      en: [
        "Paste a PEM certificate starting with \"-----BEGIN CERTIFICATE-----\", or load a .pem / .crt / .cer / .der file.",
        "The certificate details are listed. The badge at the top shows whether it's valid, expiring soon (within 30 days), expired, or not yet valid.",
        "Check the Subject Alternative Names (SANs) to see which domain names and IP addresses the certificate covers. Copy fingerprints with the copy buttons.",
        "Paste a whole certificate chain (e.g. a server certificate plus intermediates) to see each certificate in order.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "X.509証明書は、HTTPS通信（TLS）などで相手が本物であることを証明するための電子証明書です。証明書には、誰に対して発行されたか（サブジェクト）、誰が発行したか（発行者）、いつまで有効か（有効期限）、どのドメイン名で使えるか（サブジェクト代替名）といった情報がASN.1という形式で記録されています。",
          "このツールは証明書のバイナリ（DER）を直接解析し、人が読みやすい形で表示します。サーバーに設定する前の証明書の確認や、期限切れによる障害の調査、証明書チェーンの順番や中間証明書の確認などに役立ちます。フィンガープリント（SHA-256・SHA-1）は証明書全体のハッシュ値で、証明書を一意に識別するために使われます。",
          "証明書自体は公開情報ですが、社内向けの証明書などはホスト名や組織名が含まれるため外部に出したくない場合もあります。このツールでは解析もハッシュ計算もブラウザ内で完結し、証明書がサーバーへ送信されることはありません。なお、証明書の署名の検証（信頼できる認証局が発行したかどうかの確認）は行いません。",
        ],
        en: [
          "An X.509 certificate is a digital certificate that proves the identity of the other party in HTTPS (TLS) connections and elsewhere. It records, in a format called ASN.1, who it was issued to (subject), who issued it (issuer), how long it's valid (validity period), and which domain names it covers (Subject Alternative Names).",
          "This tool parses the certificate's binary (DER) directly and shows it in a human-readable form. It's useful for checking a certificate before installing it on a server, investigating outages caused by expiry, and verifying the order of a chain and its intermediate certificates. Fingerprints (SHA-256, SHA-1) are hashes of the entire certificate used to identify it uniquely.",
          "Certificates are public information, but internal ones can include hostnames or organization names you'd rather not share. Here, both parsing and hashing happen entirely in your browser, and certificates are never sent to a server. Note that the tool does not verify signatures (i.e. whether a trusted certificate authority issued the certificate).",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "証明書の信頼性（正しい認証局が発行したか）も確認できますか？",
          en: "Can it check whether a certificate is trusted?",
        },
        answer: {
          ja: "できません。このツールは証明書の内容の表示と有効期限の判定のみを行い、署名の検証や失効状態（CRL・OCSP）の確認は行いません。",
          en: "No. This tool only displays certificate contents and checks the validity period. It does not verify signatures or check revocation status (CRL/OCSP).",
        },
      },
      {
        question: {
          ja: "「まもなく期限切れ」は何日前から表示されますか？",
          en: "When is \"Expiring soon\" shown?",
        },
        answer: {
          ja: "有効期限までの残りが30日以下になると「まもなく期限切れ」と表示します。判定にはお使いの端末の現在時刻を使用しています。",
          en: "It's shown when 30 days or fewer remain until expiry. The check uses your device's current time.",
        },
      },
      {
        question: {
          ja: "秘密鍵やCSRも解析できますか？",
          en: "Can it parse private keys or CSRs?",
        },
        answer: {
          ja: "対応しているのは証明書（CERTIFICATE）のみです。秘密鍵は第三者に見せる必要のない情報のため、オンラインのツールに貼り付けないことをおすすめします。",
          en: "Only certificates (CERTIFICATE) are supported. Private keys should never need to be shared, so we recommend not pasting them into online tools.",
        },
      },
      {
        question: {
          ja: "証明書はサーバーに送信されますか？",
          en: "Are certificates sent to a server?",
        },
        answer: {
          ja: "送信されません。解析とフィンガープリントの計算はすべてブラウザ内で行われます。",
          en: "No. Parsing and fingerprint calculation both happen in your browser.",
        },
      },
    ],
    category: "developer",
    icon: FileBadge,
    keywords: {
      ja: "X.509 証明書 SSL TLS PEM デコード 有効期限 期限切れ SAN フィンガープリント CRT",
      en: "x509 certificate ssl tls pem decoder expiry expiration san fingerprint crt der",
    },
    fileMatch: {
      mimeTypes: ["application/x-x509-ca-cert", "application/pkix-cert", "application/x-pem-file"],
      extensions: ["pem", "crt", "cer", "der", "cert"],
    },
  },
  {
    id: "id-generator",
    name: { ja: "UUID/ULID・パスワード生成", en: "UUID/ULID & Password Generator" },
    description: {
      ja: "UUID v4/v7・ULIDの一括生成と、長さや文字種を指定したパスワード生成ができます。",
      en: "Bulk-generate UUID v4/v7 and ULIDs, and create passwords with custom length and character sets.",
    },
    longDescription: {
      ja: "UUID（v4・v7）とULIDを最大1,000個まで一括生成し、長さ・文字種を指定して安全なパスワードを作成できるツールです。乱数には暗号論的に安全なcrypto.getRandomValuesを使用し、すべてブラウザ内で生成されます。",
      en: "A tool for bulk-generating up to 1,000 UUIDs (v4 and v7) or ULIDs, and for creating secure passwords with a custom length and character set. It uses the cryptographically secure crypto.getRandomValues, and everything is generated in your browser.",
    },
    howToUse: {
      ja: [
        "「UUID」「ULID」「パスワード」のタブから、生成したいものを選びます。",
        "UUIDではバージョン（v4/v7）を、パスワードでは文字数と使用する文字の種類を指定します。生成する個数や大文字・ハイフンの有無も変更できます。",
        "設定を変えると自動的に生成し直されます。同じ設定のまま別の値がほしいときは「再生成」を押します。",
        "「クリップボードへコピー」または「テキストで保存」で、生成結果をまとめて利用できます。",
      ],
      en: [
        "Choose what to generate from the \"UUID\", \"ULID\", and \"Password\" tabs.",
        "For UUIDs, pick the version (v4/v7); for passwords, set the length and character types. You can also change how many to generate and toggle uppercase or hyphens.",
        "Values are regenerated automatically whenever you change a setting. Click \"Regenerate\" to get new values with the same settings.",
        "Use \"Copy to clipboard\" or \"Save as text\" to take all the results at once.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "UUID（Universally Unique Identifier）は、データベースのレコードやAPIのリソースなどを一意に識別するための128ビットのIDです。v4はほぼすべてがランダム値で構成され、v7は先頭に生成時刻を含むため時刻順に並びます。ULIDも同様に時刻を先頭に持つ26文字のIDで、URLに使いやすい大文字英数字（Crockford Base32）で表現されます。",
          "v7とULIDは、インデックスの局所性が高くデータベースの主キーとして性能面で有利です。このツールでは、同じミリ秒内で大量に生成した場合でもカウンターを使って生成順を保証しています。v7ではRFC 9562の方式に従い、時刻の直後の12ビットをカウンターとして使用しています。",
          "パスワードは、選択した文字種からそれぞれ最低1文字を含むように生成し、文字の選択には剰余による偏りが生じない方法（棄却法）を使っています。表示される強度は文字数と文字の種類から求めた理論上のエントロピー（ビット数）の目安です。UUID・ULID・パスワードのいずれも、Math.randomではなくcrypto.getRandomValuesで生成しています。",
        ],
        en: [
          "A UUID (Universally Unique Identifier) is a 128-bit ID used to uniquely identify things like database records and API resources. v4 is made almost entirely of random bits, while v7 starts with the creation time so values sort chronologically. A ULID likewise begins with a timestamp and is a 26-character ID written in URL-friendly uppercase Crockford Base32.",
          "v7 and ULIDs have good index locality, which makes them efficient as database primary keys. This tool uses a counter to guarantee creation order even when many values are generated within the same millisecond; for v7 it follows RFC 9562 and uses the 12 bits after the timestamp as the counter.",
          "Passwords include at least one character from each selected type, and characters are chosen with rejection sampling to avoid modulo bias. The displayed strength is a guide based on theoretical entropy (bits) derived from the length and character types. UUIDs, ULIDs, and passwords are all generated with crypto.getRandomValues, not Math.random.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "UUID v4とv7はどちらを使えばよいですか？",
          en: "Should I use UUID v4 or v7?",
        },
        answer: {
          ja: "推測されにくいランダムなIDが必要な場合はv4、データベースの主キーなど生成順に並んでほしい場合はv7が適しています。v7は生成時刻がIDから読み取れる点に注意してください。",
          en: "Use v4 when you need an unpredictable random ID, and v7 when you want IDs that sort in creation order, such as database primary keys. Note that the creation time can be read from a v7 ID.",
        },
      },
      {
        question: {
          ja: "生成したUUIDが重複することはありませんか？",
          en: "Can generated UUIDs collide?",
        },
        answer: {
          ja: "v4は122ビットのランダム値を持つため、現実的に重複する可能性は無視できるほど小さくなります。v7とULIDも時刻に加えて十分な長さのランダム値を含み、同じミリ秒内ではカウンターで区別しています。",
          en: "v4 has 122 random bits, so the chance of a collision is negligible in practice. v7 and ULIDs also include plenty of randomness in addition to the timestamp, and values within the same millisecond are distinguished by a counter.",
        },
      },
      {
        question: {
          ja: "どのくらいの強度のパスワードにすればよいですか？",
          en: "How strong should my password be?",
        },
        answer: {
          ja: "一般的なWebサービスでは、英大小文字・数字・記号を含む16文字以上（約100ビット）が目安です。パスワードマネージャーを使い、サービスごとに異なるパスワードを設定することをおすすめします。",
          en: "For typical web services, aim for at least 16 characters with upper- and lowercase letters, digits, and symbols (about 100 bits). We recommend using a password manager and a different password for each service.",
        },
      },
      {
        question: {
          ja: "生成したパスワードはどこかに保存・送信されますか？",
          en: "Are generated passwords stored or sent anywhere?",
        },
        answer: {
          ja: "保存も送信もされません。生成はブラウザ内でのみ行われ、ページを閉じると消えます。",
          en: "No. Generation happens only in your browser, and the values disappear when you close the page.",
        },
      },
    ],
    category: "developer",
    icon: Dices,
    keywords: {
      ja: "UUID ULID GUID パスワード 生成 ランダム 乱数 ID 一括 v4 v7",
      en: "uuid ulid guid password generator random id bulk v4 v7 secure",
    },
  },
  {
    id: "har-analyzer",
    name: { ja: "HARアナライザー", en: "HAR Analyzer" },
    description: {
      ja: "HARファイルを解析し、エラー・速度・セキュリティ・リソースを自動診断します。",
      en: "Analyze a HAR file and automatically diagnose errors, speed, security, and resources.",
    },
    longDescription: {
      ja: "ブラウザの開発者ツールからエクスポートしたHARファイルを読み込み、総合ヘルススコアの算出と、エラー検出・速度ボトルネック・セキュリティ/プライバシー・リソース内訳の4つの観点から自動診断できるツールです。すべての解析はブラウザ内で完結し、ファイルが外部サーバーへ送信されることはありません。",
      en: "A tool that loads a HAR file exported from your browser's developer tools, computes an overall health score, and automatically diagnoses it across four angles: errors, speed bottlenecks, security/privacy, and resource breakdown. All analysis happens in your browser, and the file is never sent to an external server.",
    },
    howToUse: {
      ja: [
        "HARファイルをドラッグ＆ドロップするか、「ファイルを選択」から読み込みます（Chrome DevToolsのNetworkタブなどで「Save all as HAR」を選ぶとエクスポートできます）。",
        "読み込むと、総合ヘルススコアとともに「エラー検出」「速度ボトルネック」「セキュリティ/プライバシー」「リソース内訳」の4つのタブで自動診断結果が表示されます。",
        "下部の「リクエスト一覧」で、キーワード・ステータスコード・リソース種別による絞り込みができます。行をクリックすると、リクエスト/レスポンスヘッダーやCookie、クエリパラメータなどの詳細がドロワーに表示されます。",
        "別のHARファイルを解析したい場合は、「別のファイルを読み込む」から読み込み直せます。",
      ],
      en: [
        "Drag and drop a HAR file, or load one via \"Choose file\" (you can export one from Chrome DevTools' Network tab by choosing \"Save all as HAR\").",
        "Once loaded, the overall health score appears along with automatic diagnostics across four tabs: \"Error Detection\", \"Speed Bottlenecks\", \"Security / Privacy\", and \"Resource Breakdown\".",
        "In the \"Request list\" below, filter by keyword, status code, or resource type. Click a row to open a drawer with the request/response headers, cookies, and query parameters.",
        "To analyze a different file, click \"Load another file\" to load a new one.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "HARアナライザーは、HTTP Archive（HAR）形式のファイルをブラウザ内で解析し、Webページのパフォーマンスやセキュリティ上の問題点を自動で洗い出せるツールです。障害調査やパフォーマンスチューニング、外部から共有されたHARファイルのレビューなど、生のJSONを1件ずつ目視で追うのが大変な場面で活用できます。",
          "総合ヘルススコア（100点満点）は、4xx/5xxエラーの件数、応答時間が1秒を超えるリクエストの件数、主要なセキュリティヘッダー（CSP・HSTS・X-Frame-Optionsなど）の欠如、非HTTPS通信の有無、未圧縮・巨大なリソースの件数から減点方式で算出しており、各タブにはスコアの根拠となった問題点と具体的な改善アドバイスが表示されます。",
          "リソースはURLの拡張子やMIMEタイプ、Chrome系DevToolsが付与する`_resourceType`などの情報をもとに、ドキュメント・JavaScript・CSS・画像・フォント・API/XHR・メディア・その他の8種類に自動分類され、種類ごとのファイルサイズとリクエスト数の比率を確認できます。",
        ],
        en: [
          "The HAR Analyzer parses HTTP Archive (HAR) files entirely in your browser and automatically surfaces performance and security issues on a web page. It's useful for incident investigations, performance tuning, or reviewing a HAR file someone shared with you — cases where manually scanning raw JSON entry by entry would be tedious.",
          "The overall health score (out of 100) is computed by deducting points for the number of 4xx/5xx errors, requests that take over 1 second to respond, missing key security headers (CSP, HSTS, X-Frame-Options, and more), the presence of non-HTTPS traffic, and uncompressed or oversized resources. Each tab shows the specific issues behind the score along with concrete improvement advice.",
          "Resources are automatically categorized into eight types — document, JavaScript, CSS, image, font, API/XHR, media, and other — based on the URL extension, MIME type, and metadata such as the `_resourceType` field added by Chromium-based DevTools, so you can see the file size and request count ratio for each type.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "HARファイルはどこで作成・エクスポートできますか？",
          en: "Where can I create or export a HAR file?",
        },
        answer: {
          ja: "Chrome・Edge・Firefoxなどのブラウザの開発者ツールを開き、「Network（ネットワーク）」タブでページを再読み込みした後、一覧を右クリックして「Save all as HAR」（または類似のメニュー）を選ぶとHARファイルとして保存できます。",
          en: "Open your browser's developer tools (Chrome, Edge, Firefox, etc.), go to the \"Network\" tab, reload the page, then right-click the request list and choose \"Save all as HAR\" (or a similarly named option) to save it as a HAR file.",
        },
      },
      {
        question: {
          ja: "総合ヘルススコアはどのように算出されていますか？",
          en: "How is the overall health score calculated?",
        },
        answer: {
          ja: "100点を満点として、5xxエラー・4xxエラーの件数、1秒を超える低速リクエストの件数、未適用のセキュリティヘッダー数、非HTTPS通信の有無、未圧縮・巨大なリソースの件数に応じて減点する方式で算出しています。スコアの内訳は各タブの診断結果として確認できます。",
          en: "Starting from a perfect score of 100, points are deducted based on the number of 5xx and 4xx errors, requests slower than 1 second, missing security headers, the presence of non-HTTPS traffic, and uncompressed or oversized resources. The breakdown behind the score is shown in each diagnostic tab.",
        },
      },
      {
        question: {
          ja: "大きなHARファイルでも解析できますか？",
          en: "Can it analyze large HAR files?",
        },
        answer: {
          ja: "ブラウザのメモリが許す範囲であれば解析可能です。ただし数千件を超えるような非常に大きなHARファイルの場合、読み込みや一覧表示に時間がかかることがあります。",
          en: "Yes, as long as your browser's memory allows it. For very large HAR files with several thousand entries or more, loading and rendering the list may take some time.",
        },
      },
      {
        question: {
          ja: "読み込んだHARファイルはサーバーに送信されますか？",
          en: "Is the HAR file I load sent to a server?",
        },
        answer: {
          ja: "送信されません。ファイルの読み込み・解析・診断のすべての処理はブラウザ内のJavaScriptで完結します。",
          en: "No. Loading, parsing, and diagnosing the file all happen entirely with JavaScript in your browser.",
        },
      },
    ],
    category: "developer",
    icon: Activity,
    keywords: {
      ja: "har har解析 ネットワーク パフォーマンス セキュリティヘッダー devtools",
      en: "har har analyzer network performance security headers devtools",
    },
    fileMatch: {
      mimeTypes: ["application/json"],
      extensions: ["har", "json"],
    },
  },
  {
    id: "curl-converter",
    name: { ja: "cURL→コード変換（fetch / axios / Python / C# / Go）", en: "cURL to Code (fetch / axios / Python / C# / Go)" },
    description: {
      ja: "cURL コマンドを JavaScript（fetch・axios）、Python、C#、Go のHTTPリクエストコードに変換します。",
      en: "Convert cURL commands into HTTP request code for JavaScript (fetch, axios), Python, C#, and Go.",
    },
    longDescription: {
      ja: "ブラウザの開発者ツールやAPIドキュメントからコピーした cURL コマンドを、JavaScript（fetch・axios）、Python（requests）、C#（HttpClient）、Go（net/http）のコードに変換するツールです。ヘッダー・JSON・フォーム・マルチパート・Basic認証に対応し、認証情報のマスキングも行えます。変換はブラウザ内で完結します。",
      en: "A tool that converts cURL commands copied from your browser's developer tools or API docs into code for JavaScript (fetch, axios), Python (requests), C# (HttpClient), and Go (net/http). It handles headers, JSON, form and multipart bodies, and Basic auth, and can mask credentials. Everything runs in your browser.",
    },
    howToUse: {
      ja: [
        "ブラウザの開発者ツールのネットワークタブで、リクエストを右クリックして「Copy as cURL」を選び、入力欄に貼り付けます（bash・cmd のどちらの形式でも構いません）。",
        "出力したい言語のタブ（fetch・axios・Python・C#・Go）を選ぶと、変換したコードが表示されます。「cURL」タブでは整形した cURL を確認できます。",
        "「機密情報をマスクする」がオンの場合、Authorization・Cookie・APIキーなどは <TOKEN> などに置き換えて出力されます。実際の値が必要な場合はオフにしてください。",
        "右側の「解析結果」で、メソッド・URL・クエリ・ヘッダー・ボディが正しく読み取れているか確認し、コピーまたはダウンロードします。",
      ],
      en: [
        "In your browser's developer tools, right-click a request in the Network tab, choose \"Copy as cURL\", and paste it into the input (bash or cmd format).",
        "Choose a language tab (fetch, axios, Python, C#, or Go) to see the converted code. The \"cURL\" tab shows a cleaned-up cURL command.",
        "With \"Mask secrets\" on, Authorization, Cookie, API keys, and similar values are replaced with placeholders such as <TOKEN>. Turn it off if you need the real values.",
        "Check under \"Parsed request\" that the method, URL, query, headers, and body were read correctly, then copy or download the code.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "cURL→コード変換ツールは、cURL コマンドをプログラミング言語のHTTPリクエストコードに書き換えるツールです。ブラウザで動いている通信を自分のスクリプトで再現したいとき、APIドキュメントの例を使い慣れた言語で試したいときなどに役立ちます。HARアナライザーで通信を調べたあとに使うのも便利です。",
          "シングルクォート・ダブルクォート・$'...' のエスケープ、バックスラッシュによる行継続を含む bash 形式と、^ によるエスケープを使う Windows のコマンドプロンプト形式（Chrome の「Copy as cURL (cmd)」）の両方を解析できます。-X、-H、-d、--data-raw、--data-urlencode、-F、-u、-b、-A、-e、-L、-k、--compressed、-G、--url に対応し、それ以外のオプションは無視したことを一覧で表示します。",
          "JSONのボディは整形して出力し、フォーム（URLエンコード）やマルチパートは各言語の標準的な書き方に変換します。認証ヘッダーやCookieはそのまま共有すると危険なため、既定でプレースホルダに置き換えます。入力した内容はサーバーに送信されず、リクエストが実行されることもありません。",
        ],
        en: [
          "The cURL to Code tool rewrites cURL commands as HTTP request code in programming languages. It's handy for reproducing a request your browser makes in your own script, or for trying API documentation examples in a language you're comfortable with. It also pairs well with the HAR Analyzer.",
          "It parses both bash syntax (single and double quotes, $'...' escapes, and backslash line continuations) and Windows Command Prompt syntax with ^ escapes (Chrome's \"Copy as cURL (cmd)\"). It supports -X, -H, -d, --data-raw, --data-urlencode, -F, -u, -b, -A, -e, -L, -k, --compressed, -G, and --url, and lists any other options it ignored.",
          "JSON bodies are pretty-printed, and form (URL-encoded) and multipart bodies are converted to each language's standard style. Since sharing authorization headers and cookies is risky, they're replaced with placeholders by default. Nothing you enter is sent to a server, and the request is never executed.",
        ],
      },
    },
    faq: [
      {
        question: { ja: "Windows の「Copy as cURL (cmd)」にも対応していますか？", en: "Does it support Windows \"Copy as cURL (cmd)\"?" },
        answer: {
          ja: "はい。^\" や ^& などの ^ によるエスケープと、行末の ^ による行継続を含むコマンドプロンプト形式を自動で判別して解析します。",
          en: "Yes. Command Prompt syntax with ^ escapes such as ^\" and ^&, and ^ line continuations, is detected and parsed automatically.",
        },
      },
      {
        question: { ja: "ファイルを送信する -F 'file=@path' はどうなりますか？", en: "What happens to -F 'file=@path' file uploads?" },
        answer: {
          ja: "ファイルの中身は読み込まず、各言語でファイルを開いて送信するコード（Pythonの open()、Goの os.Open など）を生成します。パスは実際の環境に合わせて書き換えてください。-d @file のようなファイルからのデータ読み込みには対応していません。",
          en: "File contents aren't read; instead, code that opens and sends the file in each language (open() in Python, os.Open in Go, and so on) is generated. Adjust the path for your environment. Reading request data from a file, as in -d @file, isn't supported.",
        },
      },
      {
        question: { ja: "マスキングはどのような値が対象ですか？", en: "Which values are masked?" },
        answer: {
          ja: "Authorization・Cookie・X-API-Key などのヘッダー、名前に token・secret・password などを含むヘッダー、api_key・token・access_token などのクエリパラメータ、-u で指定したBasic認証の値が対象です。ボディ内の値はマスクされないためご注意ください。",
          en: "Headers such as Authorization, Cookie, and X-API-Key; headers whose names contain token, secret, password, and similar words; query parameters such as api_key, token, and access_token; and Basic auth credentials given with -u. Values inside the body are not masked.",
        },
      },
      {
        question: { ja: "入力した内容が送信されることはありますか？", en: "Is anything I enter sent anywhere?" },
        answer: {
          ja: "ありません。解析と変換はブラウザ内で行われ、リクエストが実行されることもありません。",
          en: "No. Parsing and conversion happen in your browser, and the request is never executed.",
        },
      },
    ],
    category: "developer",
    icon: Terminal,
    keywords: {
      ja: "curl コード変換 fetch axios python requests c# httpclient go net/http api リクエスト 開発者ツール copy as curl",
      en: "curl to code converter fetch axios python requests csharp httpclient golang net/http api request copy as curl",
    },
  },
  {
    id: "log-masker",
    name: { ja: "ログ・HARの機密情報マスキング", en: "Log & HAR Data Masker" },
    description: {
      ja: "ログやHARに含まれるCookie・認証ヘッダー・トークン・メールアドレス・IPアドレスを伏せ字にします。",
      en: "Mask cookies, auth headers, tokens, email addresses, and IP addresses in logs and HAR files.",
    },
    longDescription: {
      ja: "ログファイルやHAR（ブラウザの通信記録）に含まれるCookie、Authorizationヘッダー、トークン、APIキー、メールアドレス、IPアドレスなどの機密情報を検出して伏せ字にし、ダウンロードできるツールです。マスキング対象は自由に選択でき、すべてブラウザ内で処理されます。",
      en: "A tool that detects sensitive data in log files and HAR (browser network recordings) — cookies, Authorization headers, tokens, API keys, email addresses, IP addresses, and more — masks it, and lets you download the result. Choose exactly what to mask; everything runs in your browser.",
    },
    howToUse: {
      ja: [
        "ログやHAR（JSON）を貼り付けるか、「ファイルを開く」またはドラッグ＆ドロップでファイルを読み込みます。",
        "「マスキング対象」で、伏せたい情報の種類（Cookie・認証ヘッダー・トークン・メールアドレス・IPアドレス・任意の文字列）を選びます。各項目には検出件数が表示されます。",
        "「伏せ字の形式」で、同じ値に同じ番号を振るラベル形式（[EMAIL_1] など）か、単純な伏せ字（****）かを選びます。",
        "結果を確認し、「ダウンロード」または「クリップボードへコピー」で保存します。共有する前に、機密情報が残っていないか目視でも確認してください。",
      ],
      en: [
        "Paste a log or HAR (JSON), or load a file with \"Open file\" or by drag and drop.",
        "Under \"What to mask\", choose the kinds of data to hide — cookies, authorization headers, tokens, email addresses, IP addresses, and custom terms. Each item shows how many matches were found.",
        "Under \"Mask format\", choose labeled masks that give the same value the same number (e.g. [EMAIL_1]) or plain asterisks (****).",
        "Review the result and save it with \"Download\" or \"Copy to clipboard\". Before sharing, double-check by eye that no sensitive data remains.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "不具合の調査やサポートへの問い合わせでは、ログファイルやHARファイルを共有する場面がよくあります。しかし、これらのファイルにはセッションCookieや認証トークン、APIキーといった、第三者に渡るとアカウントを乗っ取られるおそれのある情報や、メールアドレス・IPアドレスなどの個人情報が含まれていることがあります。このツールは、共有前にそれらを自動で検出して伏せ字にします。",
          "HARやJSONを入力した場合は構造を解析し、headers・cookies・queryStringなどの項目名に基づいて値を正確に伏せたうえで、URLやレスポンス本文などの文字列にもパターン検出を適用します。テキストのログでは「Cookie:」「Authorization:」のようなヘッダー行、JWT、主要サービスのAPIキー、token=… や \"password\": … のような項目を検出します。ラベル形式では同じ値に同じ番号を振るため、伏せたあとでも「同じユーザー」「同じトークン」の関係を追跡できます。",
          "マスキング前のデータがブラウザの外へ送信されることはありません。ただし、パターンによる自動検出には限界があるため、独自形式のIDや本文中の個人名などは「任意の文字列」で指定し、共有前には必ず結果を目視で確認してください。",
        ],
        en: [
          "When investigating bugs or contacting support, you often need to share log files or HAR files. These files can contain session cookies, auth tokens, and API keys that could let someone take over an account, as well as personal data such as email and IP addresses. This tool automatically detects and masks them before you share.",
          "When you provide a HAR or JSON, the tool parses its structure and masks values precisely based on fields such as headers, cookies, and queryString, then also applies pattern detection to strings like URLs and response bodies. For text logs, it detects header lines such as \"Cookie:\" and \"Authorization:\", JWTs, common API key formats, and fields like token=… or \"password\": …. Labeled masks give identical values the same number, so you can still follow which user or token is which after masking.",
          "Your unmasked data never leaves your browser. Pattern-based detection has its limits, though — specify custom IDs or names that appear in text via \"Custom terms\", and always review the result before sharing.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "マスキング後のHARは、HARビューアーで開けますか？",
          en: "Can I open the masked HAR in a HAR viewer?",
        },
        answer: {
          ja: "開けます。HARやJSONは構造を保ったまま値だけを置き換え、インデント付きのJSONとして出力するため、ブラウザの開発者ツールやHARアナライザーでそのまま読み込めます。",
          en: "Yes. HAR and JSON input keeps its structure — only values are replaced — and is output as indented JSON, so it loads directly in browser dev tools or a HAR analyzer.",
        },
      },
      {
        question: {
          ja: "「ラベル付き」と「伏せ字」の違いは何ですか？",
          en: "What's the difference between \"Labeled\" and \"Asterisks\"?",
        },
        answer: {
          ja: "「ラベル付き」は [EMAIL_1] や [TOKEN_2] のように種類と番号で置き換え、同じ値には同じ番号を振ります。どのリクエストが同じトークンを使っているかなどを伏せたまま追跡したい場合に便利です。「伏せ字」はすべて **** に置き換えます。",
          en: "\"Labeled\" replaces values with a type and number such as [EMAIL_1] or [TOKEN_2], giving identical values the same number — handy for tracking which requests share a token without revealing it. \"Asterisks\" replaces everything with ****.",
        },
      },
      {
        question: {
          ja: "バージョン番号がIPアドレスとして伏せられてしまいます。",
          en: "A version number was masked as an IP address.",
        },
        answer: {
          ja: "「1.2.3.4」のように4つの数字をドットで区切った文字列はIPv4アドレスと区別できないため、伏せられることがあります。不要な場合は「IPアドレス」のチェックを外してください。",
          en: "Strings of four dot-separated numbers like \"1.2.3.4\" can't be distinguished from IPv4 addresses, so they may be masked. Uncheck \"IP addresses\" if you don't need it.",
        },
      },
      {
        question: {
          ja: "ファイルはサーバーにアップロードされますか？",
          en: "Are files uploaded to a server?",
        },
        answer: {
          ja: "アップロードされません。ファイルの読み込みからマスキング、ダウンロードまで、すべてブラウザ内で処理されます。",
          en: "No. Everything from loading the file to masking and downloading happens in your browser.",
        },
      },
    ],
    category: "developer",
    icon: EyeOff,
    keywords: {
      ja: "マスキング 伏せ字 ログ HAR 機密情報 Cookie トークン 個人情報 匿名化 墨消し",
      en: "mask redact log har sensitive data cookie token api key email ip anonymize sanitize",
    },
    fileMatch: {
      mimeTypes: ["application/json", "text/plain"],
      extensions: ["har", "log", "txt", "json"],
    },
  },
  {
    id: "folder-tree",
    name: { ja: "フォルダ構成ツリー出力", en: "Folder Tree Generator" },
    description: {
      ja: "フォルダや圧縮ファイル（ZIP・TAR）の階層構造を、tree コマンドのようなテキストで出力します。",
      en: "Output the structure of a folder or archive (ZIP, TAR) as text, like the tree command.",
    },
    longDescription: {
      ja: "フォルダや圧縮ファイル（ZIP・TAR・TAR.GZ）を読み込み、ディレクトリ構成を tree コマンドのようなテキストで出力するツールです。表示する階層の深さ、ファイルの表示・非表示、除外する名前、出力形式などを設定でき、すべてブラウザ内で処理されます。",
      en: "A tool that reads a folder or an archive (ZIP, TAR, TAR.GZ) and outputs its directory structure as text, like the tree command. You can set the depth to display, whether to show files, names to exclude, the output style, and more — all processed in your browser.",
    },
    howToUse: {
      ja: [
        "フォルダまたは圧縮ファイル（ZIP・TAR・TAR.GZ）をドラッグ＆ドロップするか、「フォルダを選択」「圧縮ファイルを選択」から読み込みます。",
        "読み込みが終わると、右側の「出力結果」に階層構造がテキストで表示されます。",
        "「表示設定」で、表示する階層の深さ、ファイルの表示、隠しファイルの表示、サイズの表示、出力形式（ツリー・ASCII・インデント・Markdown）などを切り替えます。変更はすぐに反映されます。",
        "「除外する名前」に node_modules や *.log などを指定すると、一致するファイル・フォルダを出力から除外できます。",
        "「クリップボードへコピー」または「テキストをダウンロード」で結果を保存します。",
      ],
      en: [
        "Drag and drop a folder or an archive (ZIP, TAR, TAR.GZ), or load one with \"Choose folder\" or \"Choose archive\".",
        "Once loaded, the structure appears as text under \"Output\".",
        "Use \"Display settings\" to change the depth to display, whether to show files, hidden files, and sizes, and the output style (tree, ASCII, indentation, or Markdown). Changes apply immediately.",
        "Enter names such as node_modules or *.log in \"Names to exclude\" to leave matching files and folders out of the output.",
        "Save the result with \"Copy to clipboard\" or \"Download text\".",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "フォルダ構成ツリー出力ツールは、フォルダの中身を「├──」「└──」などの罫線を使ったツリー形式のテキストに変換するツールです。READMEや設計書にディレクトリ構成を載せたいとき、プロジェクトの構成をチャットやAIに説明したいとき、受け取った圧縮ファイルの中身を展開前に確認したいときなどに役立ちます。",
          "圧縮ファイルは中身を展開せず、ファイル名とサイズの情報だけを読み取ります。ZIPはファイル末尾にある一覧（中央ディレクトリ）だけを読むため、大きなファイルでもすぐに表示できます。日本語版Windowsで作られた、ファイル名がShift_JISのZIPにも対応しています。",
          "フォルダはブラウザの機能を使って読み込み、ファイルの中身は一切読みません。読み込んだ情報がサーバーへ送信されることもありません。",
        ],
        en: [
          "The Folder Tree Generator turns the contents of a folder into tree-style text using box-drawing lines such as \"├──\" and \"└──\". It's handy for adding a directory layout to a README or design document, explaining a project's structure in a chat or to an AI, or checking what's inside an archive before extracting it.",
          "Archives are never extracted — only file names and sizes are read. For ZIP files, only the listing at the end of the file (the central directory) is read, so even large archives show up instantly. ZIP files with Shift_JIS file names, created on Japanese Windows, are supported too.",
          "Folders are read using your browser's built-in features, and file contents are never read. Nothing you load is sent to a server.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "対応している圧縮形式は何ですか？",
          en: "Which archive formats are supported?",
        },
        answer: {
          ja: "ZIP・TAR・TAR.GZ（.tgz）に対応しています。形式はファイルの中身から判定するため、JARやDOCXなどZIP形式のファイルも読み込めます。7zやRARには対応していません。",
          en: "ZIP, TAR, and TAR.GZ (.tgz). The format is detected from the file contents, so ZIP-based files such as JAR or DOCX can also be loaded. 7z and RAR are not supported.",
        },
      },
      {
        question: {
          ja: "空のフォルダが表示されないのはなぜですか？",
          en: "Why don't empty folders appear?",
        },
        answer: {
          ja: "「フォルダを選択」ボタンから読み込んだ場合、ブラウザの仕様によりファイルの一覧しか取得できないため、空のフォルダは表示されません。空のフォルダも表示したい場合は、フォルダをドラッグ＆ドロップで読み込んでください。",
          en: "When you load a folder with the \"Choose folder\" button, browsers only provide the list of files, so empty folders can't be shown. To include empty folders, drag and drop the folder instead.",
        },
      },
      {
        question: {
          ja: "階層の深さはどのように数えますか？",
          en: "How is depth counted?",
        },
        answer: {
          ja: "読み込んだフォルダ（または圧縮ファイル）の直下を1階層目として数えます。「2階層まで」を選ぶと、直下の項目と、その1つ下の項目までが表示されます。",
          en: "Items directly inside the loaded folder (or archive) are level 1. Choosing \"Up to 2 levels\" shows those items plus the items one level below them.",
        },
      },
      {
        question: {
          ja: "ファイルの中身がサーバーに送信されることはありますか？",
          en: "Are my files sent to a server?",
        },
        answer: {
          ja: "ありません。読み取るのはファイル名とサイズだけで、処理はすべてブラウザ内で完結します。",
          en: "No. Only file names and sizes are read, and all processing happens in your browser.",
        },
      },
    ],
    category: "developer",
    icon: FolderTree,
    keywords: {
      ja: "フォルダ ディレクトリ 構成 階層 ツリー tree コマンド zip tar 圧縮ファイル 一覧 README",
      en: "folder directory structure tree command hierarchy zip tar archive list readme",
    },
    fileMatch: {
      mimeTypes: ["application/zip", "application/x-zip-compressed", "application/x-tar", "application/gzip", "application/x-gzip"],
      extensions: ["zip", "tar", "tgz", "gz"],
    },
  },
  {
    id: "cron-explainer",
    name: { ja: "cron式の解説・次回実行日時", en: "Cron Expression Explainer" },
    description: {
      ja: "cron式の意味を自然な文章で説明し、次回以降の実行日時を一覧表示します。",
      en: "Explain cron expressions in plain language and list upcoming run times.",
    },
    longDescription: {
      ja: "cron式（crontabのスケジュール設定）を入力すると、その意味を自然な文章で説明し、指定したタイムゾーンでの次回以降の実行日時を一覧表示するツールです。秒付きの6フィールド形式や@dailyなどのマクロにも対応し、すべてブラウザ内で処理されます。",
      en: "Enter a cron expression (a crontab schedule) to get a plain-language explanation and a list of upcoming run times in the time zone you choose. It also supports 6-field expressions with seconds and macros like @daily, all processed in your browser.",
    },
    howToUse: {
      ja: [
        "「cron式」に、スペース区切りで「分 時 日 月 曜日」を入力します（例: 0 9 * * 1-5）。よく使う式はボタンから入力することもできます。",
        "「この式の意味」に自然な文章での説明と、各フィールドが表す値の一覧が表示されます。書式に誤りがある場合は、どのフィールドが原因かが表示されます。",
        "「次回以降の実行日時」で、タイムゾーンと表示件数を選ぶと、現在時刻以降に実行される日時が一覧で表示されます。",
        "「クリップボードへコピー」で、実行日時の一覧をISO 8601形式でコピーできます。",
      ],
      en: [
        "Enter \"minute hour day month weekday\" separated by spaces under \"Cron expression\" (e.g. 0 9 * * 1-5). You can also insert common expressions with the buttons.",
        "\"What this means\" shows a plain-language description and the values each field represents. If the syntax is wrong, you'll see which field caused the problem.",
        "Under \"Upcoming run times\", choose a time zone and how many runs to show to list the run times after the current time.",
        "Use \"Copy to clipboard\" to copy the list of run times in ISO 8601 format.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "cron式は、Linuxのcrontabをはじめ、GitHub ActionsやKubernetesのCronJob、各種クラウドのスケジューラーなどで定期実行のタイミングを指定するために使われる書式です。「*/15 9-18 * * 1-5」のような式は一目で意味を読み取りにくく、設定ミスによって想定外の時刻にジョブが動いてしまうこともあります。",
          "このツールは、cron式を自然な文章に変換して意味を確認できるほか、実際に次にいつ実行されるのかを日時の一覧で示します。「日」と「曜日」の両方を指定した場合は、標準的なcronと同じく、どちらかに一致すれば実行されるものとして計算します。夏時間の切り替えで存在しない時刻は、実行日時の一覧から除外されます。",
          "説明文の生成にはオープンソースライブラリのcronstrue（MITライセンス）を、実行日時の計算にはブラウザ標準のIntl APIを使用しています。GitHub ActionsなどUTCで動くスケジューラーの設定を確認するときは、タイムゾーンに「UTC」を指定してください。",
        ],
        en: [
          "Cron expressions specify when recurring jobs run in Linux crontab, GitHub Actions, Kubernetes CronJobs, and many cloud schedulers. An expression like \"*/15 9-18 * * 1-5\" is hard to read at a glance, and a mistake can make a job run at unexpected times.",
          "This tool translates cron expressions into plain language and shows exactly when they will run next as a list of dates. When both day and weekday are specified, it follows standard cron behavior and runs on days that match either one. Times skipped by daylight saving transitions are excluded from the list.",
          "Descriptions are generated with the open-source cronstrue library (MIT license), and run times are calculated with the browser's built-in Intl API. When checking schedules for services that run in UTC, such as GitHub Actions, set the time zone to \"UTC\".",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "秒を含む6フィールドのcron式にも対応していますか？",
          en: "Are 6-field cron expressions with seconds supported?",
        },
        answer: {
          ja: "対応しています。6つのフィールドを入力すると、先頭を秒として扱います（Spring・Quartzなどの形式）。",
          en: "Yes. When you enter six fields, the first one is treated as seconds (as in Spring or Quartz).",
        },
      },
      {
        question: {
          ja: "「L」「W」「#」は使えますか？",
          en: "Can I use \"L\", \"W\", or \"#\"?",
        },
        answer: {
          ja: "月末（L）や直近の平日（W）、第n曜日（#）などの拡張構文は、実装によって解釈が異なるため現在は対応していません。",
          en: "Extended syntax such as last day (L), nearest weekday (W), and nth weekday (#) isn't currently supported because implementations interpret it differently.",
        },
      },
      {
        question: {
          ja: "GitHub Actionsのscheduleの確認に使えますか？",
          en: "Can I use this to check GitHub Actions schedules?",
        },
        answer: {
          ja: "使えます。GitHub ActionsのcronはUTCで評価されるため、タイムゾーンに「UTC」を指定して確認してください。日本時間で確認したい場合は「Asia/Tokyo」を指定すると、UTCの式が日本時間で何時に実行されるかがわかります。",
          en: "Yes. GitHub Actions evaluates cron in UTC, so set the time zone to \"UTC\". To see when a UTC schedule runs in your local time, switch the time zone to your own region.",
        },
      },
      {
        question: {
          ja: "入力したcron式はサーバーに送信されますか？",
          en: "Is my cron expression sent to a server?",
        },
        answer: {
          ja: "送信されません。解析と計算はすべてブラウザ内のJavaScriptで行われます。",
          en: "No. All parsing and calculation is done with JavaScript in your browser.",
        },
      },
    ],
    category: "developer",
    icon: Clock,
    keywords: {
      ja: "cron crontab cron式 スケジュール 定期実行 次回実行 解説 GitHub Actions",
      en: "cron crontab expression schedule next run explain parser github actions",
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
    id: "code-formatter",
    name: { ja: "HTML/CSS/JS整形・Minify", en: "HTML/CSS/JS Formatter & Minifier" },
    description: {
      ja: "HTML・CSS（SCSS・Less）・JavaScript・TypeScriptを整形、またはMinify（圧縮）します。",
      en: "Format or minify HTML, CSS (SCSS, Less), JavaScript, and TypeScript.",
    },
    longDescription: {
      ja: "HTML・CSS（SCSS・Less）・JavaScript（JSX）・TypeScriptのコードを、Prettierで読みやすく整形したり、terser・csso・html-minifier-terserでMinify（圧縮）したりできるツールです。インデントや引用符などの整形オプション、変数名の短縮などの圧縮オプション、gzip後のサイズ比較に対応し、処理はすべてブラウザ内で行われます。",
      en: "A tool that formats HTML, CSS (SCSS, Less), JavaScript (JSX), and TypeScript with Prettier, or minifies them with terser, csso, and html-minifier-terser. It offers formatting options such as indentation and quotes, minification options such as variable name mangling, and size comparison including gzip — all processed in your browser.",
    },
    howToUse: {
      ja: [
        "コードを入力欄に貼り付けるか、ファイルをドラッグ＆ドロップします。言語がわからない場合は「言語を自動判定」を押します。",
        "上部のタブで言語（HTML・CSS・JavaScript・TypeScript）を、右側で「整形」または「Minify」を選びます。CSSではSCSS・Lessも選べます。",
        "インデントや1行の最大幅（整形）、コメントの削除や変数名の短縮（Minify）などのオプションを調整します。変更はすぐに出力に反映されます。",
        "出力欄の下でサイズと削減率（gzip後の概算を含む）を確認し、「クリップボードへコピー」または「ダウンロード」で保存します。構文エラーがある場合は行番号が表示されます。",
      ],
      en: [
        "Paste code into the input or drag and drop a file. If you're not sure of the language, click \"Detect language\".",
        "Choose the language (HTML, CSS, JavaScript, or TypeScript) with the tabs and \"Format\" or \"Minify\" next to them. For CSS you can also choose SCSS or Less.",
        "Adjust options such as indentation and print width (format) or comment removal and mangling (minify). Changes apply to the output right away.",
        "Check the size and reduction rate (including an estimate after gzip) below the output, then save with \"Copy to clipboard\" or \"Download\". Syntax errors are shown with line numbers.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "HTML/CSS/JS整形・Minifyツールは、Webサイトのコードを読みやすく整えたり、公開用に小さく圧縮したりするツールです。圧縮されて読めないコードを調べたいとき、コードの書き方を揃えたいとき、ビルドツールを使わずに手早くファイルを小さくしたいときに役立ちます。SQL整形ツールのWeb版のような感覚で使えます。",
          "整形には広く使われているPrettier（MIT）を、MinifyにはJavaScriptにterser（BSD-2-Clause）、CSSにcsso（MIT）、HTMLにhtml-minifier-terser（MIT）を使っています。動作が変わる可能性のある積極的な最適化（console の削除、属性の引用符や閉じタグの省略）は既定でオフにし、注意書きを表示しています。",
          "ライブラリは選んだ言語とモードに必要なものだけを、処理するときに初めて読み込みます。処理はWeb Workerで行うため大きなファイルでも画面が固まりにくく、入力したコードがサーバーへ送信されることはありません。",
        ],
        en: [
          "The HTML/CSS/JS Formatter & Minifier tidies website code for readability or compresses it for production. It's handy for inspecting minified code, keeping code style consistent, or quickly shrinking a file without setting up build tools — much like the SQL Formatter, but for web code.",
          "Formatting uses the widely adopted Prettier (MIT). Minification uses terser (BSD-2-Clause) for JavaScript, csso (MIT) for CSS, and html-minifier-terser (MIT) for HTML. Aggressive optimizations that may change behavior — removing console calls, omitting attribute quotes, and dropping optional closing tags — are off by default and come with a warning.",
          "Only the libraries needed for the selected language and mode are loaded, and only when processing starts. Processing runs in a Web Worker so the page stays responsive with large files, and your code is never sent to a server.",
        ],
      },
    },
    faq: [
      {
        question: { ja: "TypeScriptやSCSSもMinifyできますか？", en: "Can I minify TypeScript or SCSS?" },
        answer: {
          ja: "TypeScript・SCSS・Lessは整形のみに対応しています。Minifyする場合は、コンパイル後のJavaScript・CSSを入力してください。JSXを含むJavaScriptも整形はできますが、Minifyはできません。",
          en: "TypeScript, SCSS, and Less can only be formatted. To minify, enter the compiled JavaScript or CSS. JavaScript containing JSX can be formatted but not minified.",
        },
      },
      {
        question: { ja: "gzip後のサイズとは何ですか？", en: "What is the size after gzip?" },
        answer: {
          ja: "多くのWebサーバーはファイルをgzipなどで圧縮して配信します。実際に転送されるサイズの目安として、入力と出力をそれぞれgzip（最大圧縮）で圧縮したサイズを表示しています。",
          en: "Most web servers compress files with gzip or similar when serving them. As an estimate of the actual transfer size, the sizes of the input and output compressed with gzip (maximum level) are shown.",
        },
      },
      {
        question: { ja: "Minifyでコードが動かなくなることはありますか？", en: "Can minification break my code?" },
        answer: {
          ja: "既定の設定は安全な最適化のみですが、eval や関数名に依存するコードでは変数名の短縮が影響する場合があります。問題があれば「変数名を短縮する」をオフにしてください。注意書きのあるオプションは、影響を理解したうえで使用してください。",
          en: "The defaults only apply safe optimizations, but mangling can affect code that relies on eval or function names. If you run into problems, turn off \"Shorten variable names\". Use the options marked with a warning only if you understand their impact.",
        },
      },
      {
        question: { ja: "入力したコードは送信されますか？", en: "Is my code sent anywhere?" },
        answer: {
          ja: "送信されません。整形・Minifyはすべてブラウザ内で行われます。",
          en: "No. Formatting and minification happen entirely in your browser.",
        },
      },
    ],
    category: "developer",
    icon: CodeXml,
    keywords: {
      ja: "html css scss less javascript typescript jsx 整形 フォーマット prettier minify 圧縮 terser csso beautify",
      en: "html css scss less javascript typescript jsx format beautify prettier minify compress terser csso",
    },
    fileMatch: {
      mimeTypes: ["text/html", "text/css", "text/javascript", "application/javascript"],
      extensions: ["html", "htm", "css", "scss", "less", "js", "mjs", "cjs", "jsx", "ts", "tsx"],
    },
  },
  {
    id: "sql-to-prisma",
    name: { ja: "SQL DDL→Prisma変換", en: "SQL DDL to Prisma Converter" },
    description: {
      ja: "CREATE TABLE文を解析し、schema.prismaのモデル・enum・リレーション定義に変換します。",
      en: "Convert CREATE TABLE statements into schema.prisma models, enums, and relations.",
    },
    longDescription: {
      ja: "SQLのCREATE TABLE文（DDL）を解析し、schema.prismaのモデル定義に変換するツールです。PostgreSQL・MySQL・SQLiteの主な型、主キー・一意制約・インデックス、外部キーからのリレーション、ENUM型に対応し、すべてブラウザ内で処理されます。",
      en: "A tool that parses SQL CREATE TABLE statements (DDL) and converts them into schema.prisma model definitions. It supports common PostgreSQL, MySQL, and SQLite types, primary keys, unique constraints, indexes, relations from foreign keys, and ENUM types — all processed in your browser.",
    },
    howToUse: {
      ja: [
        "左側にCREATE TABLE文を貼り付けるか、「ファイルを開く」やドラッグ＆ドロップで .sql ファイル（pg_dumpやmysqldumpの出力など）を読み込みます。",
        "「変換オプション」で、データベースの種類、Prismaの命名規則への変換、ネイティブ型属性の出力、generator・datasourceブロックの出力を選びます。",
        "右側にschema.prismaのモデル定義が表示されます。外部キーからはリレーションフィールドと逆方向のリレーションが自動で生成されます。",
        "警告が表示された場合は内容を確認し、「クリップボードへコピー」または「schema.prisma をダウンロード」で保存します。",
      ],
      en: [
        "Paste CREATE TABLE statements on the left, or load a .sql file (such as pg_dump or mysqldump output) with \"Open file\" or by drag and drop.",
        "Under \"Conversion options\", choose the database type, whether to apply Prisma naming conventions, whether to output native type attributes, and whether to include generator and datasource blocks.",
        "The schema.prisma model definitions appear on the right. Relation fields and their back-relations are generated automatically from foreign keys.",
        "If warnings appear, review them, then save with \"Copy to clipboard\" or \"Download schema.prisma\".",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "既存のデータベースにPrismaを導入する場合、通常は prisma db pull でデータベースに接続してスキーマを取り込みます。しかし、手元にDDLのファイルしかない場合や、本番データベースに接続できない場合、設計段階のテーブル定義からモデルを作りたい場合などもあります。このツールは、CREATE TABLE文だけからschema.prismaのモデル定義を作成します。",
          "カラムの型はPrismaの型（String・Int・BigInt・Decimal・DateTime・Json など）に対応付け、VARCHAR(255) のような長さの指定は @db.VarChar(255) として保持します。PRIMARY KEY は @id / @@id、UNIQUE は @unique / @@unique、CREATE INDEX は @@index、SERIAL や AUTO_INCREMENT は @default(autoincrement())、DEFAULT now() は @default(now()) に変換します。外部キーからは関連するモデル同士のリレーションを生成し、ON DELETE の指定も引き継ぎます。",
          "SQLの解析はブラウザ内の独自パーサーで行っており、入力したテーブル定義がサーバーへ送信されることはありません。ビューやトリガー、関数などのCREATE TABLE以外の文は読み飛ばします。変換結果は prisma validate や prisma format で確認してから利用することをおすすめします。",
        ],
        en: [
          "When adopting Prisma for an existing database, you'd normally connect to it with prisma db pull to import the schema. But sometimes you only have a DDL file, can't connect to the production database, or want to create models from table definitions still in design. This tool builds schema.prisma model definitions from CREATE TABLE statements alone.",
          "Column types are mapped to Prisma types (String, Int, BigInt, Decimal, DateTime, Json, and so on), and length constraints like VARCHAR(255) are kept as @db.VarChar(255). PRIMARY KEY becomes @id / @@id, UNIQUE becomes @unique / @@unique, CREATE INDEX becomes @@index, SERIAL and AUTO_INCREMENT become @default(autoincrement()), and DEFAULT now() becomes @default(now()). Foreign keys produce relations between the related models, including ON DELETE behavior.",
          "SQL is parsed by a custom parser in your browser, and your table definitions are never sent to a server. Statements other than CREATE TABLE — such as views, triggers, and functions — are skipped. We recommend checking the result with prisma validate or prisma format before using it.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "どのデータベースのDDLに対応していますか？",
          en: "Which databases' DDL is supported?",
        },
        answer: {
          ja: "PostgreSQL・MySQL（MariaDB）・SQLiteでよく使われるCREATE TABLEの構文に対応しています。pg_dumpのようにALTER TABLEで後から追加された主キーや外部キーも反映します。",
          en: "Common CREATE TABLE syntax for PostgreSQL, MySQL (MariaDB), and SQLite is supported. Primary keys and foreign keys added later via ALTER TABLE, as in pg_dump output, are also applied.",
        },
      },
      {
        question: {
          ja: "変換できない型はどうなりますか？",
          en: "What happens to types that can't be converted?",
        },
        answer: {
          ja: "PostGISのgeometryのようにPrismaに対応する型がないものは Unsupported(\"型名\") として出力し、警告を表示します。Prismaでは Unsupported 型のカラムはPrisma Clientから読み書きできない点にご注意ください。",
          en: "Types with no Prisma equivalent, such as PostGIS geometry, are output as Unsupported(\"type\") with a warning. Note that Prisma Client can't read or write Unsupported columns.",
        },
      },
      {
        question: {
          ja: "リレーションフィールドの名前はどのように決まりますか？",
          en: "How are relation field names chosen?",
        },
        answer: {
          ja: "外部キーのカラム名から「_id」を除いた名前（author_id → author）を使います。同じテーブル同士に複数のリレーションがある場合や自己参照の場合は、@relation に名前を付けて区別します。",
          en: "The foreign key column name without \"_id\" is used (author_id → author). When two tables have multiple relations between them, or a table references itself, the relations are given names via @relation to tell them apart.",
        },
      },
      {
        question: {
          ja: "入力したSQLはサーバーに送信されますか？",
          en: "Is my SQL sent to a server?",
        },
        answer: {
          ja: "送信されません。SQLの解析とschema.prismaの生成はすべてブラウザ内で行われます。",
          en: "No. Parsing the SQL and generating schema.prisma both happen in your browser.",
        },
      },
    ],
    category: "developer",
    icon: DatabaseZap,
    keywords: {
      ja: "SQL DDL CREATE TABLE Prisma schema.prisma 変換 モデル マイグレーション PostgreSQL MySQL",
      en: "sql ddl create table prisma schema.prisma converter model introspection postgresql mysql sqlite",
    },
    fileMatch: {
      mimeTypes: ["application/sql"],
      extensions: ["sql"],
    },
  },
  {
    id: "mermaid-editor",
    name: { ja: "Mermaid図エディタ（フローチャート・シーケンス図・ER図）", en: "Mermaid Diagram Editor (Flowchart, Sequence, ER)" },
    description: {
      ja: "Mermaid記法でフローチャートやシーケンス図、ER図を書き、リアルタイムにプレビューしてSVG・PNGで保存できます。",
      en: "Write flowcharts, sequence diagrams, and ER diagrams in Mermaid syntax with a live preview, and save them as SVG or PNG.",
    },
    longDescription: {
      ja: "Mermaid記法でフローチャート、シーケンス図、ER図、クラス図、状態遷移図、ガントチャート、マインドマップ、Gitグラフを作成し、リアルタイムにプレビューできるツールです。テーマや背景色の変更、ズーム・パン、SVG・PNG（1x〜3x）での書き出し、URLでの共有に対応し、描画はすべてブラウザ内で行われます。",
      en: "A tool for creating flowcharts, sequence diagrams, ER diagrams, class diagrams, state diagrams, Gantt charts, mind maps, and Git graphs in Mermaid syntax with a live preview. It supports themes and background colors, zoom and pan, export to SVG and PNG (1x–3x), and sharing via URL — all rendered in your browser.",
    },
    howToUse: {
      ja: [
        "「テンプレート」から作りたい図の種類を選ぶと、日本語のサンプルがエディタに入ります。",
        "左のエディタでMermaid記法を編集すると、少し遅れて右のプレビューに反映されます。構文エラーがある場合は行番号付きでエラーが表示され、プレビューには直前の正しい図が残ります。",
        "「テーマ」と「背景色」で見た目を変えます。プレビューはドラッグで移動、Ctrl（⌘）＋ホイールやボタンで拡大・縮小できます。",
        "「SVGをダウンロード」「PNGをダウンロード」で画像として保存します。PNGは1x・2x・3xの解像度を選べます。",
        "「共有リンクをコピー」で、同じ図を開けるURLを取得できます。入力内容は自動で保存され、次回開いたときに復元されます。",
      ],
      en: [
        "Choose a diagram type from \"Template\" to load a sample into the editor.",
        "Edit the Mermaid code in the editor on the left; the preview on the right updates shortly after. Syntax errors are shown with line numbers, and the last valid diagram stays in the preview.",
        "Change the look with \"Theme\" and \"Background\". Drag to pan the preview, and zoom with Ctrl (⌘) + wheel or the buttons.",
        "Save as an image with \"Download SVG\" or \"Download PNG\". PNG can be exported at 1x, 2x, or 3x.",
        "\"Copy share link\" gives you a URL that opens the same diagram. Your input is saved automatically and restored the next time you open the tool.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "Mermaid図エディタは、テキストで図を記述できるMermaid記法を使って、設計書やドキュメントに載せる図を作成するツールです。GitHubやGitLab、Notionなどでも使われている記法のため、作成したソースをそのままMarkdownに貼り付けて使うこともできます。",
          "描画にはMermaid（MIT）を使用し、ユーザーが入力したHTMLやスクリプトが実行されないよう securityLevel を strict に設定しています。日本語のラベルが文字化けしたり見切れたりしないよう日本語フォントを指定し、PNG書き出しで崩れないようラベルはSVGのテキストとして描画しています。",
          "Mermaidのライブラリはこのツールのページを開いたときにだけ読み込まれます。共有リンクは図の内容を圧縮してURLのハッシュ部分（#以降）に入れる仕組みで、ハッシュはサーバーに送信されないため、図の内容が外部に保存されることはありません。",
        ],
        en: [
          "The Mermaid Diagram Editor lets you create diagrams for design documents and docs using Mermaid, a syntax for describing diagrams as text. Because Mermaid is supported on GitHub, GitLab, Notion, and elsewhere, you can paste the source straight into Markdown.",
          "Diagrams are rendered with Mermaid (MIT), with securityLevel set to strict so that HTML or scripts in your input are never executed. A Japanese font is specified so labels don't break or get clipped, and labels are drawn as SVG text so PNG exports render correctly.",
          "The Mermaid library is loaded only when you open this tool. Share links compress the diagram into the URL hash (after #); since the hash is never sent to the server, your diagram is never stored anywhere else.",
        ],
      },
    },
    faq: [
      {
        question: { ja: "作成した図はどこに保存されますか？", en: "Where are my diagrams saved?" },
        answer: {
          ja: "入力内容はこのブラウザ（localStorage）に自動で保存されます。共有リンクを使うと、内容がURLに含まれるため、リンクを知っている人が同じ図を開けます。",
          en: "Your input is saved automatically in this browser (localStorage). With a share link, the content is included in the URL, so anyone with the link can open the same diagram.",
        },
      },
      {
        question: { ja: "PNGで日本語が正しく表示されないことはありますか？", en: "Can Japanese text look wrong in PNG exports?" },
        answer: {
          ja: "PNGは閲覧している端末の日本語フォントを使って描画します。通常は問題ありませんが、日本語フォントがない環境では表示が崩れる場合があります。その場合はSVGで保存してください。",
          en: "PNGs are drawn using the Japanese fonts on your device. This usually works fine, but on a device without Japanese fonts the text may not render correctly; save as SVG instead.",
        },
      },
      {
        question: { ja: "ELKレイアウトは使えますか？", en: "Can I use the ELK layout?" },
        answer: {
          ja: "使えません。ELKレイアウトに必要なライブラリ（elkjs）はライセンス（EPL-2.0）の都合で含めていないため、既定のレイアウトで描画してください。",
          en: "No. The library required for the ELK layout (elkjs) isn't included because of its license (EPL-2.0), so please use the default layout.",
        },
      },
      {
        question: { ja: "入力したスクリプトが実行されることはありますか？", en: "Can scripts in my input be executed?" },
        answer: {
          ja: "ありません。Mermaidの securityLevel を strict に設定しているため、図の中のHTMLタグやクリック時のスクリプトは無効化されます。",
          en: "No. Mermaid's securityLevel is set to strict, so HTML tags and click scripts in diagrams are disabled.",
        },
      },
    ],
    category: "developer",
    icon: Workflow,
    keywords: {
      ja: "mermaid マーメイド 図 フローチャート シーケンス図 er図 クラス図 状態遷移図 ガントチャート マインドマップ svg png 作図",
      en: "mermaid diagram flowchart sequence diagram er diagram class diagram state diagram gantt mindmap svg png",
    },
    fileMatch: {
      extensions: ["mmd", "mermaid"],
    },
  },
  {
    id: "prisma-schema-visualizer",
    name: {
      ja: "Prisma Schema ビジュアルER図ツール",
      en: "Prisma Schema Visualizer",
    },
    description: {
      ja: "schema.prismaのモデルをカード型UIで可視化し、リレーションをひと目で確認できます。",
      en: "Visualize schema.prisma models as cards and see relations between them at a glance.",
    },
    longDescription: {
      ja: "schema.prismaのコードを入力すると、各modelをカード型UIで一覧表示し、フィールド名・型・制約（@id, @unique, オプショナル）と@relationによる参照関係を視覚的に確認できるツールです。モデル名による絞り込みにも対応しています。",
      en: "A tool that takes schema.prisma code and displays each model as a card, letting you visually check field names, types, constraints (@id, @unique, optional), and @relation references between models. It also supports filtering by model name.",
    },
    howToUse: {
      ja: [
        "入力欄にschema.prismaのコードを貼り付けます。「サンプルスキーマを読み込む」で動作を確認することもできます。",
        "各モデルがカードとして一覧表示され、フィールド名・型・「?」（オプショナル）・ユニーク制約・リレーション先が確認できます。",
        "モデル数が多い場合は「モデル名で絞り込み」の検索欄で対象を絞り込めます。",
        "画面下部の「リレーション一覧」では、どのモデルのどのフィールドがどのモデルを参照しているか（1対1・多対1・1対多）を一覧で確認できます。",
      ],
      en: [
        "Paste your schema.prisma code into the input field. You can also try it out with \"Load sample schema\".",
        "Each model is displayed as a card, showing field names, types, the \"?\" optional marker, unique constraints, and relation targets.",
        "If you have many models, narrow them down with the \"Filter by model name\" search field.",
        "The \"Relations\" list at the bottom shows which field of which model references which other model, along with its cardinality (one-to-one / many-to-one / one-to-many).",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "Prisma Schema ビジュアルER図ツールは、テキストベースのschema.prismaを読みやすいカード型UIに変換し、モデル同士の関係性を素早く把握できるようにするツールです。大規模なスキーマの全体像を把握したいときや、レビュー時にモデル構成を説明したいときに活用できます。",
          "各フィールドには、主キーを表す鍵アイコン、ユニーク制約バッジ、オプショナルを表す「?」バッジが表示され、`@relation`が付与されたフィールドやリレーション先モデル名として推測されるフィールドは、矢印付きで参照先のモデル名が示されます。",
          "画面下部の「リレーション一覧」では、スキーマ全体から検出したリレーションを`モデル.フィールド → 参照先モデル`という形式で一覧化し、配列型かどうかに応じて「1対多」「1対1 / 多対1」の目安を表示します。",
        ],
        en: [
          "The Prisma Schema Visualizer converts text-based schema.prisma code into a readable card-based UI, making it easy to quickly grasp the relationships between models. It's useful for understanding the overall shape of a large schema, or for explaining model structure during a review.",
          "Each field shows a key icon for the primary key, a badge for unique constraints, and a \"?\" badge for optional fields. Fields marked with `@relation`, or inferred to reference another model, show an arrow followed by the target model's name.",
          "The \"Relations\" list at the bottom collects every relation detected across the whole schema in the form `Model.field → target model`, and shows an approximate cardinality — \"one-to-many\" or \"one-to-one / many-to-one\" — based on whether the field is a list type.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "リレーションの多重度（1対1・1対多など）はどのように判定されていますか？",
          en: "How is the relation cardinality (one-to-one, one-to-many, etc.) determined?",
        },
        answer: {
          ja: "フィールドが配列型（`Post[]`のように`[]`が付いている）であれば「1対多」、そうでなければ「1対1 / 多対1」として簡易的に表示しています。正確な多対多の判定には双方向のリレーション定義全体を解析する必要があるため、あくまで目安としてご利用ください。",
          en: "If a field is an array type (has \"[]\", like `Post[]`), it's shown as \"one-to-many\"; otherwise it's shown as \"one-to-one / many-to-one\". Accurately detecting many-to-many relations requires analyzing both sides of the relation definition, so treat this as an approximation.",
        },
      },
      {
        question: {
          ja: "Enum（列挙型）は表示されますか？",
          en: "Are enums displayed?",
        },
        answer: {
          ja: "表示されます。スキーマ内に`enum`定義が含まれる場合、モデル一覧の下に「Enum一覧」としてカード表示され、定義されている値の一覧を確認できます。",
          en: "Yes. If the schema contains `enum` definitions, they're shown below the model list under \"Enums\", as cards listing each defined value.",
        },
      },
      {
        question: {
          ja: "複数ファイルに分割されたschema.prismaにも対応していますか？",
          en: "Does it support a schema.prisma split across multiple files?",
        },
        answer: {
          ja: "入力欄に貼り付けたテキストのみを解析対象としています。複数ファイルに分割している場合は、それぞれの内容を1つのテキストにまとめてから貼り付けてください。",
          en: "Only the text pasted into the input field is analyzed. If your schema is split across multiple files, combine their contents into a single block of text before pasting it in.",
        },
      },
      {
        question: {
          ja: "入力したスキーマはサーバーに送信されますか？",
          en: "Is my input schema sent to a server?",
        },
        answer: {
          ja: "送信されません。スキーマの解析とカードの表示は、すべてブラウザ内のJavaScriptで完結します。",
          en: "No. Parsing the schema and rendering the cards both happen entirely with JavaScript in your browser.",
        },
      },
    ],
    category: "developer",
    icon: Waypoints,
    keywords: {
      ja: "prisma schema er図 可視化 リレーション データモデル",
      en: "prisma schema er diagram visualizer relation data model",
    },
  },
  {
    id: "prisma-zod-generator",
    name: { ja: "Prisma→Zodスキーマ生成", en: "Prisma to Zod Schema Generator" },
    description: {
      ja: "schema.prismaのmodel・enumから、Zodのバリデーションスキーマと型定義を生成します。",
      en: "Generate Zod validation schemas and types from the models and enums in schema.prisma.",
    },
    longDescription: {
      ja: "schema.prismaのmodel・enum定義を解析し、Zodのバリデーションスキーマ（z.object・z.enum）とz.inferによる型定義を生成するツールです。作成用スキーマの出力や、DateTimeのz.coerce.date()への変換にも対応し、すべてブラウザ内で処理されます。",
      en: "A tool that parses the model and enum definitions in schema.prisma and generates Zod validation schemas (z.object, z.enum) along with z.infer types. It can also output create schemas and use z.coerce.date() for DateTime, all within your browser.",
    },
    howToUse: {
      ja: [
        "左側にschema.prismaの内容を貼り付けるか、「ファイルを開く」やドラッグ＆ドロップでschema.prismaを読み込みます。「サンプルを読み込む」で動作を試すこともできます。",
        "すべてのmodel・enumについて、Zodスキーマが右側に自動で生成されます。",
        "「生成オプション」で、作成用スキーマの有無、DateTimeの扱い、型定義のエクスポートを切り替えます。",
        "「クリップボードへコピー」または「schemas.ts をダウンロード」で生成結果を保存し、プロジェクトに追加します（zodパッケージが必要です）。",
      ],
      en: [
        "Paste your schema.prisma on the left, or load it with \"Open file\" or by drag and drop. You can also try it out with \"Load sample\".",
        "Zod schemas for every model and enum are generated automatically on the right.",
        "Under \"Options\", toggle create schemas, how DateTime is handled, and type exports.",
        "Save the result with \"Copy to clipboard\" or \"Download schemas.ts\" and add it to your project (requires the zod package).",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "Zodは、TypeScriptでよく使われるスキーマ宣言・バリデーションライブラリです。APIのリクエストやフォームの入力を検証する際、Prismaで定義したデータベースのモデルと同じ構造のZodスキーマを手で書くのは手間がかかり、モデルの変更に追従し忘れる原因にもなります。このツールはschema.prismaからZodスキーマを自動で生成します。",
          "Prismaの型は、String→z.string()、Int→z.number().int()、DateTime→z.date()、enum→z.enum() のように対応付けます。@db.VarChar(255) のような長さの指定は .max(255) に、null許容のフィールド（String?）は .nullable() になります。「作成用スキーマ」では、@default や @updatedAt でデータベースが値を補うフィールドを省略可能にしたスキーマも生成します。",
          "リレーションフィールド（他のモデルへの参照）は循環参照を避けるために出力から除外し、外部キーのフィールドのみを含めます。schema.prismaの解析には、Prisma Repositoryコード生成器などと共通のパーサーを使用しています。入力内容がサーバーへ送信されることはありません。",
        ],
        en: [
          "Zod is a popular schema declaration and validation library for TypeScript. When validating API requests or form input, hand-writing Zod schemas that mirror your Prisma database models is tedious and easy to forget to update when the models change. This tool generates Zod schemas from schema.prisma automatically.",
          "Prisma types are mapped as String → z.string(), Int → z.number().int(), DateTime → z.date(), and enum → z.enum(). Length constraints like @db.VarChar(255) become .max(255), and nullable fields (String?) become .nullable(). The create schema option also outputs schemas where fields filled in by the database via @default or @updatedAt are optional.",
          "Relation fields (references to other models) are left out to avoid circular references; only foreign key fields are included. schema.prisma is parsed with the same parser used by the Prisma Repository Code Generator and other Prisma tools. Nothing you enter is sent to a server.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "生成したコードを使うには何が必要ですか？",
          en: "What do I need to use the generated code?",
        },
        answer: {
          ja: "プロジェクトにzodパッケージをインストールしてください（npm install zod）。生成されるコードはZod 3・Zod 4のどちらでも利用できる書き方にしています。",
          en: "Install the zod package in your project (npm install zod). The generated code is written to work with both Zod 3 and Zod 4.",
        },
      },
      {
        question: {
          ja: "リレーションフィールドを含めることはできますか？",
          en: "Can relation fields be included?",
        },
        answer: {
          ja: "モデル同士が互いを参照する循環参照になりやすく、型推論が破綻するため出力していません。必要な場合は、生成したスキーマを .extend() で拡張してください。",
          en: "They're left out because models often reference each other, creating circular references that break type inference. If you need them, extend the generated schema with .extend().",
        },
      },
      {
        question: {
          ja: "Decimal型やJson型はどのように変換されますか？",
          en: "How are Decimal and Json converted?",
        },
        answer: {
          ja: "DecimalはAPIでの扱いやすさを優先して z.number() に、Jsonは任意の値を受け付ける z.unknown() に変換します。用途に合わせて調整してください。",
          en: "Decimal becomes z.number() for ease of use in APIs, and Json becomes z.unknown(), which accepts any value. Adjust them to suit your needs.",
        },
      },
      {
        question: {
          ja: "入力したスキーマはサーバーに送信されますか？",
          en: "Is my schema sent to a server?",
        },
        answer: {
          ja: "送信されません。解析とコード生成はすべてブラウザ内で行われます。",
          en: "No. Parsing and code generation both happen in your browser.",
        },
      },
    ],
    category: "developer",
    icon: ShieldCheck,
    keywords: {
      ja: "Prisma Zod スキーマ 生成 バリデーション schema.prisma TypeScript 型 変換",
      en: "prisma zod schema generator validation schema.prisma typescript types convert",
    },
    fileMatch: {
      extensions: ["prisma"],
    },
  },
  {
    id: "prisma-repo-generator",
    name: {
      ja: "Prisma Repositoryコード生成器",
      en: "Prisma Repository Code Generator",
    },
    description: {
      ja: "schema.prismaのモデル定義からRepositoryインターフェース・実装クラス・利用例を自動生成します。",
      en: "Generate a repository interface, implementation class, and usage example from a schema.prisma model.",
    },
    longDescription: {
      ja: "schema.prismaのmodel定義を貼り付けるだけで、Repositoryインターフェース定義・PrismaClientを利用した実装クラス・Expressコントローラーでの利用例（依存性注入パターン）の3点セットをブラウザ内で自動生成するツールです。クラス命名ルールやasync/await、戻り値の型付与を切り替えられます。",
      en: "A tool that generates a repository interface, a PrismaClient-based implementation class, and an Express controller usage example (dependency injection pattern) from a pasted schema.prisma model, right in your browser. You can toggle the class naming style, async/await usage, and explicit return types.",
    },
    howToUse: {
      ja: [
        "入力欄にschema.prismaのmodel定義を貼り付けます。「サンプルモデルを読み込む」で動作を確認することもできます。",
        "複数のモデルが含まれる場合は「対象モデル」のドロップダウンから生成対象を選択します。",
        "「生成オプション」でクラス命名ルール（Iプレフィックス／Interfaceサフィックス）、async/awaitの使用、戻り値の型付与を切り替えます。",
        "「①Repositoryインターフェース」「②PrismaClient実装クラス」「③Express利用例」のタブを切り替えながら、それぞれのコードを確認・コピーできます。",
      ],
      en: [
        "Paste a schema.prisma model definition into the input field. You can also try it out with \"Load sample model\".",
        "If multiple models are found, choose the one to generate code for from the \"Target model\" dropdown.",
        "Use \"Generation options\" to toggle the class naming style (I-prefix or Interface-suffix), whether to use async/await, and whether to include explicit return types.",
        "Switch between the \"① Repository interface\", \"② PrismaClient implementation\", and \"③ Express usage example\" tabs to review and copy each piece of code.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "Prisma Repositoryコード生成器は、schema.prismaに書かれたmodel定義から、データアクセス層でよく使われるRepositoryパターンのコード一式を自動生成するツールです。新しいモデルを追加するたびに手作業でCRUD処理を書く手間を省き、チームでのコーディング規約の統一にも役立ちます。",
          "生成されるインターフェース・実装クラスは、Prismaが自動生成する`Prisma.XxxCreateInput`や`Prisma.XxxUpdateInput`といった型をそのまま利用するため、スキーマの変更にも追従しやすく、実際のプロジェクトにそのまま組み込みやすい形になっています。PrismaClientはコンストラクタ経由で注入する依存性注入（DI）パターンを採用しており、テスト時にはモック実装に差し替えることができます。",
          "モデルの主キー（`@id`が付与されたフィールド、なければ`id`という名前のフィールド）を自動的に検出し、`findUnique`や`update`・`delete`の引数の型に反映します。Express用のコントローラー例では、Repositoryをrouter生成関数に引数として渡せるようにしており、単体テスト時にモックRepositoryへ差し替えやすい設計になっています。",
        ],
        en: [
          "The Prisma Repository Code Generator automatically generates a full set of repository-pattern code — commonly used in the data access layer — from a model definition written in schema.prisma. It saves you the manual work of writing CRUD logic every time you add a new model, and helps teams keep their coding conventions consistent.",
          "The generated interface and implementation use Prisma's own generated types, such as `Prisma.XxxCreateInput` and `Prisma.XxxUpdateInput`, directly. This makes it easy to keep up with schema changes and drop the generated code straight into a real project. PrismaClient is injected through the constructor (a dependency injection pattern), so it can be swapped for a mock implementation in tests.",
          "The model's primary key (a field marked `@id`, or a field named `id` if none is marked) is detected automatically and used for the argument types of `findUnique`, `update`, and `delete`. In the Express controller example, the repository is passed as an argument to a router factory function, making it easy to swap in a mock repository for unit tests.",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "生成されたコードはそのままプロジェクトで使えますか？",
          en: "Can I use the generated code directly in my project?",
        },
        answer: {
          ja: "`@prisma/client`が生成済みで、`PrismaClient`と対象モデルの型（例: `User`, `Prisma.UserCreateInput`）が利用可能なプロジェクトであれば、そのまま貼り付けて利用できます。ファイル名やディレクトリ構成は必要に応じて調整してください。",
          en: "Yes, as long as your project has already generated `@prisma/client` and has the model's types available (e.g. `User`, `Prisma.UserCreateInput`), you can paste the code in directly. Adjust file names and directory structure as needed for your project.",
        },
      },
      {
        question: {
          ja: "複数のモデルをまとめて生成できますか？",
          en: "Can I generate code for multiple models at once?",
        },
        answer: {
          ja: "入力欄には複数のmodel定義を貼り付けられますが、コードは一度に1モデル分ずつ生成されます。複数のモデルが検出された場合は「対象モデル」のドロップダウンで生成したいモデルを切り替えてください。",
          en: "You can paste multiple model definitions into the input field, but code is generated for one model at a time. If multiple models are detected, switch between them using the \"Target model\" dropdown.",
        },
      },
      {
        question: {
          ja: "リレーション（他モデルへの参照）フィールドはどう扱われますか？",
          en: "How are relation fields (references to other models) handled?",
        },
        answer: {
          ja: "生成される`create`・`update`メソッドの引数にはPrismaが自動生成する`Prisma.XxxCreateInput`・`Prisma.XxxUpdateInput`型をそのまま使用しているため、ネストしたリレーションの作成・更新も型定義上サポートされます。個別のフィールドを手動で組み立てる必要はありません。",
          en: "Since the generated `create` and `update` method arguments use Prisma's own generated `Prisma.XxxCreateInput` and `Prisma.XxxUpdateInput` types directly, creating and updating nested relations is supported at the type level too — there's no need to manually assemble individual fields.",
        },
      },
      {
        question: {
          ja: "入力したスキーマはサーバーに送信されますか？",
          en: "Is my input schema sent to a server?",
        },
        answer: {
          ja: "送信されません。スキーマの解析とコード生成は、すべてブラウザ内のJavaScriptで完結します。",
          en: "No. Parsing the schema and generating code both happen entirely with JavaScript in your browser.",
        },
      },
    ],
    category: "developer",
    icon: Layers,
    keywords: {
      ja: "prisma repository コード生成 デザインパターン typescript express di",
      en: "prisma repository code generator design pattern typescript express dependency injection",
    },
  },
  {
    id: "mock-repo-generator",
    name: {
      ja: "モックデータ・テストコード生成器",
      en: "Mock Data & Test Code Generator",
    },
    description: {
      ja: "TypeScript型やPrismaモデルからダミーデータ・MockRepository・テストコードを生成します。",
      en: "Generate dummy data, a MockRepository class, and test code from a TypeScript type or Prisma model.",
    },
    longDescription: {
      ja: "TypeScriptのinterfaceまたはPrismaのmodel定義を貼り付けると、ダミーデータ（JSON配列）・DBに接続せず動作するMockRepositoryクラス・Vitest/Jest用のテストコードの3点セットをブラウザ内で自動生成するツールです。",
      en: "A tool that generates dummy data (a JSON array), a MockRepository class that works without a database connection, and Vitest/Jest test code, all from a pasted TypeScript interface or Prisma model — right in your browser.",
    },
    howToUse: {
      ja: [
        "入力欄にTypeScriptの`interface`またはPrismaの`model`定義を貼り付けます。「サンプルを読み込む」で動作を確認することもできます。",
        "入力内容から自動的にPrismaモデル／TypeScriptインターフェースのどちらかが判定されます。複数の型が含まれる場合は「対象の型」から選択してください。",
        "「生成オプション」で生成件数（1〜20件）とテストフレームワーク（Vitest / Jest）を選びます。",
        "「①ダミーデータ」「②MockRepositoryクラス」「③テストコード」のタブを切り替えながら、それぞれの内容を確認・コピーできます。",
      ],
      en: [
        "Paste a TypeScript `interface` or a Prisma `model` definition into the input field. You can also try it out with \"Load sample\".",
        "Whether it's a Prisma model or a TypeScript interface is detected automatically. If multiple types are found, choose one from \"Target type\".",
        "Use \"Generation options\" to choose the number of records to generate (1–20) and the test framework (Vitest or Jest).",
        "Switch between the \"① Dummy data\", \"② MockRepository class\", and \"③ Test code\" tabs to review and copy each piece of code.",
      ],
    },
    about: {
      paragraphs: {
        ja: [
          "モックデータ・テストコード生成器は、TypeScriptの型定義やPrismaのモデル定義から、開発・テストで役立つダミーデータとモック実装、テストコードをまとめて生成できるツールです。バックエンドAPIの実装前にフロントエンドの開発を進めたい場合や、DBに依存しない単体テストを素早く書きたい場合に活用できます。",
          "フィールド名や型からそれらしいダミー値を推測して生成しており、例えば`email`を含むフィールド名文字列型には`user1@example.com`のような値を、`Date`型のフィールドには日付が1日ずつ進むISO形式の文字列を割り当てます。Prismaのモデルを入力した場合、他モデルへの参照（リレーション）フィールドは自動的に除外されます。",
          "生成される`MockRepository`クラスは`findUnique`・`findMany`・`create`・`update`・`delete`をメモリ内の配列操作で模倣する非同期メソッドとして実装されており、テストコードはRepositoryを引数として受け取るExpressコントローラーのファクトリ関数（依存性注入パターン）を呼び出す形で構成されています。",
        ],
        en: [
          "The Mock Data & Test Code Generator produces dummy data, a mock implementation, and test code — all useful for development and testing — from a TypeScript type definition or a Prisma model definition. It's handy when you want to build out the frontend before the backend API is ready, or quickly write database-independent unit tests.",
          "Dummy values are inferred from field names and types — for example, a string field whose name contains \"email\" gets a value like `user1@example.com`, and a `Date` field gets an ISO-formatted string with the date advancing by one day per record. When a Prisma model is used as input, fields that reference other models (relations) are automatically excluded.",
          "The generated `MockRepository` class implements `findUnique`, `findMany`, `create`, `update`, and `delete` as async methods that operate on an in-memory array, and the generated test code is structured around calling an Express controller factory function that takes the repository as an argument (a dependency injection pattern).",
        ],
      },
    },
    faq: [
      {
        question: {
          ja: "TypeScriptとPrismaのどちらの入力にも対応していますか？",
          en: "Does it support both TypeScript and Prisma input?",
        },
        answer: {
          ja: "対応しています。入力に「interface 名前 { ... }」が含まれていればTypeScriptインターフェースとして、「model 名前 { ... }」が含まれていればPrismaモデルとして自動的に判定して処理します。",
          en: "Yes. If the input contains \"interface Name { ... }\", it's treated as a TypeScript interface; if it contains \"model Name { ... }\", it's treated as a Prisma model — the detection is automatic.",
        },
      },
      {
        question: {
          ja: "生成されたダミー値の内容を細かく調整できますか？",
          en: "Can I fine-tune the generated dummy values?",
        },
        answer: {
          ja: "本ツールはフィールド名・型からそれらしい値を自動生成するのみで、値そのものを個別に編集するUIはありません。生成されたJSON・コードをコピーした後、お手元のエディタで調整してください。",
          en: "This tool only auto-generates plausible values based on field names and types — there's no UI for editing individual values. Copy the generated JSON or code and adjust it in your own editor afterward.",
        },
      },
      {
        question: {
          ja: "生成されたテストコードはそのまま実行できますか？",
          en: "Can I run the generated test code as-is?",
        },
        answer: {
          ja: "テストコードは、Repositoryを引数として受け取るExpressルーターのファクトリ関数（`create○○Router(repository)`）が存在することを前提としています。お手元のプロジェクトのコントローラー実装に合わせて、インポートパスや関数名を調整してから実行してください。",
          en: "The test code assumes the existence of an Express router factory function that takes a repository as an argument (`create<Name>Router(repository)`). Adjust the import paths and function names to match your project's actual controller implementation before running it.",
        },
      },
      {
        question: {
          ja: "入力したコードはサーバーに送信されますか？",
          en: "Is my input code sent to a server?",
        },
        answer: {
          ja: "送信されません。型の解析、ダミーデータの生成、コードの組み立てはすべてブラウザ内のJavaScriptで完結します。",
          en: "No. Parsing the type, generating dummy data, and assembling the code all happen entirely with JavaScript in your browser.",
        },
      },
    ],
    category: "developer",
    icon: FlaskConical,
    keywords: {
      ja: "モックデータ mock repository テストコード vitest jest ダミーデータ typescript prisma",
      en: "mock data mock repository test code vitest jest dummy data typescript prisma",
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

function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  if (index <= 0 || index === fileName.length - 1) return "";
  return fileName.slice(index + 1).toLowerCase();
}

export function toolMatchesFile(
  tool: Tool,
  file: { name: string; type: string }
): boolean {
  const match = tool.fileMatch;
  if (!match) return false;
  if (match.any) return true;

  const mimeType = file.type.toLowerCase();
  if (mimeType) {
    if (match.mimeTypes?.includes(mimeType)) return true;
    if (match.mimePrefixes?.some((prefix) => mimeType.startsWith(prefix))) {
      return true;
    }
  }

  const extension = getFileExtension(file.name);
  if (extension && match.extensions?.includes(extension)) return true;

  return false;
}

/** ドロップされたファイルを対象とするツールを一覧で返す（具体的な一致が優先） */
export function getToolsForFile(file: { name: string; type: string }): Tool[] {
  const matched = tools.filter((tool) => toolMatchesFile(tool, file));
  return matched.sort((a, b) => {
    const aIsGeneric = a.fileMatch?.any ? 1 : 0;
    const bIsGeneric = b.fileMatch?.any ? 1 : 0;
    return aIsGeneric - bIsGeneric;
  });
}
