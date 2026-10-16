/**
 * .envファイルを解析・比較する。
 * 対応構文: KEY=value / export KEY=value / 引用符（' " `）で囲んだ値（複数行可）/ 行頭の # コメント /
 * 引用符の外で空白に続く # 以降の行末コメント。変数展開（${VAR}）やコマンド置換は行わない。
 */

export type EnvEntry = { key: string; value: string; line: number };
export type EnvInvalidLine = { line: number; text: string; reason: "noEquals" | "invalidKey" | "unclosedQuote" | "trailingText" };

export type EnvParseResult = {
  entries: EnvEntry[];
  invalid: EnvInvalidLine[];
};

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/** 閉じ引用符の位置を探す。ダブルクォート内の \" は閉じ引用符として扱わない */
function findClosingQuote(text: string, quote: string): number {
  for (let i = 1; i < text.length; i++) {
    if (quote === '"' && text[i] === "\\") {
      i += 1;
      continue;
    }
    if (text[i] === quote) return i;
  }
  return -1;
}

export function parseEnv(text: string): EnvParseResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/);
  const entries: EnvEntry[] = [];
  const invalid: EnvInvalidLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const body = trimmed.replace(/^export\s+/, "");
    const eq = body.indexOf("=");
    if (eq === -1) {
      invalid.push({ line: lineNumber, text: raw, reason: "noEquals" });
      continue;
    }
    const key = body.slice(0, eq).trim();
    if (!KEY_PATTERN.test(key)) {
      invalid.push({ line: lineNumber, text: raw, reason: "invalidKey" });
      continue;
    }

    // 値は最初の = 以降すべて（値に含まれる = はそのまま残す）
    let rest = body.slice(eq + 1).replace(/^\s+/, "");
    const quote = rest[0];
    if (quote === '"' || quote === "'" || quote === "`") {
      let close = findClosingQuote(rest, quote);
      let endLine = i;
      while (close === -1 && endLine + 1 < lines.length) {
        endLine += 1;
        rest += `\n${lines[endLine]}`;
        close = findClosingQuote(rest, quote);
      }
      if (close === -1) {
        invalid.push({ line: lineNumber, text: raw, reason: "unclosedQuote" });
        continue;
      }
      const after = rest.slice(close + 1).trim();
      if (after !== "" && !after.startsWith("#")) {
        invalid.push({ line: lineNumber, text: raw, reason: "trailingText" });
        i = endLine;
        continue;
      }
      let value = rest.slice(1, close);
      if (quote === '"') value = value.replace(/\\(["n\\])/g, (_, c: string) => (c === "n" ? "\n" : c));
      entries.push({ key, value, line: lineNumber });
      i = endLine;
      continue;
    }

    // 引用符なし: 空白に続く # 以降はコメント。空白なしの # は値の一部
    const comment = rest.search(/\s#/);
    const value = (comment === -1 ? rest : rest.slice(0, comment)).trim();
    entries.push({ key, value, line: lineNumber });
  }

  return { entries, invalid };
}

export type EnvSideInfo = {
  /** 定義された行番号（2つ以上なら重複） */
  lines: number[];
  /** 各定義の値（lines と同じ順） */
  values: string[];
};

export type EnvCompareRow = {
  key: string;
  left?: EnvSideInfo;
  right?: EnvSideInfo;
};

function group(entries: EnvEntry[]): Map<string, EnvSideInfo> {
  const map = new Map<string, EnvSideInfo>();
  for (const entry of entries) {
    const info = map.get(entry.key) ?? { lines: [], values: [] };
    info.lines.push(entry.line);
    info.values.push(entry.value);
    map.set(entry.key, info);
  }
  return map;
}

/** キーの和集合を左の出現順→右だけのキーの順に並べて比較する */
export function compareEnv(left: EnvParseResult, right: EnvParseResult): EnvCompareRow[] {
  const leftMap = group(left.entries);
  const rightMap = group(right.entries);
  const keys = [...leftMap.keys(), ...[...rightMap.keys()].filter((key) => !leftMap.has(key))];
  return keys.map((key) => ({ key, left: leftMap.get(key), right: rightMap.get(key) }));
}
