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
