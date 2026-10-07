/**
 * 日本語テキストの表記ゆれを整え、コピペで混入する不可視文字や機種依存文字を検出・除去する純粋関数群。
 * 各変換は置き換えた件数も返し、項目別のサマリーに使う。
 */

export type NormalizeOptions = {
  /** 不可視文字（ゼロ幅スペース・制御文字など）を除去し、ノーブレークスペースは通常のスペースにする */
  removeInvisible: boolean;
  unicode: "none" | "nfc" | "nfkc";
  /** 「か」+「゛」などの濁点・半濁点を1文字に統合する */
  combineDakuten: boolean;
  halfwidthKana: boolean;
  fullwidthAlnum: boolean;
  /** 括弧・感嘆符などの記号の全角／半角を統一する */
  symbols: "none" | "half" | "full";
  dependentChars: boolean;
  itaiji: boolean;
  /** ハイフン・ダッシュ類の統一先（カタカナ・ひらがなの後ろは長音符「ー」にする） */
  dashes: "none" | "-" | "－" | "—";
  tildes: "none" | "〜" | "～" | "~";
  punctuation: "none" | "、。" | "，．" | ",.";
  fullwidthSpace: boolean;
  collapseSpaces: boolean;
  trimLines: boolean;
  blankLines: "keep" | "collapse" | "remove";
  newline: "keep" | "lf" | "crlf" | "cr";
};

export type NormalizeStep = keyof NormalizeOptions;

export const NO_NORMALIZE_OPTIONS: NormalizeOptions = {
  removeInvisible: false,
  unicode: "none",
  combineDakuten: false,
  halfwidthKana: false,
  fullwidthAlnum: false,
  symbols: "none",
  dependentChars: false,
  itaiji: false,
  dashes: "none",
  tildes: "none",
  punctuation: "none",
  fullwidthSpace: false,
  collapseSpaces: false,
  trimLines: false,
  blankLines: "keep",
  newline: "keep",
};

export type PresetId = "csv" | "database" | "proofreading" | "invisible";

export const PRESETS: Record<PresetId, NormalizeOptions> = {
  csv: {
    ...NO_NORMALIZE_OPTIONS,
    removeInvisible: true,
    unicode: "nfc",
    combineDakuten: true,
    halfwidthKana: true,
    fullwidthAlnum: true,
    dependentChars: true,
    dashes: "-",
    fullwidthSpace: true,
    trimLines: true,
    newline: "crlf",
  },
  database: {
    ...NO_NORMALIZE_OPTIONS,
    removeInvisible: true,
    unicode: "nfkc",
    combineDakuten: true,
    halfwidthKana: true,
    fullwidthAlnum: true,
    symbols: "half",
    dependentChars: true,
    dashes: "-",
    tildes: "〜",
    fullwidthSpace: true,
    collapseSpaces: true,
    trimLines: true,
    newline: "lf",
  },
  proofreading: {
    ...NO_NORMALIZE_OPTIONS,
    removeInvisible: true,
    unicode: "nfc",
    combineDakuten: true,
    halfwidthKana: true,
    fullwidthAlnum: true,
    dependentChars: true,
    dashes: "-",
    tildes: "〜",
    punctuation: "、。",
    trimLines: true,
    blankLines: "collapse",
  },
  invisible: { ...NO_NORMALIZE_OPTIONS, removeInvisible: true },
};

type StepResult = { text: string; count: number };

/** 正規表現に一致した箇所を置き換え、置き換えて変化した件数を数える */
function replaceCount(text: string, pattern: RegExp, replacer: (match: string, ...groups: string[]) => string): StepResult {
  let count = 0;
  const result = text.replace(pattern, (match: string, ...rest: unknown[]) => {
    const groups = rest.filter((value): value is string => typeof value === "string");
    const next = replacer(match, ...groups);
    if (next !== match) count += 1;
    return next;
  });
  return { text: result, count };
}

