import { describe, expect, it } from "vitest";

import { parseUnifiedDiff, toSideBySide } from "./unified-diff";

const diff = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,4 +1,5 @@
 const a = 1;
-const b = 2;
-const c = 3;
+const b = 20;
+const c = 30;
+const d = 4;
 export {};
diff --git a/new.txt b/new.txt
new file mode 100644
--- /dev/null
+++ b/new.txt
@@ -0,0 +1,2 @@
+hello
+world
diff --git a/img.png b/img.png
Binary files a/img.png and b/img.png differ
diff --git a/old.js b/renamed.js
similarity index 100%
rename from old.js
rename to renamed.js
`;

describe("unified diff", () => {
  const files = parseUnifiedDiff(diff);
  it("ファイル・ハンク・行番号を解析する", () => {
    expect(files.map((f) => [f.newName, f.status, f.added, f.removed])).toEqual([["src/a.ts", "modified", 3, 2], ["new.txt", "added", 2, 0], ["img.png", "binary", 0, 0], ["renamed.js", "renamed", 0, 0]]);
    const lines = files[0].hunks[0].lines;
    expect(lines[1]).toEqual({ type: "-", text: "const b = 2;", oldNo: 2, newNo: null });
    expect(lines[3]).toEqual({ type: "+", text: "const b = 20;", oldNo: null, newNo: 2 });
    expect(files[3].oldName).toBe("old.js");
  });

  it("削除行と追加行を左右に並べる", () => {
    const rows = toSideBySide(files[0].hunks[0].lines);
    expect(rows.map((r) => [r.left?.text ?? null, r.right?.text ?? null])).toEqual([["const a = 1;", "const a = 1;"], ["const b = 2;", "const b = 20;"], ["const c = 3;", "const c = 30;"], [null, "const d = 4;"], ["export {};", "export {};"]]);
  });

  it("git diff 以外の --- / +++ 形式も解析する", () => {
    const f = parseUnifiedDiff("--- a.txt\t2026-01-01\n+++ b.txt\t2026-01-02\n@@ -1 +1 @@\n-x\n+y\n");
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ oldName: "a.txt", newName: "b.txt", added: 1, removed: 1 });
  });
});
