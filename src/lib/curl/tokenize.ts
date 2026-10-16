/**
 * cURL コマンドをシェルと同じ規則で引数（トークン）に分割する。
 * bash 形式（'...' "..." $'...' バックスラッシュによる行継続）と、
 * Windows のコマンドプロンプト形式（^ によるエスケープ・行継続。Chrome の「Copy as cURL (cmd)」）に対応する。
 */

export class TokenizeError extends Error {
  constructor(readonly code: "unterminatedQuote") {
    super(code);
  }
}

/** コマンドプロンプト形式（^" や行末の ^）かどうか */
export function isCmdSyntax(input: string): boolean {
  return /\^"/.test(input) || /\s\^\r?\n/.test(input);
}

const ANSI_ESCAPES: Record<string, string> = {
  a: "\x07",
  b: "\b",
  e: "\x1b",
  E: "\x1b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
  "\\": "\\",
  "'": "'",
  '"': '"',
  "?": "?",
};

/** $'...' 内のエスケープを解釈する。i は開始位置（$' の直後）、戻り値は [文字列, 終了位置の次] */
function readAnsiC(input: string, start: number): [string, number] {
  let out = "";
  let i = start;
  while (i < input.length) {
    const c = input[i];
    if (c === "'") return [out, i + 1];
    if (c !== "\\") {
      out += c;
      i += 1;
      continue;
    }
    const next = input[i + 1];
    if (next === undefined) break;
    const hex = (length: number, re: RegExp) => {
      const match = input.slice(i + 2, i + 2 + length).match(re);
      if (!match) return null;
      i += 2 + match[0].length;
      return String.fromCodePoint(parseInt(match[0], 16));
    };
    if (next === "x") {
      const value = hex(2, /^[0-9a-fA-F]{1,2}/);
      if (value !== null) {
        out += value;
        continue;
      }
    } else if (next === "u") {
      const value = hex(4, /^[0-9a-fA-F]{1,4}/);
      if (value !== null) {
        out += value;
        continue;
      }
    } else if (next === "U") {
      const value = hex(8, /^[0-9a-fA-F]{1,8}/);
      if (value !== null) {
        out += value;
        continue;
      }
    } else if (/[0-7]/.test(next)) {
      const match = input.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)!;
      out += String.fromCharCode(parseInt(match[0], 8));
      i += 1 + match[0].length;
      continue;
    } else if (next in ANSI_ESCAPES) {
      out += ANSI_ESCAPES[next];
      i += 2;
      continue;
    }
    out += `\\${next}`;
    i += 2;
  }
  throw new TokenizeError("unterminatedQuote");
}

/** bash 形式で分割する */
export function tokenizeBash(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inToken = false;
  let i = 0;
  const push = () => {
    if (inToken) tokens.push(current);
    current = "";
    inToken = false;
  };

  while (i < input.length) {
    const c = input[i];
    if (c === "\\") {
      const next = input[i + 1];
      if (next === "\n" || (next === "\r" && input[i + 2] === "\n")) {
        i += next === "\r" ? 3 : 2; // 行継続
        continue;
      }
      if (next !== undefined) {
        current += next;
        inToken = true;
      }
      i += 2;
      continue;
    }
    if (c === "'") {
      const end = input.indexOf("'", i + 1);
      if (end === -1) throw new TokenizeError("unterminatedQuote");
      current += input.slice(i + 1, end);
      inToken = true;
      i = end + 1;
      continue;
    }
    if (c === "$" && input[i + 1] === "'") {
      const [value, next] = readAnsiC(input, i + 2);
      current += value;
      inToken = true;
      i = next;
      continue;
    }
    if (c === '"') {
      i += 1;
      inToken = true;
      let closed = false;
      while (i < input.length) {
        const d = input[i];
        if (d === '"') {
          closed = true;
          i += 1;
          break;
        }
        if (d === "\\" && i + 1 < input.length) {
          const next = input[i + 1];
          if (next === "\n") {
            i += 2;
            continue;
          }
          if ('"\\$`'.includes(next)) {
            current += next;
            i += 2;
            continue;
          }
        }
        current += d;
        i += 1;
      }
      if (!closed) throw new TokenizeError("unterminatedQuote");
      continue;
    }
    if (/\s/.test(c)) {
      push();
      i += 1;
      continue;
    }
    current += c;
    inToken = true;
    i += 1;
  }
  push();
  return tokens;
}

/**
 * コマンドプロンプト形式で分割する。
 * cmd.exe の規則（^ で次の文字をそのまま扱う。"..." の中では ^ は通常の文字）で展開したあと、
 * Windows の実行ファイルが引数を分割する規則（"..." による囲み、\" による引用符のエスケープ）で分割する。
 */
export function tokenizeCmd(input: string): string[] {
  // 1. cmd.exe によるエスケープの展開
  let expanded = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      quoted = !quoted;
      expanded += c;
    } else if (c === "^" && !quoted) {
      const next = input[i + 1];
      if (next === "\r" && input[i + 2] === "\n") {
        i += 2;
      } else if (next === "\n") {
        i += 1;
      } else if (next !== undefined) {
        expanded += next;
        i += 1;
      }
    } else {
      expanded += c;
    }
  }

  // 2. 実行ファイル側での引数の分割（MSVC の規則）
  const tokens: string[] = [];
  let current = "";
  let inToken = false;
  let inQuotes = false;
  for (let i = 0; i < expanded.length; i++) {
    const c = expanded[i];
    if (c === "\\") {
      let count = 0;
      while (expanded[i + count] === "\\") count++;
      if (expanded[i + count] === '"') {
        current += "\\".repeat(Math.floor(count / 2));
        if (count % 2 === 1) {
          current += '"';
          i += count;
        } else {
          i += count - 1;
        }
      } else {
        current += "\\".repeat(count);
        i += count - 1;
      }
      inToken = true;
      continue;
    }
    if (c === '"') {
      if (inQuotes && expanded[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      inToken = true;
      continue;
    }
    if (/\s/.test(c) && !inQuotes) {
      if (inToken) tokens.push(current);
      current = "";
      inToken = false;
      continue;
    }
    current += c;
    inToken = true;
  }
  if (inQuotes) throw new TokenizeError("unterminatedQuote");
  if (inToken) tokens.push(current);
  return tokens;
}

export function tokenize(input: string): string[] {
  return isCmdSyntax(input) ? tokenizeCmd(input) : tokenizeBash(input);
}
