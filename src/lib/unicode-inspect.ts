/** 文字列を書記素（見た目の1文字）とコードポイントに分解し、不可視文字や特殊な空白を判別する */

export type CodePointInfo = {
  /** コードポイントの値（孤立サロゲートの場合はそのコード単位） */
  value: number;
  /** U+XXXX 形式 */
  hex: string;
  /** 入力中のコードポイント位置（1始まり） */
  index: number;
  line: number;
  column: number;
  /** 不可視・特殊文字の場合の短い名前（例: NBSP, ZWSP） */
  special?: string;
  /** 表示用の記号（不可視文字を可視化するため） */
  symbol?: string;
};

export type GraphemeInfo = { text: string; codePoints: CodePointInfo[] };

export type UnicodeStats = {
  graphemes: number;
  codePoints: number;
  utf16Units: number;
  utf8Bytes: number;
  lf: number;
  crlf: number;
  cr: number;
  specials: number;
};

/** 名前で区別したい代表的な不可視文字・空白・制御文字 */
const SPECIALS: Record<number, [string, string]> = {
  0x09: ["TAB", "→"],
  0x0a: ["LF", "↵"],
  0x0d: ["CR", "␍"],
  0x20: ["SPACE", "·"],
  0xa0: ["NBSP", "⍽"],
  0xad: ["SHY", "-"],
  0x34f: ["CGJ", "◌"],
  0x180e: ["MVS", "◌"],
  0x2000: ["EN QUAD", "␣"],
  0x2001: ["EM QUAD", "␣"],
  0x2002: ["EN SPACE", "␣"],
  0x2003: ["EM SPACE", "␣"],
  0x2004: ["3/EM SPACE", "␣"],
  0x2005: ["4/EM SPACE", "␣"],
  0x2006: ["6/EM SPACE", "␣"],
  0x2007: ["FIGURE SPACE", "␣"],
  0x2008: ["PUNCTUATION SPACE", "␣"],
  0x2009: ["THIN SPACE", "␣"],
  0x200a: ["HAIR SPACE", "␣"],
  0x200b: ["ZWSP", "◌"],
  0x200c: ["ZWNJ", "◌"],
  0x200d: ["ZWJ", "◌"],
  0x200e: ["LRM", "◌"],
  0x200f: ["RLM", "◌"],
  0x2028: ["LINE SEPARATOR", "↵"],
  0x2029: ["PARAGRAPH SEPARATOR", "¶"],
  0x202a: ["LRE", "◌"],
  0x202b: ["RLE", "◌"],
  0x202c: ["PDF", "◌"],
  0x202d: ["LRO", "◌"],
  0x202e: ["RLO", "◌"],
  0x202f: ["NNBSP", "⍽"],
  0x205f: ["MMSP", "␣"],
  0x2060: ["WJ", "◌"],
  0x2066: ["LRI", "◌"],
  0x2067: ["RLI", "◌"],
  0x2068: ["FSI", "◌"],
  0x2069: ["PDI", "◌"],
  0x3000: ["IDEOGRAPHIC SPACE", "□"],
  0xfe0e: ["VS15", "◌"],
  0xfe0f: ["VS16", "◌"],
  0xfeff: ["BOM / ZWNBSP", "◌"],
};

function classify(value: number, char: string): [string, string] | undefined {
  const known = SPECIALS[value];
  if (known) return known;
  if (value >= 0xd800 && value <= 0xdfff) return ["UNPAIRED SURROGATE", "�"];
  if (/\p{Cc}/u.test(char)) return ["CONTROL", "␀"];
  if (/\p{Cf}/u.test(char)) return ["FORMAT", "◌"];
  if (/\p{Zs}/u.test(char)) return ["SPACE SEPARATOR", "␣"];
  if (value >= 0xfe00 && value <= 0xfe0f) return ["VARIATION SELECTOR", "◌"];
  if (value >= 0xe0100 && value <= 0xe01ef) return ["VARIATION SELECTOR", "◌"];
  if (value >= 0xe0000 && value <= 0xe007f) return ["TAG", "◌"];
  return undefined;
}

export function toHex(value: number): string {
  return `U+${value.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** 結合文字（Mark）かどうか。見た目は前の文字に重なる */
export function isCombiningMark(char: string): boolean {
  return /\p{M}/u.test(char);
}

export function inspectUnicode(text: string): { graphemes: GraphemeInfo[]; stats: UnicodeStats } {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const graphemes: GraphemeInfo[] = [];
  const stats: UnicodeStats = {
    graphemes: 0,
    codePoints: 0,
    utf16Units: text.length,
    utf8Bytes: new TextEncoder().encode(text).length,
    lf: 0,
    crlf: 0,
    cr: 0,
    specials: 0,
  };
  let line = 1;
  let column = 1;

  for (const { segment } of segmenter.segment(text)) {
    const codePoints: CodePointInfo[] = [];
    // for...of はサロゲートペアを1文字として扱う（孤立サロゲートはそのまま1コード単位）
    for (const char of segment) {
      const value = char.codePointAt(0)!;
      stats.codePoints += 1;
      const special = classify(value, char);
      if (special && value !== 0x20) stats.specials += 1;
      codePoints.push({
        value,
        hex: toHex(value),
        index: stats.codePoints,
        line,
        column,
        special: special?.[0],
        symbol: special?.[1],
      });
      column += 1;
    }
    if (segment === "\r\n") stats.crlf += 1;
    else if (segment === "\n") stats.lf += 1;
    else if (segment === "\r") stats.cr += 1;
    if (segment === "\r\n" || segment === "\n" || segment === "\r") {
      line += 1;
      column = 1;
    }
    graphemes.push({ text: segment, codePoints });
  }
  stats.graphemes = graphemes.length;
  return { graphemes, stats };
}

export const NORMALIZATION_FORMS = ["NFC", "NFD", "NFKC", "NFKD"] as const;
export type NormalizationForm = (typeof NORMALIZATION_FORMS)[number];

/** 正規化の結果を返す（入力そのものは変更しない） */
export function normalizeAll(text: string) {
  return NORMALIZATION_FORMS.map((form) => {
    const normalized = text.normalize(form);
    return {
      form,
      text: normalized,
      changed: normalized !== text,
      codePoints: Array.from(normalized).length,
    };
  });
}

/** textarea上の位置（改行がLFに正規化された位置）を、元の文字列での位置に変換する */
export function toRawIndex(raw: string, normalizedIndex: number): number {
  let index = 0;
  for (let i = 0; i < normalizedIndex && index < raw.length; i++) {
    index += raw[index] === "\r" && raw[index + 1] === "\n" ? 2 : 1;
  }
  return index;
}

/**
 * textarea の value は改行が常にLFへ正規化されるため、編集後の値をそのまま使うとCR・CRLFが失われる。
 * 正規化済みの値と編集後の値で共通する先頭・末尾は元の文字列を残し、変更された部分だけを差し替える。
 */
export function mergeTextareaEdit(raw: string, next: string): string {
  const normalized = raw.replace(/\r\n?/g, "\n");
  if (normalized === next) return raw;
  let start = 0;
  while (start < normalized.length && start < next.length && normalized[start] === next[start]) start++;
  let end = 0;
  while (
    end < normalized.length - start &&
    end < next.length - start &&
    normalized[normalized.length - 1 - end] === next[next.length - 1 - end]
  ) {
    end++;
  }
  return (
    raw.slice(0, toRawIndex(raw, start)) +
    next.slice(start, next.length - end) +
    raw.slice(toRawIndex(raw, normalized.length - end))
  );
}
