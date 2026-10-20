# ClientKit SEO監査

調査日: 2026-10-20。Search Consoleの件数は依頼時の情報であり、具体的な未登録URLは提供されていない。審査不合格の原因を確定する情報ではなく、リポジトリで確認できる問題を改善する。

## 構成と改善計画

- Next.js 16.3.5 App Router、`output: export`。Cloudflare Workers Static Assets向けの`wrangler.jsonc`がある。
- `src/config/tools.ts`にツール・カテゴリ・日英本文を集約。`src/app/[lang]/tools/[tool]/page.tsx`から日英ページを静的生成。
- 言語は`ja`/`en`。`/`はブラウザ言語を見てJSで遷移。`[lang]/layout.tsx`のhreflangが全ツールでホームを指し、ツール・ホーム・更新履歴のcanonicalが欠落。
- sitemapはホーム・更新履歴・プライバシーポリシー・全ツールを出力。更新日時を毎ビルド生成しており、実際の更新と一致しない。
- robotsは全体許可。フッターには更新履歴とプライバシーしかない。トップの初期カテゴリ画面では全ツールの直接リンクが保証されない。
- 広告スクリプトは既存のまま維持する。新規ツールは追加しない。

実施順: ①改善前本文監査を保存 ②A:既存説明を活かして実装に即した例・制限・解説を日英全ツールへ追加 ③B:信頼性ページ ④C:正規URLと実クロール検証 ⑤D:カテゴリと関連ツールのテキストリンク ⑥全検証結果を追記。改善単位でコミットする。

## 改善前の本文計測

計測対象: 62ツール × 2言語。使い方・解説・FAQの可視テキストを対象とし、ナビ・UIラベル・JSON-LDは除外。文字数は空白を除くUnicodeコードポイント数。基準は日本語600字以上、英語200語以上（内容の同等性は実装との照合で別途確認）。600〜1200字は目安とし、有用な既存説明は削らない。独自本文は他ツールと完全一致しない解説段落の有無。類似度は同一言語の全組合せで、記号・空白除去後の文字5-gram Dice係数、上限0.55。