function mapChars(text: string, table: Record<string, string>): StepResult {
  const keys = Object.keys(table)
    .sort((a, b) => b.length - a.length)
    .map((key) => key.replace(/[\\^$.*+?()[\]{}|-]/g, "\\$&"));
  if (keys.length === 0) return { text, count: 0 };
  return replaceCount(text, new RegExp(keys.join("|"), "gu"), (match) => table[match] ?? match);
}

// ---------------------------------------------------------------------------
// 不可視文字
// ---------------------------------------------------------------------------

export type InvisibleCategory = "zeroWidth" | "space" | "bidi" | "control" | "bom" | "lineSeparator" | "tag" | "filler";

type InvisibleInfo = { name: string; category: InvisibleCategory; replacement: string };

const INVISIBLE: Record<number, InvisibleInfo> = {
  0x200b: { name: "ZERO WIDTH SPACE", category: "zeroWidth", replacement: "" },
  0x200c: { name: "ZERO WIDTH NON-JOINER", category: "zeroWidth", replacement: "" },
  0x200d: { name: "ZERO WIDTH JOINER", category: "zeroWidth", replacement: "" },
  0x2060: { name: "WORD JOINER", category: "zeroWidth", replacement: "" },
  0x180e: { name: "MONGOLIAN VOWEL SEPARATOR", category: "zeroWidth", replacement: "" },
  0x00ad: { name: "SOFT HYPHEN", category: "zeroWidth", replacement: "" },
  0xfeff: { name: "BYTE ORDER MARK", category: "bom", replacement: "" },
  0x00a0: { name: "NO-BREAK SPACE", category: "space", replacement: " " },
  0x2007: { name: "FIGURE SPACE", category: "space", replacement: " " },
  0x202f: { name: "NARROW NO-BREAK SPACE", category: "space", replacement: " " },
  0x2028: { name: "LINE SEPARATOR", category: "lineSeparator", replacement: "\n" },
  0x2029: { name: "PARAGRAPH SEPARATOR", category: "lineSeparator", replacement: "\n" },
  0x3164: { name: "HANGUL FILLER", category: "filler", replacement: "" },
  0x115f: { name: "HANGUL CHOSEONG FILLER", category: "filler", replacement: "" },
  0x1160: { name: "HANGUL JUNGSEONG FILLER", category: "filler", replacement: "" },
  0xffa0: { name: "HALFWIDTH HANGUL FILLER", category: "filler", replacement: "" },
  0x2800: { name: "BRAILLE PATTERN BLANK", category: "filler", replacement: "" },
};
const BIDI_NAMES: Record<number, string> = {
  0x200e: "LEFT-TO-RIGHT MARK",
  0x200f: "RIGHT-TO-LEFT MARK",
  0x061c: "ARABIC LETTER MARK",
  0x202a: "LEFT-TO-RIGHT EMBEDDING",
  0x202b: "RIGHT-TO-LEFT EMBEDDING",
  0x202c: "POP DIRECTIONAL FORMATTING",
  0x202d: "LEFT-TO-RIGHT OVERRIDE",
  0x202e: "RIGHT-TO-LEFT OVERRIDE",
  0x2066: "LEFT-TO-RIGHT ISOLATE",
  0x2067: "RIGHT-TO-LEFT ISOLATE",
  0x2068: "FIRST STRONG ISOLATE",
  0x2069: "POP DIRECTIONAL ISOLATE",
};

/** 不可視文字であればその情報を返す（タブ・改行は対象外） */
export function invisibleInfo(codePoint: number): InvisibleInfo | null {
  if (INVISIBLE[codePoint]) return INVISIBLE[codePoint];
  if (BIDI_NAMES[codePoint]) return { name: BIDI_NAMES[codePoint], category: "bidi", replacement: "" };
  if ((codePoint <= 0x1f && codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d) || (codePoint >= 0x7f && codePoint <= 0x9f)) {
    return { name: `CONTROL U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`, category: "control", replacement: "" };
  }
  if (codePoint >= 0xe0000 && codePoint <= 0xe007f) return { name: "TAG CHARACTER", category: "tag", replacement: "" };
  return null;
}

