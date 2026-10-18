/**
 * ルートの .gitignore を解析し、未追跡パスが無視対象になるかと、その理由となったルールを判定する。
 * 複数階層の .gitignore・グローバル設定・.git/info/exclude、[:alpha:] などの文字クラスは対象外。
 * 大文字・小文字は区別する（core.ignorecase=false 相当）。
 */

export type GitignoreRule = {
  line: number;
  /** .gitignore に書かれたままの行 */
  text: string;
  negated: boolean;
  dirOnly: boolean;
  regex: RegExp;
};

function escapeRegex(char: string): string {
  return /[\\^$.*+?()[\]{}|/-]/.test(char) ? `\\${char}` : char;
}

/** [a-z] や [!abc] を正規表現の文字クラスにする。閉じていない [ は null を返す（文字として扱う） */
function bracketToRegex(pattern: string, start: number): { source: string; end: number } | null {
  let i = start + 1;
  let negate = false;
  if (pattern[i] === "!" || pattern[i] === "^") {
    negate = true;
    i++;
  }
  let body = "";
  // 先頭の ] はクラスの文字として扱う
  if (pattern[i] === "]") {
    body += "\\]";
    i++;
  }
  for (; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "]") return { source: `[${negate ? "^" : ""}${body}]`, end: i };
    if (char === "\\" && i + 1 < pattern.length) body += escapeRegex(pattern[++i]);
    else body += char === "-" ? "-" : escapeRegex(char);
  }
  return null;
}

function globToRegex(pattern: string): string {
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "\\" && i + 1 < pattern.length) {
      source += escapeRegex(pattern[++i]);
    } else if (char === "*") {
      if (pattern[i + 1] === "*") {
        const atStart = i === 0 || pattern[i - 1] === "/";
        const atEnd = i + 2 === pattern.length || pattern[i + 2] === "/";
        if (atStart && atEnd) {
          if (i + 2 === pattern.length) {
            source += ".*"; // 末尾の /** は中のすべて
          } else {
            source += "(?:.*/)?"; // 先頭・途中の **/ は0個以上のディレクトリ
            i++;
          }
          i++;
          continue;
        }
      }
      // それ以外の ** は通常の * と同じ
      while (pattern[i + 1] === "*") i++;
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else if (char === "[") {
      const bracket = bracketToRegex(pattern, i);
      if (bracket) {
        source += bracket.source;
        i = bracket.end;
      } else {
        source += "\\[";
      }
    } else {
      source += escapeRegex(char);
    }
  }
  return source;
}

/** 行末の空白は \ でエスケープされていなければ取り除く */
function trimTrailingSpaces(line: string): string {
  let end = line.length;
  while (end > 0 && line[end - 1] === " ") {
    let backslashes = 0;
    for (let i = end - 2; i >= 0 && line[i] === "\\"; i--) backslashes++;
    if (backslashes % 2 === 1) break;
    end--;
  }
  return line.slice(0, end);
}

export function parseGitignore(text: string): GitignoreRule[] {
  const rules: GitignoreRule[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    let pattern = trimTrailingSpaces(raw);
    if (pattern === "" || pattern.startsWith("#")) return;
    const negated = pattern.startsWith("!");
    if (negated) pattern = pattern.slice(1);
    const dirOnly = pattern.endsWith("/") && !pattern.endsWith("\\/");
    if (dirOnly) pattern = pattern.replace(/\/+$/, "");
    if (pattern === "") return;
    // 先頭・途中に / があればこの .gitignore の場所からの相対パス。なければどの階層の名前にも一致する
    const anchored = pattern.includes("/");
    if (pattern.startsWith("/")) pattern = pattern.slice(1);
    const source = globToRegex(pattern);
    const regex = new RegExp(anchored ? `^${source}$` : `^(?:.*/)?${source}$`);
    rules.push({ line: index + 1, text: raw, negated, dirOnly, regex });
  });
  return rules;
}

/** 最後に一致したルールが優先される */
function lastMatch(rules: GitignoreRule[], path: string, isDir: boolean): GitignoreRule | undefined {
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i];
    if (rule.dirOnly && !isDir) continue;
    if (rule.regex.test(path)) return rule;
  }
  return undefined;
}

export type GitignoreResult =
  | { input: string; status: "invalidPath" }
  | {
      input: string;
      status: "checked";
      path: string;
      isDir: boolean;
      ignored: boolean;
      /** 判定を決めたルール（なければどのルールにも一致していない） */
      rule?: GitignoreRule;
      /** 親ディレクトリが除外されたために無視された場合のディレクトリ */
      excludedParent?: string;
      /** 親ディレクトリが除外されているため効かない否定ルール */
      ineffectiveNegation?: GitignoreRule;
    };

/** パスは1行に1つ。末尾が / のものはディレクトリとして扱う。空白もファイル名の一部として扱う */
export function checkPaths(rules: GitignoreRule[], lines: string[]): GitignoreResult[] {
  return lines
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() !== "")
    .map((input): GitignoreResult => {
      const isDir = input.endsWith("/");
      const path = input.replace(/^(\.\/)+/, "").replace(/^\/+/, "").replace(/\/+$/, "");
      const segments = path.split("/");
      if (path === "" || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
        return { input, status: "invalidPath" };
      }

      // Gitは除外されたディレクトリの中を探索しないため、その中のファイルは否定ルールで戻せない
      for (let depth = 1; depth < segments.length; depth++) {
        const parent = segments.slice(0, depth).join("/");
        const rule = lastMatch(rules, parent, true);
        if (rule && !rule.negated) {
          const own = lastMatch(rules, path, isDir);
          return {
            input,
            status: "checked",
            path,
            isDir,
            ignored: true,
            rule,
            excludedParent: parent,
            ineffectiveNegation: own?.negated ? own : undefined,
          };
        }
      }

      const rule = lastMatch(rules, path, isDir);
      return { input, status: "checked", path, isDir, ignored: !!rule && !rule.negated, rule };
    });
}
