import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
});

/** MarkdownをGFM対応のHTMLに変換する（サニタイズは行わない） */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown) as string;
}

const HTML_DOCUMENT_STYLE = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.7; color: #1f2328; max-width: 840px; margin: 2rem auto; padding: 0 1rem; }
  pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  code { background: #f6f8fa; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d0d7de; padding: 0.5em 0.8em; }
  blockquote { border-left: 4px solid #d0d7de; margin: 0; padding-left: 1em; color: #57606a; }
  img { max-width: 100%; }
`;

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** ダウンロード用に、HTMLフラグメントを最小限のスタイル付きHTML文書へラップする */
export function wrapHtmlDocument(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtmlText(title)}</title>
<style>${HTML_DOCUMENT_STYLE}</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}
