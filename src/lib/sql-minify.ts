/** SQLからコメントを除去し、空白・改行を1つのスペースに畳んで1行化する */
export function minifySql(sql: string): string {
  const withoutBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, " ");
  const withoutLineComments = withoutBlockComments.replace(/--[^\n\r]*/g, " ");
  return withoutLineComments.replace(/\s+/g, " ").trim();
}
