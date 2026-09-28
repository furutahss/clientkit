/** フォルダ・圧縮ファイルの階層構造を組み立て、テキストのツリーとして出力する */

export type TreeEntry = {
  /** ルートからの相対パス（区切りは "/"） */
  path: string;
  isDir: boolean;
  /** ファイルサイズ（バイト）。フォルダは0 */
  size: number;
};

export type TreeNode = {
  name: string;
  isDir: boolean;
  /** ファイルはそのサイズ、フォルダは配下のファイルの合計サイズ */
  size: number;
  children: TreeNode[];
};

export type TreeStyle = "unicode" | "ascii" | "indent" | "markdown";

export type TreeRenderOptions = {
  /** 表示する階層の深さ（1ならルート直下のみ）。nullは無制限 */
  maxDepth: number | null;
  showFiles: boolean;
  /** "." で始まる隠しファイル・フォルダを表示する */
  showHidden: boolean;
  dirsFirst: boolean;
  showSize: boolean;
  /** フォルダ名の末尾に "/" を付ける */
  dirSlash: boolean;
  style: TreeStyle;
  /** 除外する名前のパターン（* と ? のワイルドカードに対応） */
  exclude: string[];
};

export type TreeRenderResult = {
  text: string;
  /** 出力に含まれるフォルダ数（ルートを除く） */
  dirCount: number;
  /** 出力に含まれるファイル数 */
  fileCount: number;
  lineCount: number;
};

type MutableNode = {
  name: string;
  isDir: boolean;
  size: number;
  children: Map<string, MutableNode>;
};

function createNode(name: string, isDir: boolean): MutableNode {
  return { name, isDir, size: 0, children: new Map() };
}

/** パスの一覧から階層構造を組み立てる。途中のフォルダは自動的に補完する */
export function buildTree(rootName: string, entries: TreeEntry[]): TreeNode {
  const root = createNode(rootName, true);

  for (const entry of entries) {
    const parts = entry.path.split("/").filter((part) => part && part !== ".");
    if (parts.length === 0) continue;

    let current = root;
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const isDir = !isLast || entry.isDir;
      let child = current.children.get(part);
      if (!child) {
        child = createNode(part, isDir);
        current.children.set(part, child);
      } else if (isDir && !child.isDir) {
        // 同名のファイルとフォルダが混在する不正なアーカイブではフォルダを優先する
        child.isDir = true;
      }
      if (isLast && !isDir) child.size = entry.size;
      current = child;
    });
  }

  const freeze = (node: MutableNode): TreeNode => ({
    name: node.name,
    isDir: node.isDir,
    size: node.size,
    children: [...node.children.values()].map(freeze),
  });
  return freeze(root);
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i");
}

/** カンマ・改行区切りの除外パターン文字列を配列にする */
export function parseExcludePatterns(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((pattern) => pattern.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

/** 隠しファイルと除外パターンを取り除き、フォルダの合計サイズを計算し直す */
function filterTree(
  node: TreeNode,
  showHidden: boolean,
  excludes: RegExp[]
): TreeNode {
  const children: TreeNode[] = [];
  let size = node.isDir ? 0 : node.size;
  for (const child of node.children) {
    if (!showHidden && child.name.startsWith(".")) continue;
    if (excludes.some((regex) => regex.test(child.name))) continue;
    const filtered = filterTree(child, showHidden, excludes);
    children.push(filtered);
    size += filtered.size;
  }
  return { ...node, size, children };
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function sortChildren(children: TreeNode[], dirsFirst: boolean): TreeNode[] {
  return [...children].sort((a, b) => {
    if (dirsFirst && a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return collator.compare(a.name, b.name);
  });
}

const BRANCHES: Record<"unicode" | "ascii", { mid: string; last: string; pipe: string; blank: string }> = {
  unicode: { mid: "├── ", last: "└── ", pipe: "│   ", blank: "    " },
  ascii: { mid: "|-- ", last: "`-- ", pipe: "|   ", blank: "    " },
};

/** 階層構造をテキストのツリーとして出力する */
export function renderTree(tree: TreeNode, options: TreeRenderOptions): TreeRenderResult {
  const filtered = filterTree(tree, options.showHidden, options.exclude.map(wildcardToRegExp));
  const lines: string[] = [];
  let dirCount = 0;
  let fileCount = 0;

  const formatName = (node: TreeNode): string => {
    let label = node.name;
    if (node.isDir && options.dirSlash && !label.endsWith("/")) label += "/";
    if (options.showSize) label += ` (${formatSize(node.size)})`;
    return label;
  };

  const visibleChildren = (node: TreeNode): TreeNode[] =>
    sortChildren(
      options.showFiles ? node.children : node.children.filter((child) => child.isDir),
      options.dirsFirst
    );

  const walk = (node: TreeNode, depth: number, prefix: string) => {
    if (options.maxDepth !== null && depth > options.maxDepth) return;
    const children = visibleChildren(node);
    children.forEach((child, index) => {
      const isLast = index === children.length - 1;
      if (child.isDir) dirCount += 1;
      else fileCount += 1;

      if (options.style === "unicode" || options.style === "ascii") {
        const branch = BRANCHES[options.style];
        lines.push(`${prefix}${isLast ? branch.last : branch.mid}${formatName(child)}`);
        if (child.isDir) walk(child, depth + 1, prefix + (isLast ? branch.blank : branch.pipe));
      } else {
        const indent = "  ".repeat(depth);
        lines.push(
          options.style === "markdown"
            ? `${indent}- ${escapeMarkdown(formatName(child))}`
            : `${indent}${formatName(child)}`
        );
        if (child.isDir) walk(child, depth + 1, prefix);
      }
    });
  };

  const rootLabel = formatName(filtered);
  lines.push(options.style === "markdown" ? `- ${escapeMarkdown(rootLabel)}` : rootLabel);
  // Markdownとインデント形式はルートを0階層目として、子を1段下げる
  walk(filtered, 1, "");

  return { text: lines.join("\n"), dirCount, fileCount, lineCount: lines.length };
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]<>#|])/g, "\\$1");
}

const SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** ツリー表示用の短いサイズ表記（例: 12 B, 3.4 KB） */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${SIZE_UNITS[unitIndex]}`;
}
