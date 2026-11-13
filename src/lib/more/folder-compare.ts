export type FileInfo = { path: string; size: number; hash: string };
export type CompareRow = { path: string; status: "same" | "modified" | "only-a" | "only-b"; sizeA: number | null; sizeB: number | null };

/** ルートのフォルダ名を取り除いた相対パスにする（webkitRelativePath は "folder/sub/file" の形） */
export const relativePath = (webkitRelativePath: string) => webkitRelativePath.split("/").slice(1).join("/") || webkitRelativePath;

export function compareFolders(a: FileInfo[], b: FileInfo[]): CompareRow[] {
  const mb = new Map(b.map((f) => [f.path, f]));
  const rows: CompareRow[] = [];
  for (const f of a) {
    const g = mb.get(f.path);
    if (!g) rows.push({ path: f.path, status: "only-a", sizeA: f.size, sizeB: null });
    else { rows.push({ path: f.path, status: f.size === g.size && f.hash === g.hash ? "same" : "modified", sizeA: f.size, sizeB: g.size }); mb.delete(f.path); }
  }
  for (const g of mb.values()) rows.push({ path: g.path, status: "only-b", sizeA: null, sizeB: g.size });
  const order = { modified: 0, "only-a": 1, "only-b": 2, same: 3 };
  return rows.sort((x, y) => order[x.status] - order[y.status] || x.path.localeCompare(y.path));
}
