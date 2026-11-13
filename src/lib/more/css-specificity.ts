export type Spec = [number, number, number];

const add = (a: Spec, b: Spec): Spec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const cmpSpec = (a: Spec, b: Spec) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const maxSpec = (list: Spec[]): Spec => list.reduce((m, s) => (cmpSpec(s, m) > 0 ? s : m), [0, 0, 0] as Spec);

/** セレクターリストをトップレベルのカンマで分割する（括弧・角括弧・文字列の中は無視） */
export function splitSelectors(src: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "", quote = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) { cur += c; if (c === "\\") cur += src[++i] ?? ""; else if (c === quote) quote = ""; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === "\\") { cur += c + (src[++i] ?? ""); continue; }
    if (c === "(" || c === "[") depth++;
    if (c === ")" || c === "]") depth--;
    if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const LEGACY_PSEUDO_ELEMENTS = new Set(["before", "after", "first-line", "first-letter"]);

/** Selectors Level 4 に基づく詳細度（a: ID, b: クラス・属性・疑似クラス, c: 要素・疑似要素） */
export function specificity(selector: string): Spec {
  let s: Spec = [0, 0, 0];
  let i = 0;
  const n = selector.length;
  const ident = () => { const m = /^(?:[\w-]|\\.|[^\x00-\x7f])+/.exec(selector.slice(i)); const v = m?.[0] ?? ""; i += v.length; return v; };
  const skipParen = (): string => { let d = 0, j = i; for (; j < n; j++) { if (selector[j] === "(") d++; else if (selector[j] === ")" && --d === 0) break; } const inner = selector.slice(i + 1, j); i = j + 1; return inner; };
  while (i < n) {
    const c = selector[i];
    if (/\s|[>+~|]/.test(c)) { i++; continue; }
    if (c === "#") { i++; ident(); s = add(s, [1, 0, 0]); }
    else if (c === ".") { i++; ident(); s = add(s, [0, 1, 0]); }
    else if (c === "[") { let d = 0, quote = ""; for (; i < n; i++) { const ch = selector[i]; if (quote) { if (ch === quote) quote = ""; } else if (ch === '"' || ch === "'") quote = ch; else if (ch === "[") d++; else if (ch === "]" && --d === 0) { i++; break; } } s = add(s, [0, 1, 0]); }
    else if (c === ":") {
      i++;
      if (selector[i] === ":") { i++; ident(); if (selector[i] === "(") skipParen(); s = add(s, [0, 0, 1]); continue; }
      const name = ident().toLowerCase();
      if (LEGACY_PSEUDO_ELEMENTS.has(name)) { s = add(s, [0, 0, 1]); continue; }
      if (selector[i] === "(") {
        const inner = skipParen();
        if (name === "where") continue;
        if (name === "is" || name === "not" || name === "has" || name === "matches" || name === "-webkit-any" || name === "-moz-any") { s = add(s, maxSpec(splitSelectors(inner).map(specificity))); continue; }
        if (name === "nth-child" || name === "nth-last-child") { const of = /\sof\s+([\s\S]+)$/i.exec(inner); s = add(s, [0, 1, 0]); if (of) s = add(s, maxSpec(splitSelectors(of[1]).map(specificity))); continue; }
      }
      s = add(s, [0, 1, 0]);
    }
    else if (c === "*") i++;
    else if (c === "&") { i++; } // ネスト: 親セレクターの詳細度は含めない（親が決まらないため）
    else { const before = i; ident(); if (i === before) i++; else s = add(s, [0, 0, 1]); }
  }
  return s;
}

export const formatSpec = (s: Spec) => `(${s.join(",")})`;