/** 異体字セレクタ（VS1〜16）または IVS（VS17〜256）か */
export function variationSelectorKind(codePoint: number): "svs" | "ivs" | null {
  if (codePoint >= 0xfe00 && codePoint <= 0xfe0f) return "svs";
  if (codePoint >= 0xe0100 && codePoint <= 0xe01ef) return "ivs";
  return null;
}

function removeInvisible(text: string): StepResult {
  let count = 0;
  let out = "";
  for (const char of text) {
    const info = invisibleInfo(char.codePointAt(0)!);
    if (info) {
      count += 1;
      out += info.replacement;
    } else {
      out += char;
    }
  }
  return { text: out, count };
}

// ---------------------------------------------------------------------------
// 文字種の変換
// ---------------------------------------------------------------------------

const HALF_KANA = "｡｢｣､･ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ";
const FULL_KANA = "。「」、・ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン゛゜";
const KANA_TABLE: Record<string, string> = {};
[...HALF_KANA].forEach((char, i) => {
  KANA_TABLE[char] = FULL_KANA[i];
});
// 濁点・半濁点付きの半角カナは2文字で1文字になる
for (const [base, voiced] of Object.entries({ ｶ: "ガ", ｷ: "ギ", ｸ: "グ", ｹ: "ゲ", ｺ: "ゴ", ｻ: "ザ", ｼ: "ジ", ｽ: "ズ", ｾ: "ゼ", ｿ: "ゾ", ﾀ: "ダ", ﾁ: "ヂ", ﾂ: "ヅ", ﾃ: "デ", ﾄ: "ド", ﾊ: "バ", ﾋ: "ビ", ﾌ: "ブ", ﾍ: "ベ", ﾎ: "ボ", ｳ: "ヴ", ﾜ: "ヷ", ｦ: "ヺ" })) {
  KANA_TABLE[`${base}ﾞ`] = voiced;
}
for (const [base, semi] of Object.entries({ ﾊ: "パ", ﾋ: "ピ", ﾌ: "プ", ﾍ: "ペ", ﾎ: "ポ" })) {
  KANA_TABLE[`${base}ﾟ`] = semi;
}

export function halfwidthKanaToFull(text: string): StepResult {
  return mapChars(text, KANA_TABLE);
}

