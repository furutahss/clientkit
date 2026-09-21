/**
 * スマートドロップでツールを選択した際に、ドロップされたファイルを
 * 遷移先のツールページへ引き継ぐための一時的な受け渡し場所。
 * クライアントサイド遷移の間だけメモリ上に保持され、ページを離れると消える。
 */
let pendingFile: { toolId: string; file: File } | null = null;

export function setPendingToolFile(toolId: string, file: File): void {
  pendingFile = { toolId, file };
}

/** 対象のツールIDに一致する引き継ぎファイルがあれば取り出して消費する */
export function takePendingToolFile(toolId: string): File | null {
  if (pendingFile?.toolId !== toolId) return null;
  const { file } = pendingFile;
  pendingFile = null;
  return file;
}