| URL | 本文字数 | 英語語数 | 独自解説 | FAQ数 |
| --- | ---: | ---: | --- | ---: |
| /ja/tools/character-count | 847 | — | あり | 4 |
| /ja/tools/text-diff | 963 | — | あり | 4 |
| /ja/tools/unicode-inspector | 819 | — | あり | 3 |
| /ja/tools/text-normalizer | 1229 | — | あり | 4 |
| /ja/tools/base64 | 810 | — | あり | 4 |
| /ja/tools/url-encoder | 1119 | — | あり | 4 |
| /ja/tools/json-formatter | 917 | — | あり | 4 |
| /ja/tools/data-format-converter | 1077 | — | あり | 4 |
| /ja/tools/csv-json-converter | 963 | — | あり | 4 |
| /ja/tools/csv-editor | 1003 | — | あり | 4 |
| /ja/tools/excel-converter | 1164 | — | あり | 4 |
| /ja/tools/markdown-editor | 1275 | — | あり | 4 |
| /ja/tools/timestamp-converter | 990 | — | あり | 4 |
| /ja/tools/color-converter | 1054 | — | あり | 4 |
| /ja/tools/image-converter | 1094 | — | あり | 4 |
| /ja/tools/screenshot-editor | 1226 | — | あり | 4 |
| /ja/tools/ocr | 1063 | — | あり | 4 |
| /ja/tools/video-converter | 1189 | — | あり | 4 |
| /ja/tools/background-remover | 1065 | — | あり | 4 |
| /ja/tools/exif-remover | 1031 | — | あり | 4 |
| /ja/tools/svg-optimizer | 993 | — | あり | 4 |
| /ja/tools/favicon-generator | 1090 | — | あり | 4 |
| /ja/tools/qr-code | 995 | — | あり | 4 |
| /ja/tools/pdf-toolkit | 1109 | — | あり | 4 |
| /ja/tools/invoice-generator | 1289 | — | あり | 4 |
| /ja/tools/regex-tester | 930 | — | あり | 4 |
| /ja/tools/jsonpath-tester | 1059 | — | あり | 4 |
| /ja/tools/json-diff | 650 | — | あり | 3 |
| /ja/tools/json-schema-validator | 791 | — | あり | 3 |
| /ja/tools/json-schema-generator | 796 | — | あり | 3 |
| /ja/tools/i18n-placeholder-checker | 765 | — | あり | 3 |
| /ja/tools/hash-generator | 1403 | — | あり | 5 |
| /ja/tools/password-hash | 1365 | — | あり | 4 |
| /ja/tools/jwt-decoder | 1072 | — | あり | 4 |
| /ja/tools/certificate-decoder | 1051 | — | あり | 4 |
| /ja/tools/uuid-generator | 561 | — | あり | 2 |
| /ja/tools/id-generator | 1124 | — | あり | 4 |
| /ja/tools/har-analyzer | 1300 | — | あり | 4 |
| /ja/tools/curl-converter | 1343 | — | あり | 4 |
| /ja/tools/openapi-compat | 841 | — | あり | 3 |
| /ja/tools/robots-txt-tester | 748 | — | あり | 3 |
| /ja/tools/cidr-calculator | 714 | — | あり | 3 |
| /ja/tools/log-masker | 1270 | — | あり | 4 |
| /ja/tools/chmod-calculator | 654 | — | あり | 3 |
| /ja/tools/env-compare | 734 | — | あり | 3 |
| /ja/tools/folder-tree | 1052 | — | あり | 4 |
| /ja/tools/gitignore-tester | 807 | — | あり | 3 |
| /ja/tools/semver-range | 825 | — | あり | 3 |
| /ja/tools/csv-reconcile | 771 | — | あり | 3 |
| /ja/tools/image-diff | 706 | — | あり | 3 |
| /ja/tools/cron-explainer | 1063 | — | あり | 4 |
| /ja/tools/sql-formatter | 957 | — | あり | 4 |
| /ja/tools/sql-insert-generator | 895 | — | あり | 3 |
| /ja/tools/pg-explain-viewer | 871 | — | あり | 3 |
| /ja/tools/code-formatter | 1189 | — | あり | 4 |
| /ja/tools/source-map-resolver | 793 | — | あり | 3 |
| /ja/tools/sql-to-prisma | 1403 | — | あり | 4 |
| /ja/tools/mermaid-editor | 1121 | — | あり | 4 |
| /ja/tools/prisma-schema-visualizer | 1032 | — | あり | 4 |
| /ja/tools/prisma-zod-generator | 1183 | — | あり | 4 |
| /ja/tools/prisma-repo-generator | 1382 | — | あり | 4 |
| /ja/tools/mock-repo-generator | 1304 | — | あり | 4 |
| /en/tools/character-count | 1542 | 307 | あり | 4 |
| /en/tools/text-diff | 1681 | 336 | あり | 4 |
| /en/tools/unicode-inspector | 1538 | 278 | あり | 3 |
| /en/tools/text-normalizer | 2291 | 417 | あり | 4 |
| /en/tools/base64 | 1249 | 235 | あり | 4 |
| /en/tools/url-encoder | 1716 | 335 | あり | 4 |
| /en/tools/json-formatter | 1556 | 299 | あり | 4 |
| /en/tools/data-format-converter | 1655 | 345 | あり | 4 |
| /en/tools/csv-json-converter | 1611 | 348 | あり | 4 |
| /en/tools/csv-editor | 1711 | 384 | あり | 4 |
| /en/tools/excel-converter | 1824 | 384 | あり | 4 |
| /en/tools/markdown-editor | 1785 | 347 | あり | 4 |
| /en/tools/timestamp-converter | 1701 | 356 | あり | 4 |
| /en/tools/color-converter | 1733 | 351 | あり | 4 |
| /en/tools/image-converter | 1837 | 355 | あり | 4 |
| /en/tools/screenshot-editor | 2149 | 431 | あり | 4 |
| /en/tools/ocr | 1756 | 345 | あり | 4 |
| /en/tools/video-converter | 1849 | 375 | あり | 4 |
| /en/tools/background-remover | 1954 | 387 | あり | 4 |
| /en/tools/exif-remover | 1670 | 335 | あり | 4 |
| /en/tools/svg-optimizer | 1619 | 313 | あり | 4 |
| /en/tools/favicon-generator | 1717 | 345 | あり | 4 |
| /en/tools/qr-code | 1563 | 351 | あり | 4 |
| /en/tools/pdf-toolkit | 1906 | 385 | あり | 4 |
| /en/tools/invoice-generator | 2330 | 452 | あり | 4 |
| /en/tools/regex-tester | 1520 | 313 | あり | 4 |
| /en/tools/jsonpath-tester | 1614 | 310 | あり | 4 |
| /en/tools/json-diff | 1077 | 227 | あり | 3 |
| /en/tools/json-schema-validator | 1283 | 254 | あり | 3 |
| /en/tools/json-schema-generator | 1170 | 233 | あり | 3 |
| /en/tools/i18n-placeholder-checker | 1287 | 252 | あり | 3 |
| /en/tools/hash-generator | 2082 | 408 | あり | 5 |
| /en/tools/password-hash | 2062 | 403 | あり | 4 |
| /en/tools/jwt-decoder | 1656 | 325 | あり | 4 |
| /en/tools/certificate-decoder | 1835 | 344 | あり | 4 |
| /en/tools/uuid-generator | 935 | 200 | あり | 2 |
| /en/tools/id-generator | 1917 | 383 | あり | 4 |
| /en/tools/har-analyzer | 2136 | 417 | あり | 4 |
| /en/tools/curl-converter | 2001 | 382 | あり | 4 |
| /en/tools/openapi-compat | 1364 | 253 | あり | 3 |
| /en/tools/robots-txt-tester | 1113 | 241 | あり | 3 |
| /en/tools/cidr-calculator | 1029 | 213 | あり | 3 |
| /en/tools/log-masker | 2003 | 398 | あり | 4 |
| /en/tools/chmod-calculator | 1031 | 217 | あり | 3 |
| /en/tools/env-compare | 1380 | 282 | あり | 3 |
| /en/tools/folder-tree | 1636 | 339 | あり | 4 |
| /en/tools/gitignore-tester | 1223 | 249 | あり | 3 |
| /en/tools/semver-range | 1181 | 263 | あり | 3 |
| /en/tools/csv-reconcile | 1456 | 320 | あり | 3 |
| /en/tools/image-diff | 1224 | 241 | あり | 3 |
| /en/tools/cron-explainer | 1643 | 337 | あり | 4 |
| /en/tools/sql-formatter | 1608 | 303 | あり | 4 |
| /en/tools/sql-insert-generator | 1491 | 311 | あり | 3 |
| /en/tools/pg-explain-viewer | 1389 | 285 | あり | 3 |
| /en/tools/code-formatter | 1878 | 363 | あり | 4 |
| /en/tools/source-map-resolver | 1251 | 253 | あり | 3 |
| /en/tools/sql-to-prisma | 2091 | 387 | あり | 4 |
| /en/tools/mermaid-editor | 1711 | 362 | あり | 4 |
| /en/tools/prisma-schema-visualizer | 1812 | 335 | あり | 4 |
| /en/tools/prisma-zod-generator | 1677 | 333 | あり | 4 |
| /en/tools/prisma-repo-generator | 2229 | 416 | あり | 4 |
| /en/tools/mock-repo-generator | 2085 | 391 | あり | 4 |