export function fullwidthAlnumToHalf(text: string): StepResult {
  return replaceCount(text, /[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** 記号の統一の対象（，．は句読点、－～はダッシュ・チルダとして別に扱う） */
const SYMBOLS_HALF = "!\"#$%&'()*+/:;<=>?@[\\]^_`{|}";
const SYMBOLS_FULL = "！＂＃＄％＆＇（）＊＋／：；＜＝＞？＠［＼］＾＿｀｛｜｝";

export function unifySymbols(text: string, target: "half" | "full"): StepResult {
  const table: Record<string, string> = {};
  [...SYMBOLS_FULL].forEach((full, i) => {
    if (target === "half") table[full] = SYMBOLS_HALF[i];
    else table[SYMBOLS_HALF[i]] = full;
  });
  if (target === "half") {
    table["“"] = '"';
    table["”"] = '"';
    table["‘"] = "'";
    table["’"] = "'";
  }
  return mapChars(text, table);
}

/** 濁点・半濁点（結合文字・単独の文字）を前の文字と合成する */
export function combineDakuten(text: string): StepResult {
  return replaceCount(text, /([\u3040-\u30ff])([\u3099\u309a\u309b\u309c])/g, (match, base, mark) => {
    const combining = mark === "\u309b" ? "\u3099" : mark === "\u309c" ? "\u309a" : mark;
    const composed = (base + combining).normalize("NFC");
    return composed.length === 1 ? composed : match;
  });
}

export function normalizeUnicode(text: string, form: "nfc" | "nfkc"): StepResult {
  // 文字ごとに比較して件数を数える（全体を一度に正規化すると件数がわからないため、変化した文字のまとまりを数える）
  const normalized = text.normalize(form.toUpperCase() as "NFC" | "NFKC");
  if (normalized === text) return { text, count: 0 };
  let count = 0;
  const segments = text.match(/\P{M}\p{M}*/gu) ?? [];
  for (const segment of segments) {
    if (segment.normalize(form.toUpperCase() as "NFC" | "NFKC") !== segment) count += 1;
  }
  return { text: normalized, count: Math.max(count, 1) };
}

/** 機種依存文字（丸数字・ローマ数字・単位記号・合字など）の展開表 */
export const DEPENDENT_CHARS: Record<string, string> = {
  ...Object.fromEntries([..."①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"].map((c, i) => [c, `(${i + 1})`])),
  ...Object.fromEntries([..."ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ"].map((c, i) => [c, ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][i]])),
  ...Object.fromEntries([..."ⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹⅺⅻ"].map((c, i) => [c, ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"][i]])),
  "㈱": "(株)",
  "㈲": "(有)",
  "㈹": "(代)",
  "㈳": "(社)",
  "㈶": "(財)",
  "㈻": "(学)",
  "㈼": "(監)",
  "㈽": "(企)",
  "㈿": "(協)",
  "㍿": "株式会社",
  "㊤": "(上)",
  "㊥": "(中)",
  "㊦": "(下)",
  "㊧": "(左)",
  "㊨": "(右)",
  "㌔": "キロ",
  "㍉": "ミリ",
  "㌢": "センチ",
  "㍍": "メートル",
  "㌘": "グラム",
  "㌧": "トン",
  "㌃": "アール",
  "㌶": "ヘクタール",
  "㍑": "リットル",
  "㍗": "ワット",
  "㌍": "カロリー",
  "㌦": "ドル",
  "㌣": "セント",
  "㌫": "パーセント",
  "㍊": "ミリバール",
  "㌻": "ページ",
  "㍻": "平成",
  "㍼": "昭和",
  "㍽": "大正",
  "㍾": "明治",
  "㋿": "令和",
  "㎜": "mm",
  "㎝": "cm",
  "㎞": "km",
  "㎎": "mg",
  "㎏": "kg",
  "㏄": "cc",
  "㎡": "m2",
  "㎥": "m3",
  "№": "No.",
  "℡": "TEL",
  "㏍": "K.K.",
};

export function expandDependentChars(text: string): StepResult {
  return mapChars(text, DEPENDENT_CHARS);
}

/** 旧字体・異体字のうち、置き換えても意味が変わらない代表的なもの */
export const ITAIJI: Record<string, string> = {
  髙: "高",
  﨑: "崎",
  嵜: "崎",
  德: "徳",
  濵: "浜",
  濱: "浜",
  邉: "辺",
  邊: "辺",
  澤: "沢",
  齋: "斎",
  齊: "斉",
  國: "国",
  學: "学",
  舊: "旧",
  體: "体",
  廣: "広",
  櫻: "桜",
  嶋: "島",
  眞: "真",
  惠: "恵",
  榮: "栄",
  圓: "円",
  實: "実",
  壽: "寿",
  會: "会",
  傳: "伝",
  發: "発",
  戰: "戦",
  藝: "芸",
  檢: "検",
  驛: "駅",
  來: "来",
  黑: "黒",
  圖: "図",
  樂: "楽",
  萬: "万",
  豐: "豊",
  變: "変",
  區: "区",
  縣: "県",
  氣: "気",
  畫: "画",
  號: "号",
  關: "関",
  鐵: "鉄",
};

export function convertItaiji(text: string): StepResult {
  return mapChars(text, ITAIJI);
}

// ---------------------------------------------------------------------------
// ハイフン・チルダ・句読点
// ---------------------------------------------------------------------------

const DASH_CHARS = "\u002d\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uff0d\ufe63\u2043\u30fc\uff70";
const KANA_BEFORE = /[\u3041-\u3096\u309d\u309e\u30a1-\u30fa\u30fd\u30fe\u30fc]$/;

/**
 * ハイフン・ダッシュ・マイナス・長音符を統一する。
 * カタカナ・ひらがなの直後にあるもの（「コンピュ－タ」など）は長音符「ー」に、それ以外は指定の文字にする。
 */
export function unifyDashes(text: string, target: string): StepResult {
  let count = 0;
  let out = "";
  for (const char of text) {
    if (DASH_CHARS.includes(char)) {
      const next = KANA_BEFORE.test(out) ? "ー" : target;
      if (next !== char) count += 1;
      out += next;
    } else {
      out += char;
    }
  }
  return { text: out, count };
}

/** 波ダッシュ・全角チルダなどを統一する。半角の ~ は URL（/~user など）を壊さないよう、数字・日本語に隣接するものだけを対象にする */
export function unifyTildes(text: string, target: string): StepResult {
  const near = "[0-9\\u3040-\\u30ff\\u3400-\\u9fff\\uff10-\\uff19]";
  return replaceCount(text, new RegExp(`[\\u301c\\uff5e\\u223c\\u02dc]|(?<=${near})~|~(?=${near})`, "g"), () => target);
}

const JAPANESE_BEFORE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uff66-\uff9f）」』】]$/;

/** 句読点を統一する。半角の , . は日本語の直後にあるものだけを対象にする（数値・英文を壊さないため） */
export function unifyPunctuation(text: string, target: "、。" | "，．" | ",."): StepResult {
  const [comma, period] = [...target];
  let count = 0;
  let out = "";
  for (const char of text) {
    let next = char;
    if (char === "、" || char === "，") next = comma;
    else if (char === "。" || char === "．") next = period;
    else if ((char === "," || char === ".") && JAPANESE_BEFORE.test(out)) next = char === "," ? comma : period;
    if (next !== char) count += 1;
    out += next;
  }
  return { text: out, count };
}

// ---------------------------------------------------------------------------
// 空白・改行
// ---------------------------------------------------------------------------

export function fullwidthSpaceToHalf(text: string): StepResult {
  return replaceCount(text, /\u3000/g, () => " ");
}

export function collapseSpaces(text: string): StepResult {
  return replaceCount(text, /[ \t]{2,}/g, () => " ");
}

export function trimLines(text: string): StepResult {
  return replaceCount(text, /^[ \t\u3000]+|[ \t\u3000]+$/gm, () => "");
}

export function normalizeBlankLines(text: string, mode: "collapse" | "remove"): StepResult {
  // 空白だけの行も空行として扱う
  return mode === "remove"
    ? replaceCount(text, /(\r\n|\r|\n)(?:[ \t\u3000]*(?:\r\n|\r|\n))+/g, (_, newline) => newline)
    : replaceCount(text, /(\r\n|\r|\n)[ \t\u3000]*(\r\n|\r|\n)(?:[ \t\u3000]*(?:\r\n|\r|\n))+/g, (_, a, b) => a + b);
}

export function normalizeNewlines(text: string, mode: "lf" | "crlf" | "cr"): StepResult {
  const target = mode === "lf" ? "\n" : mode === "crlf" ? "\r\n" : "\r";
  return replaceCount(text, /\r\n|\r|\n/g, () => target);
}

// ---------------------------------------------------------------------------
// まとめて適用
// ---------------------------------------------------------------------------

export type NormalizeResult = { text: string; counts: Partial<Record<NormalizeStep, number>> };

export function normalizeText(input: string, options: NormalizeOptions): NormalizeResult {
  const counts: Partial<Record<NormalizeStep, number>> = {};
  let text = input;
  const apply = (step: NormalizeStep, fn: (value: string) => StepResult) => {
    const result = fn(text);
    text = result.text;
    if (result.count > 0) counts[step] = (counts[step] ?? 0) + result.count;
  };

  if (options.removeInvisible) apply("removeInvisible", removeInvisible);
  if (options.combineDakuten) apply("combineDakuten", combineDakuten);
  if (options.halfwidthKana) apply("halfwidthKana", halfwidthKanaToFull);
  if (options.dependentChars) apply("dependentChars", expandDependentChars);
  if (options.unicode !== "none") {
    const form = options.unicode;
    apply("unicode", (value) => normalizeUnicode(value, form));
  }
  if (options.fullwidthAlnum) apply("fullwidthAlnum", fullwidthAlnumToHalf);
  if (options.symbols !== "none") {
    const target = options.symbols;
    apply("symbols", (value) => unifySymbols(value, target));
  }
  if (options.itaiji) apply("itaiji", convertItaiji);
  if (options.dashes !== "none") {
    const target = options.dashes;
    apply("dashes", (value) => unifyDashes(value, target));
  }
  if (options.tildes !== "none") {
    const target = options.tildes;
    apply("tildes", (value) => unifyTildes(value, target));
  }
  if (options.punctuation !== "none") {
    const target = options.punctuation;
    apply("punctuation", (value) => unifyPunctuation(value, target));
  }
  if (options.fullwidthSpace) apply("fullwidthSpace", fullwidthSpaceToHalf);
  if (options.collapseSpaces) apply("collapseSpaces", collapseSpaces);
  if (options.trimLines) apply("trimLines", trimLines);
  if (options.blankLines !== "keep") {
    const mode = options.blankLines;
    apply("blankLines", (value) => normalizeBlankLines(value, mode));
  }
  if (options.newline !== "keep") {
    const mode = options.newline;
    apply("newline", (value) => normalizeNewlines(value, mode));
  }
  return { text, counts };
}

// ---------------------------------------------------------------------------
// 検出
// ---------------------------------------------------------------------------

export type DetectionKind = "invisible" | "dependent" | "variationSelector";

export type Detection = {
  /** UTF-16 での位置 */
  index: number;
  length: number;
  line: number;
  column: number;
  codePoint: number;
  kind: DetectionKind;
  name: string;
  category?: InvisibleCategory | "svs" | "ivs";
};

/** 不可視文字・機種依存文字・異体字セレクタの位置と種類を一覧にする */
export function detectSpecialChars(text: string, limit = 10000): { items: Detection[]; total: number } {
  const items: Detection[] = [];
  let total = 0;
  let line = 1;
  let column = 1;
  let index = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0)!;
    let detection: Omit<Detection, "index" | "length" | "line" | "column" | "codePoint"> | null = null;
    const invisible = invisibleInfo(codePoint);
    const vs = variationSelectorKind(codePoint);
    if (invisible) detection = { kind: "invisible", name: invisible.name, category: invisible.category };
    else if (vs) detection = { kind: "variationSelector", name: vs === "ivs" ? `IVS (VS${codePoint - 0xe0100 + 17})` : `VS${codePoint - 0xfe00 + 1}`, category: vs };
    else if (DEPENDENT_CHARS[char]) detection = { kind: "dependent", name: char };
    if (detection) {
      total += 1;
      if (items.length < limit) items.push({ index, length: char.length, line, column, codePoint, ...detection });
    }
    // CRLF・LF・CR（単独）のいずれも改行として数える
    if (char === "\n" || (char === "\r" && text[index + 1] !== "\n")) {
      line += 1;
      column = 1;
    } else if (char !== "\r") {
      column += 1;
    }
    index += char.length;
  }
  return { items, total };
}

/** 表示用の文字コード表記（U+200B） */
export function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}
