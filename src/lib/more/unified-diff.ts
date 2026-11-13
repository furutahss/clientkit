export type DiffLine = { type: " " | "+" | "-"; text: string; oldNo: number | null; newNo: number | null };
export type Hunk = { header: string; lines: DiffLine[] };
export type FileDiff = { oldName: string; newName: string; status: "modified" | "added" | "deleted" | "renamed" | "binary"; hunks: Hunk[]; added: number; removed: number };

export function parseUnifiedDiff(text: string): FileDiff[] {
  const files: FileDiff[] = [];
  let file: FileDiff | null = null, hunk: Hunk | null = null;
  let oldNo = 0, newNo = 0;
  const start = (oldName: string, newName: string) => { file = { oldName, newName, status: "modified", hunks: [], added: 0, removed: 0 }; files.push(file); hunk = null; };
  const clean = (n: string) => n.replace(/^"|"$/g, "").replace(/\t.*$/, "").replace(/^[ab]\//, "");
  for (const line of text.split(/\r?\n/)) {
    let m: RegExpExecArray | null;
    if ((m = /^diff --git (\S+) (\S+)/.exec(line))) { start(clean(m[1]), clean(m[2])); continue; }
    if (/^Binary files /.test(line) || /^GIT binary patch/.test(line)) { if (file) (file as FileDiff).status = "binary"; continue; }
    if (file && !hunk) {
      if (/^new file mode/.test(line)) { (file as FileDiff).status = "added"; continue; }
      if (/^deleted file mode/.test(line)) { (file as FileDiff).status = "deleted"; continue; }
      if ((m = /^rename from (.+)/.exec(line))) { (file as FileDiff).oldName = m[1]; (file as FileDiff).status = "renamed"; continue; }
      if ((m = /^rename to (.+)/.exec(line))) { (file as FileDiff).newName = m[1]; continue; }
    }
    if ((m = /^--- (.+)/.exec(line)) && !hunk) {
      const name = clean(m[1]);
      if (!file || (file as FileDiff).hunks.length) start(name, name); else if (name !== "/dev/null") (file as FileDiff).oldName = name; else (file as FileDiff).status = "added";
      continue;
    }
    if ((m = /^\+\+\+ (.+)/.exec(line)) && !hunk) { const name = clean(m[1]); if (file) { if (name !== "/dev/null") (file as FileDiff).newName = name; else (file as FileDiff).status = "deleted"; } continue; }
    if ((m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line))) {
      if (!file) start("(unknown)", "(unknown)");
      oldNo = Number(m[1]); newNo = Number(m[2]);
      hunk = { header: line, lines: [] };
      (file as unknown as FileDiff).hunks.push(hunk);
      continue;
    }
    if (hunk && file) {
      const f = file as FileDiff, h = hunk as Hunk;
      if (line.startsWith("+")) { h.lines.push({ type: "+", text: line.slice(1), oldNo: null, newNo: newNo++ }); f.added++; }
      else if (line.startsWith("-")) { h.lines.push({ type: "-", text: line.slice(1), oldNo: oldNo++, newNo: null }); f.removed++; }
      else if (line.startsWith(" ") || line === "") { if (line === "" && !h.lines.length) continue; h.lines.push({ type: " ", text: line.slice(1), oldNo: oldNo++, newNo: newNo++ }); }
      else if (line.startsWith("\\")) continue;
      else hunk = null;
    }
  }
  return files;
}

export type SideRow = { left: DiffLine | null; right: DiffLine | null };

/** 連続する削除行と追加行を左右に並べる（サイドバイサイド表示用） */
export function toSideBySide(lines: DiffLine[]): SideRow[] {
  const rows: SideRow[] = [];
  for (let i = 0; i < lines.length; ) {
    if (lines[i].type === " ") { rows.push({ left: lines[i], right: lines[i] }); i++; continue; }
    const del: DiffLine[] = [], add: DiffLine[] = [];
    while (i < lines.length && lines[i].type === "-") del.push(lines[i++]);
    while (i < lines.length && lines[i].type === "+") add.push(lines[i++]);
    for (let k = 0; k < Math.max(del.length, add.length); k++) rows.push({ left: del[k] ?? null, right: add[k] ?? null });
  }
  return rows;
}