最も類似する組: en: csv-json-converter / csv-editor = 0.400; en: uuid-generator / id-generator = 0.362; ja: csv-json-converter / csv-editor = 0.323; en: prisma-repo-generator / mock-repo-generator = 0.318; ja: uuid-generator / id-generator = 0.314。

基準未達: 2件。
- ja/uuid-generator: 本文・FAQ基準未達 (561字/30語)
- en/uuid-generator: 本文・FAQ基準未達 (935字/200語)

## B: 信頼性ページの整備

日英のAbout・運営者情報・お問い合わせ・利用規約を追加し、プライバシーポリシーを更新。全ローカライズページのフッターに5種類の情報ページを掲載。問い合わせは実在する公開GitHub Issuesと、確定待ちの非公開メールを明確に区別する。個人情報は`TODO_OPERATOR_NAME`、`TODO_OPERATOR_EMAIL`、`TODO_OPERATOR_ADDRESS`のみ。広告コードは変更していない。

実装上確認したlocalStorage（請求書入力、Mermaidソース、設定・利用履歴）とモデルキャッシュ、静的資産の取得、外部画像を説明。配信環境での解析の有効化状況をリポジトリから断定しない。Google広告のCookie等の説明は[AdSense必須コンテンツ](https://support.google.com/adsense/answer/1348695?hl=en)を参照。

検証: `npm run build`成功、`npm test`29ファイル336テスト成功、`npm run lint`成功。本文の全体基準とクロールはA/C/D統合後に再検証する。

## A: ツール本文の改善とUUID専用ページの統合

全61ツール（日英122ページ）に、ツール固有の具体的な入力・出力例と、実装を確認した制限・結果の読み方を追加。既存の操作手順と3〜5件のFAQを活かし、長い説明を文字数だけのために削らない。入出力例は各lib関数で可能な範囲を照合し、画像・PDF等は処理経路と設定を確認した。

既存本文の誤りも修正: UTF-16での文字数、JPEG/WebP再圧縮、OCR等の再取得、背景除去のWebGPU/JSPI条件、JWT署名の表示と検証鍵、HARの1秒以上の判定、証明書の残り日数・自己発行表示、cronのタイムゾーン解釈、TAR.GZの解凍走査、生成RepositoryのURLパラメーター変換。SQLの1行化は文字列リテラルを識別しない既存の簡易処理であり、コメント記号・連続空白を含むリテラルには使わない制限を日英FAQへ明記した。Markdownの外部画像は表示先への通信が起こる点を明記。

ユーザーの追加承認により`/ja/tools/uuid-generator`と`/en/tools/uuid-generator`は削除し、既存の`id-generator`へ301で統合。UUID v4/v7生成機能はID生成ページに残す。検索語「UUID生成」も統合先へ対応させた。追加した`public/_redirects`は静的資産配信時の旧URL転送、配信Workerでも同じ統合先を使用する。

検証: `npm test`34ファイル351テスト成功、`npm run lint`成功、`npm run build`成功。`node scripts/seo/content-audit.mjs`は122ページ未達0件、最大類似度0.400（上限0.55）。HTTP検証で本文も実HTMLに存在することを確認。広告コードは変更していない。
