<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 補足: 上のブロックの出所

上のブロックは `next dev`(Next.js 16.3.5)が自動生成するテンプレートで、手書きではない。生成ロジックは `node_modules/next/dist/server/lib/generate-agent-files.js` の `buildAgentRulesBlock()` にあり、案内先の `node_modules/next/dist/docs/` には Next.js 公式ドキュメント一式が同梱されている(`npm install` を実行するまでは `node_modules` 自体が存在しないため、これらのパスも見つからない点に注意)。

マーカー(`<!-- BEGIN:nextjs-agent-rules -->` 〜 `<!-- END:nextjs-agent-rules -->`)の内側は次回の `next dev` 起動時に正規の内容へ上書きされる。このファイルに追記する場合は、このセクションのようにマーカーの外側に書く。
