# ClientKit

**ClientKit (clientkit.dev)** は、サーバーにデータを送信せず、すべての処理をブラウザ（クライアントサイド）上で完結させる安全なWebツール集です。

## コンセプト

- **安全**: 入力データはサーバーへ一切送信されません。
- **高速**: 通信が発生しないため、ネットワーク環境に左右されず動作します。
- **プライバシー保護**: 機密情報や個人情報を扱う作業でも安心して利用できます。

## 技術スタック

- [Next.js](https://nextjs.org) (App Router, TypeScript) — 静的エクスポート (`output: 'export'`)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Lucide React](https://lucide.dev)
- [next-themes](https://github.com/pacocoursey/next-themes) — ダークモード対応

## セットアップ

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いて確認してください。

## ビルド（静的エクスポート）

```bash
npm run build
```

`out/` ディレクトリに静的ファイルが出力されます。Cloudflare Pages などの静的ホスティングにそのままデプロイできます。

## ツールの追加方法

ツールは `src/config/tools.ts` で一元管理されています。新しいツールを追加する場合は次の手順で行います。

1. `src/config/tools.ts` の `tools` 配列に、ID・名称・説明・カテゴリ・アイコン・検索キーワード・パスを追加する。
2. `src/app/tools/<tool-id>/page.tsx` を作成し、`getToolById` でメタデータを取得して `generateMetadata` に適用する。
3. `src/components/tools/` にツール本体のUIコンポーネント（クライアントコンポーネント）を実装する。
4. 共通のクリア・コピーアクションには `src/components/tools/tool-actions.tsx` の `ToolActions` を利用する。

入力→結果表示の形で動くツール（テキスト・ファイルを受け取り、表・テキスト・ダウンロードを返すもの）は、`src/components/tools/more/` の共通部品で、少ないコードで追加できます。

1. `src/lib/more/<name>.ts` に純粋な処理を書き、`<name>.test.ts` でテストする。
2. `src/components/tools/more/specs/<group>.ts(x)` に、入力欄・オプション・`run()` からなる `ToolSpec` を追加する。
3. `src/config/more-tools/<group>.ts` に `define(...)` で日英の説明・FAQ・キーワードを追加し、`faq-extra.ts` に3つ目のFAQを足す。
4. `src/components/tools/more/spec-ids.ts` にIDを追加する（専用UIが必要な場合は `CUSTOM_IDS` と `registry.tsx`）。

登録漏れ・FAQ件数・検索は `src/config/more-tools/more-tools.test.ts` と `npm run seo:content` で検証されます。

サイドバー・トップページのツール一覧・検索機能はすべて `src/config/tools.ts` を参照して動的に生成されるため、上記の登録だけで自動的に反映されます。

## ディレクトリ構成（抜粋）

```
src/
  app/
    layout.tsx          # 全体レイアウト（Header, Sidebar, ThemeProvider）
    page.tsx             # トップページ
    tools/<id>/page.tsx  # 各ツールページ
  components/
    layout/              # Header, Sidebar, Breadcrumbなど
    home/                # トップページのツール検索・カード
    tools/                # ツール共通部品・各ツール実装
    ui/                   # shadcn/uiベースのUIコンポーネント
  config/
    tools.ts              # ツールレジストリ（一元管理）
    site.ts                # サイト全体の設定
```

## SEOの検証と配信

```bash
npm run build
npm test
npm run lint
npm run seo:content
```

別ターミナルで`npm run preview:seo`を起動し、`npm run seo:links`で本番出力の全内部リンクとメタ情報を検証できます。本文の改善前・改善後の測定、運営者情報の確認待ち項目、デプロイ後の手順は[SEO監査](docs/seo-audit.md)を参照してください。

URL正規化には`worker/index.mjs`を使います。Cloudflare Workersへ`npx wrangler deploy`で静的資産とWorkerを一緒に反映してください。`out/`だけのアップロードではHTTP/wwwの統一処理は反映されません。
