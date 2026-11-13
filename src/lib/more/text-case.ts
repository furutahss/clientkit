/** 単語分割とケース変換。camelCase・PascalCase・snake_case・kebab-case・略語（HTTPServer）・空白区切りを扱う */

export function splitWords(input: string): string[] {
  return input
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

export const CASES = {
  camel: (s: string) => splitWords(s).map((w, i) => (i ? cap(w) : w.toLowerCase())).join(""),
  pascal: (s: string) => splitWords(s).map(cap).join(""),
  snake: (s: string) => splitWords(s).map((w) => w.toLowerCase()).join("_"),
  kebab: (s: string) => splitWords(s).map((w) => w.toLowerCase()).join("-"),
  constant: (s: string) => splitWords(s).map((w) => w.toUpperCase()).join("_"),
  dot: (s: string) => splitWords(s).map((w) => w.toLowerCase()).join("."),
  path: (s: string) => splitWords(s).map((w) => w.toLowerCase()).join("/"),
  title: (s: string) => splitWords(s).map(cap).join(" "),
  sentence: (s: string) => { const w = splitWords(s).map((x) => x.toLowerCase()).join(" "); return w.charAt(0).toUpperCase() + w.slice(1); },
  lower: (s: string) => splitWords(s).map((w) => w.toLowerCase()).join(" "),
  upper: (s: string) => splitWords(s).map((w) => w.toUpperCase()).join(" "),
} as const;
export type CaseName = keyof typeof CASES;

/** 末尾の複数形を単数形にする簡易版（配列要素の型名用）。英語の規則変化のみ */
export function singularize(word: string): string {
  if (/ies$/i.test(word)) return word.replace(/ies$/i, "y");
  if (/(ss|us|is)$/i.test(word)) return word;
  if (/(ches|shes|xes|zes|ses)$/i.test(word)) return word.replace(/es$/i, "");
  if (/s$/i.test(word) && word.length > 1) return word.slice(0, -1);
  return word;
}
