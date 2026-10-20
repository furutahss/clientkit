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

検証: `npm test`34ファイル351テスト成功、`npm run lint`成功、`npm run build`成功。`node scripts/seo/content-audit.mjs`は122ページ未達0件、最大類似度0.361（上限0.55）。HTTP検証で本文も実HTMLに存在することを確認。広告コードは変更していない。

## C: URL・インデックス・リンク検証

正規形を`https://clientkit.dev/{ja|en}/...`（wwwなし・末尾スラッシュなし）へ統一。言語版は別々の正規ページとし、各ページは自分自身をcanonicalに指定、同じ内容のja/enと日本語のx-defaultを相互指定する。検索・お気に入り等のホームのクエリURLはホームcanonicalへ集約。

sitemapは登録済みツールと公開情報ページだけから生成し、各URLの言語対応も記載する。ルート`/`・旧UUIDページ・404・noindexは含めない。根拠のない毎ビルドのlastModifiedを削除。robotsはクロール許可と正規sitemapの指定を確認した。

静的エクスポートではNext.jsのリダイレクト設定は実行されないため、Cloudflare WorkerでHTTP/HTTPS・www・末尾スラッシュ・index.html・.html・ルート・旧UUIDを正規化する。`wrangler.jsonc`は両方のCustom Domainを明示し、Workerを通してASSETSを配信する。ローカル実行は`dev.host`を明示して本番ホストへの転送と分ける。[Cloudflare HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)、[Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)、[静的資産のredirects](https://developers.cloudflare.com/workers/static-assets/redirects/)を参照した。

検証: 実Cloudflareローカル実行環境で136 sitemap URLがすべて200、内部リンク先142件で404・リダイレクト経由0件。旧URL等131件は正しい301。アンカー、canonical、hreflang、meta description、noindex除外を確認。`npm test`351テスト成功、lint・本番ビルド成功、`wrangler deploy --dry-run`成功。本番のDNS/TLSや既存のCloudflareルールはローカルでは検証できないため、実デプロイ後の手順を下記に残す。実デプロイは行っていない。

## D: 内部構造

ホームにサーバー描画のカテゴリ別全ツール一覧を設け、検索・JavaScriptの実行に依存せず全ツールへテキストリンクで到達可能にした。カテゴリカードは同じページ内の一覧見出しへ直接リンクする。各ツールに同分類の関連ツールを3件掲載し、2件しかない書類・時刻カテゴリではOCRや時刻付きIDなど近接する作業へつなぐ。各ページの固有title/descriptionは実HTMLで重複0件を確認した。

## 統合・削除の判断

| ページ | 判断・理由 | 実施内容 |
| --- | --- | --- |
| `/ja/tools/uuid-generator`、`/en/tools/uuid-generator` | ID生成ツール内のUUID機能と完全に重なり、独自の利用目的が乏しい。改善前は日本語561字・FAQ2件 | ユーザー追加承認により削除し、同言語の`id-generator`へ301。sitemap・一覧・検索は統合先に一本化 |
| その他の既存ツール | CSV変換とCSV編集、画像変換とEXIF除去などは入力・出力・作業目的が異なる。現在の測定で薄さや過度な類似を理由に削除する根拠はない | 統合・削除・noindexの追加提案なし |
| ホームの検索・カテゴリ・履歴等のクエリURL | 独立した記事ではなくホームの表示状態 | 同じ言語のホームcanonicalへ集約。sitemapには掲載しない |

Search Consoleの42件の具体URLがないため、過去の404やリダイレクトの個別原因を断定しない。公開レジストリ・sitemap・全ページの現在の内部リンクはスクリプトで検査済み。

## 運営者情報（確認済み）

運営者の回答に基づき、日英の運営者情報・お問い合わせ・プライバシーポリシーを以下へ更新した。

- 運営者名: `furutahss`
- メール: `contact@furutahss.com`（運営者情報・お問い合わせにはmailtoリンクも掲載）
- 所在地: 公開欄を設けない。住所のプレースホルダーも削除。

当初の運営者プレースホルダーは公開ページからすべて解消した。AdSenseの[必須コンテンツ](https://support.google.com/adsense/answer/1348695?hl=en)には、運営者住所をサイト上に公開する一般的な要件は記載されていない。無料ツールの現状では住所の常時公開欄を設けず、有料販売等を始める場合は[消費者庁の通信販売広告の表示要件](https://www.no-trouble.caa.go.jp/what/mailorder/advertising.htmljp)を別途確認する。保有個人データの取り扱いに関しては、サイトへの一律掲載と、本人の求めに応じた情報提供義務を混同しない（[個人情報保護委員会ガイドライン](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/)）。

## 再実行とデプロイ後の手順

1. `npm run build`、`npm test`、`npm run lint`、`npm run seo:content`。
2. 別ターミナルで`npm run preview:seo`、`npm run seo:links`。クロールは301を自動追従せず、リダイレクト経由の内部リンクも失敗扱いにする。
3. 最新の運営者情報を含めてビルドする。デプロイは既存のWorkersプロジェクトで`npx wrangler deploy`を使用し、`out/`だけでなく`worker/index.mjs`と両Custom Domain設定も反映する。旧来の静的ファイルだけの公開ではHTTP/wwwの正規化処理が実行されない。
4. `python3 scripts/seo/crawl.py --base https://clientkit.dev`で本番の全URL、旧UUID・末尾スラッシュ・HTTP/wwwの応答を再確認。既存のCDNルールやDNS/TLSを含む実配信は、この時点で確認する。
5. Search Consoleで`sitemap.xml`を再送信し、変更した主要ツールとAbout等をURL検査→公開URLテスト→インデックス登録リクエスト。旧UUID URLはリダイレクト扱い、正規URLを登録対象とする。登録・再クロールの時期はGoogleの判断による。
6. 本番で内容・リンク・運営者情報が反映され、クローラーが閲覧できることを確認してからAdSenseの「サイト」から再審査を依頼する。固定の待機日数を合格条件とはしない。管理画面に再申請可能日の指定がある場合はそれに従う。[Google公式の修正後の審査手順](https://support.google.com/adsense/answer/12176698?hl=ja)を参照。本文の文字数や今回の検査成功だけでAdSense承認を保証するものではない。

## 検証の範囲

ローカルの本番静的出力とCloudflare Workerを組み合わせて検証した。本文の入出力例は実装と照合し、各ツールの既存テストも実行した。広告配信やAdSense/Search Consoleの管理画面、本番への公開操作は行っていない。広告スクリプトと`ads.txt`は変更していない。

## HTTPクロール検証結果

検証先: `http://127.0.0.1:8787`（本番ビルドのCloudflare Workersローカル配信）。sitemap 136 URL、HTML応答142件、内部リンク先142件、301確認131件。エラー0件。

本文・title/description一意性・canonical・ja/en/x-default相互整合・フッター・ホーム到達性・関連ツール・robots・未知URLの404を実レスポンスから検証。HTTP/wwwの組合せはWorker単体テストでも検証。本番反映後には同じスクリプトを`--base https://clientkit.dev`で再実行できる。

## 改善後の本文計測

計測対象: 61ツール × 2言語。使い方・解説・FAQの可視テキストを対象とし、ナビ・UIラベル・JSON-LDは除外。文字数は空白を除くUnicodeコードポイント数。基準は日本語600字以上、英語200語以上（内容の同等性は実装との照合で別途確認）。600〜1200字は目安とし、有用な既存説明は削らない。独自本文は他ツールと完全一致しない解説段落の有無。類似度は同一言語の全組合せで、記号・空白除去後の文字5-gram Dice係数、上限0.55。

| URL | 本文字数 | 英語語数 | 独自解説 | FAQ数 |
| --- | ---: | ---: | --- | ---: |
| /ja/tools/character-count | 1062 | — | あり | 4 |
| /ja/tools/text-diff | 1186 | — | あり | 4 |
| /ja/tools/unicode-inspector | 1045 | — | あり | 3 |
| /ja/tools/text-normalizer | 1449 | — | あり | 4 |
| /ja/tools/base64 | 1052 | — | あり | 4 |
| /ja/tools/url-encoder | 1368 | — | あり | 4 |
| /ja/tools/json-formatter | 1159 | — | あり | 4 |
| /ja/tools/data-format-converter | 1312 | — | あり | 4 |
| /ja/tools/csv-json-converter | 1196 | — | あり | 4 |
| /ja/tools/csv-editor | 1243 | — | あり | 4 |
| /ja/tools/excel-converter | 1407 | — | あり | 4 |
| /ja/tools/markdown-editor | 1533 | — | あり | 4 |
| /ja/tools/timestamp-converter | 1221 | — | あり | 4 |
| /ja/tools/color-converter | 1294 | — | あり | 4 |
| /ja/tools/image-converter | 1340 | — | あり | 4 |
| /ja/tools/screenshot-editor | 1476 | — | あり | 4 |
| /ja/tools/ocr | 1314 | — | あり | 4 |
| /ja/tools/video-converter | 1428 | — | あり | 4 |
| /ja/tools/background-remover | 1318 | — | あり | 4 |
| /ja/tools/exif-remover | 1255 | — | あり | 4 |
| /ja/tools/svg-optimizer | 1246 | — | あり | 4 |
| /ja/tools/favicon-generator | 1377 | — | あり | 4 |
| /ja/tools/qr-code | 1240 | — | あり | 4 |
| /ja/tools/pdf-toolkit | 1334 | — | あり | 4 |
| /ja/tools/invoice-generator | 1545 | — | あり | 4 |
| /ja/tools/regex-tester | 1160 | — | あり | 4 |
| /ja/tools/jsonpath-tester | 1312 | — | あり | 4 |
| /ja/tools/json-diff | 903 | — | あり | 3 |
| /ja/tools/json-schema-validator | 1068 | — | あり | 3 |
| /ja/tools/json-schema-generator | 1055 | — | あり | 3 |
| /ja/tools/i18n-placeholder-checker | 1012 | — | あり | 3 |
| /ja/tools/hash-generator | 1681 | — | あり | 5 |
| /ja/tools/password-hash | 1642 | — | あり | 4 |
| /ja/tools/jwt-decoder | 1344 | — | あり | 4 |
| /ja/tools/certificate-decoder | 1355 | — | あり | 4 |
| /ja/tools/id-generator | 1368 | — | あり | 4 |
| /ja/tools/har-analyzer | 1594 | — | あり | 4 |
| /ja/tools/curl-converter | 1621 | — | あり | 4 |
| /ja/tools/openapi-compat | 1107 | — | あり | 3 |
| /ja/tools/robots-txt-tester | 1029 | — | あり | 3 |
| /ja/tools/cidr-calculator | 977 | — | あり | 3 |
| /ja/tools/log-masker | 1513 | — | あり | 4 |
| /ja/tools/chmod-calculator | 877 | — | あり | 3 |
| /ja/tools/env-compare | 975 | — | あり | 3 |
| /ja/tools/folder-tree | 1314 | — | あり | 4 |
| /ja/tools/gitignore-tester | 1048 | — | あり | 3 |
| /ja/tools/semver-range | 1053 | — | あり | 3 |
| /ja/tools/csv-reconcile | 1009 | — | あり | 3 |
| /ja/tools/image-diff | 941 | — | あり | 3 |
| /ja/tools/cron-explainer | 1274 | — | あり | 4 |
| /ja/tools/sql-formatter | 1224 | — | あり | 4 |
| /ja/tools/sql-insert-generator | 1174 | — | あり | 3 |
| /ja/tools/pg-explain-viewer | 1146 | — | あり | 3 |
| /ja/tools/code-formatter | 1458 | — | あり | 4 |
| /ja/tools/source-map-resolver | 1085 | — | あり | 3 |
| /ja/tools/sql-to-prisma | 1684 | — | あり | 4 |
| /ja/tools/mermaid-editor | 1358 | — | あり | 4 |
| /ja/tools/prisma-schema-visualizer | 1296 | — | あり | 4 |
| /ja/tools/prisma-zod-generator | 1477 | — | あり | 4 |
| /ja/tools/prisma-repo-generator | 1649 | — | あり | 4 |
| /ja/tools/mock-repo-generator | 1587 | — | あり | 4 |
| /en/tools/character-count | 1911 | 380 | あり | 4 |
| /en/tools/text-diff | 2087 | 411 | あり | 4 |
| /en/tools/unicode-inspector | 1969 | 360 | あり | 3 |
| /en/tools/text-normalizer | 2718 | 489 | あり | 4 |
| /en/tools/base64 | 1607 | 306 | あり | 4 |
| /en/tools/url-encoder | 2117 | 408 | あり | 4 |
| /en/tools/json-formatter | 1959 | 373 | あり | 4 |
| /en/tools/data-format-converter | 2042 | 418 | あり | 4 |
| /en/tools/csv-json-converter | 2019 | 423 | あり | 4 |
| /en/tools/csv-editor | 2098 | 463 | あり | 4 |
| /en/tools/excel-converter | 2237 | 467 | あり | 4 |
| /en/tools/markdown-editor | 2168 | 419 | あり | 4 |
| /en/tools/timestamp-converter | 2103 | 428 | あり | 4 |
| /en/tools/color-converter | 2095 | 423 | あり | 4 |
| /en/tools/image-converter | 2262 | 443 | あり | 4 |
| /en/tools/screenshot-editor | 2597 | 518 | あり | 4 |
| /en/tools/ocr | 2260 | 432 | あり | 4 |
| /en/tools/video-converter | 2207 | 460 | あり | 4 |
| /en/tools/background-remover | 2467 | 488 | あり | 4 |
| /en/tools/exif-remover | 2088 | 417 | あり | 4 |
| /en/tools/svg-optimizer | 2023 | 398 | あり | 4 |
| /en/tools/favicon-generator | 2165 | 442 | あり | 4 |
| /en/tools/qr-code | 1927 | 429 | あり | 4 |
| /en/tools/pdf-toolkit | 2310 | 469 | あり | 4 |
| /en/tools/invoice-generator | 2775 | 544 | あり | 4 |
| /en/tools/regex-tester | 1907 | 389 | あり | 4 |
| /en/tools/jsonpath-tester | 2007 | 386 | あり | 4 |
| /en/tools/json-diff | 1473 | 299 | あり | 3 |
| /en/tools/json-schema-validator | 1739 | 332 | あり | 3 |
| /en/tools/json-schema-generator | 1602 | 319 | あり | 3 |
| /en/tools/i18n-placeholder-checker | 1724 | 328 | あり | 3 |
| /en/tools/hash-generator | 2529 | 485 | あり | 5 |
| /en/tools/password-hash | 2492 | 469 | あり | 4 |
| /en/tools/jwt-decoder | 2130 | 406 | あり | 4 |
| /en/tools/certificate-decoder | 2299 | 441 | あり | 4 |
| /en/tools/id-generator | 2406 | 473 | あり | 4 |
| /en/tools/har-analyzer | 2578 | 507 | あり | 4 |
| /en/tools/curl-converter | 2412 | 458 | あり | 4 |
| /en/tools/openapi-compat | 1801 | 332 | あり | 3 |
| /en/tools/robots-txt-tester | 1481 | 319 | あり | 3 |
| /en/tools/cidr-calculator | 1424 | 305 | あり | 3 |
| /en/tools/log-masker | 2430 | 478 | あり | 4 |
| /en/tools/chmod-calculator | 1387 | 286 | あり | 3 |
| /en/tools/env-compare | 1837 | 366 | あり | 3 |
| /en/tools/folder-tree | 2051 | 419 | あり | 4 |
| /en/tools/gitignore-tester | 1612 | 330 | あり | 3 |
| /en/tools/semver-range | 1600 | 355 | あり | 3 |
| /en/tools/csv-reconcile | 1840 | 405 | あり | 3 |
| /en/tools/image-diff | 1685 | 326 | あり | 3 |
| /en/tools/cron-explainer | 2082 | 424 | あり | 4 |
| /en/tools/sql-formatter | 2043 | 378 | あり | 4 |
| /en/tools/sql-insert-generator | 1913 | 396 | あり | 3 |
| /en/tools/pg-explain-viewer | 1803 | 369 | あり | 3 |
| /en/tools/code-formatter | 2300 | 440 | あり | 4 |
| /en/tools/source-map-resolver | 1695 | 340 | あり | 3 |
| /en/tools/sql-to-prisma | 2559 | 468 | あり | 4 |
| /en/tools/mermaid-editor | 2155 | 449 | あり | 4 |
| /en/tools/prisma-schema-visualizer | 2254 | 416 | あり | 4 |
| /en/tools/prisma-zod-generator | 2142 | 419 | あり | 4 |
| /en/tools/prisma-repo-generator | 2684 | 498 | あり | 4 |
| /en/tools/mock-repo-generator | 2581 | 485 | あり | 4 |

最も類似する組: en: csv-json-converter / csv-editor = 0.361; en: prisma-repo-generator / mock-repo-generator = 0.301; ja: csv-json-converter / csv-editor = 0.269; en: sql-to-prisma / prisma-zod-generator = 0.231; en: ocr / background-remover = 0.212。

基準未達: 0件。

## 最終確認

- 本番ビルド成功。テスト34ファイル・351件成功、lintエラー・警告0件。
- 追加解説のJSONを読み込む監査ローダーも検証し、計測対象の欠落を防ぐassertを追加。上記の改善後測定は追加解説を含む再計測結果。
- 全122ツールページで本文基準達成（日本語最小877字、英語最小286語）。最大類似度0.361で上限0.55未満。FAQは全ツール3〜5件。
- 登録された全解説段落が実HTTPレスポンスの可視本文に存在することを確認。sitemap136 URLは全200、内部リンク先142件は切れ・リダイレクト経由0件、131件の301検査成功。
- 全ローカライズページで自己canonical・対応するja/en/x-default・固有title/description・5種類の信頼性ページへのフッターリンクを確認。ホームから全ツールへの直接リンク・各ツールの関連リンク・カテゴリのアンカーも成功。
- WorkerのHTTP/wwwを含む正規化テスト成功、Cloudflare最終設定のdry-run成功。DNS/TLSを伴う本番応答の確認はデプロイ後の上記手順で行う。
- 独立レビューで重大な指摘なし。運営者プレースホルダーは後続の確認で解消済み。リポジトリ内の実装・検証の未解決事項なし。本番公開・Google側の審査/登録結果はこの作業で実行・保証していない。

## 運営者情報確定後の再検証

運営者名furutahss、連絡先contact@furutahss.comを日英へ反映し、所在地欄と記入待ち文言を削除した。`npm run build`・`npm test`（351件）・`npm run lint`・`npm run seo:content`成功。日英の運営者情報・お問い合わせ・プライバシーポリシー計6ページの出力HTMLに名前・メールが存在し、運営者プレースホルダーが残っていないことを確認。HTTPクロールもsitemap136 URL全200、内部リンク先142件、301確認131件、失敗0件。本番へのデプロイは行っていない。
