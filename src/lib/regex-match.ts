export type RegexMatchInfo = {
  index: number;
  match: string;
  groups: string[];
  namedGroups: Record<string, string>;
};

export type RegexMatchResult = {
  matches: RegexMatchInfo[];
  error: string | null;
};

const MAX_MATCHES = 5000;

/** パターン・フラグ・対象テキストからマッチ結果を求める（不正な正規表現はエラーとして返す） */
export function getRegexMatches(
  pattern: string,
  flags: string,
  text: string
): RegexMatchResult {
  if (!pattern) return { matches: [], error: null };

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch (error) {
    return {
      matches: [],
      error: error instanceof Error ? error.message : "無効な正規表現です。",
    };
  }

  const matches: RegexMatchInfo[] = [];

  if (flags.includes("g")) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        match: match[0],
        groups: match.slice(1).map((g) => g ?? ""),
        namedGroups: match.groups ? { ...match.groups } : {},
      });
      if (match[0].length === 0) regex.lastIndex += 1;
      if (matches.length >= MAX_MATCHES) break;
    }
  } else {
    const match = regex.exec(text);
    if (match) {
      matches.push({
        index: match.index,
        match: match[0],
        groups: match.slice(1).map((g) => g ?? ""),
        namedGroups: match.groups ? { ...match.groups } : {},
      });
    }
  }

  return { matches, error: null };
}

export type TextSegment = {
  text: string;
  isMatch: boolean;
};

/** マッチ結果をもとに、テキストをハイライト表示用のセグメントへ分割する */
export function buildHighlightSegments(
  text: string,
  matches: RegexMatchInfo[]
): TextSegment[] {
  if (matches.length === 0) return [{ text, isMatch: false }];

  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const m of matches) {
    if (m.index > cursor) {
      segments.push({ text: text.slice(cursor, m.index), isMatch: false });
    }
    const end = m.index + m.match.length;
    if (end > m.index) {
      segments.push({ text: text.slice(m.index, end), isMatch: true });
    }
    cursor = Math.max(cursor, end);
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), isMatch: false });
  }

  return segments;
}
