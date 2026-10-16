import { describe, expect, it } from "vitest";

import {
  collapseSpaces,
  combineDakuten,
  convertItaiji,
  detectSpecialChars,
  expandDependentChars,
  formatCodePoint,
  fullwidthAlnumToHalf,
  fullwidthSpaceToHalf,
  halfwidthKanaToFull,
  invisibleInfo,
  NO_NORMALIZE_OPTIONS,
  normalizeBlankLines,
  normalizeNewlines,
  normalizeText,
  normalizeUnicode,
  PRESETS,
  trimLines,
  unifyDashes,
  unifyPunctuation,
  unifySymbols,
  unifyTildes,
} from "./text-normalize";

/** ソースコードに不可視文字を直接書かないよう、コードポイントから文字を作る */
const c = (...codePoints: number[]) => String.fromCodePoint(...codePoints);
const ZWSP = c(0x200b);
const ZWJ = c(0x200d);
const BOM = c(0xfeff);
const NBSP = c(0xa0);
const RLO = c(0x202e);
const IDEO_SPACE = c(0x3000);
const COMBINING_DAKUTEN = c(0x3099);
const COMBINING_HANDAKUTEN = c(0x309a);

describe("文字種の変換", () => {
  it("全角英数字を半角にする", () => {
    expect(fullwidthAlnumToHalf("ＡＢＣｘｙｚ０１２９")).toEqual({ text: "ABCxyz0129", count: 10 });
    expect(fullwidthAlnumToHalf("全角なし abc")).toEqual({ text: "全角なし abc", count: 0 });
  });

  it("半角カタカナを全角にする（濁点・半濁点・記号を含む）", () => {
    expect(halfwidthKanaToFull("ｶﾞｷﾞｸﾞ ﾊﾟﾋﾟ ｳﾞｧｲｵﾘﾝ ｱｲｳｴｵ").text).toBe("ガギグ パピ ヴァイオリン アイウエオ");
    expect(halfwidthKanaToFull("｢ﾃｽﾄ｣､ﾃﾞｰﾀ｡･").text).toBe("「テスト」、データ。・");
    expect(halfwidthKanaToFull("ｶﾞ").count).toBe(1);
    // 単独の濁点は全角の濁点にする
    expect(halfwidthKanaToFull("ﾞ").text).toBe("゛");
  });

  it("記号の全角・半角を統一する", () => {
    expect(unifySymbols("（注）！？［1］", "half").text).toBe("(注)!?[1]");
    expect(unifySymbols("(注)!?", "full").text).toBe("（注）！？");
    expect(unifySymbols("“引用”と‘単’", "half").text).toBe("\"引用\"と'単'");
    // 句読点・ハイフン・チルダは対象外
    expect(unifySymbols("，．－～", "half").text).toBe("，．－～");
  });

  it("濁点・半濁点の結合文字を1文字に統合する", () => {
    expect(combineDakuten(`か${COMBINING_DAKUTEN}は${COMBINING_HANDAKUTEN}`)).toEqual({ text: "がぱ", count: 2 });
    expect(combineDakuten("か゛は゜")).toEqual({ text: "がぱ", count: 2 });
    expect(combineDakuten(`ウ${COMBINING_DAKUTEN}`).text).toBe("ヴ");
    // 合成できない組み合わせはそのまま
    expect(combineDakuten("ア゛").text).toBe("ア゛");
  });

  it("Unicode正規化（NFC・NFKC）", () => {
    const decomposed = `か${COMBINING_DAKUTEN}`;
    expect(normalizeUnicode(decomposed, "nfc")).toEqual({ text: "が", count: 1 });
    expect(normalizeUnicode("ｱＡ①", "nfkc").text).toBe("アA1");
    expect(normalizeUnicode("変化なし", "nfc")).toEqual({ text: "変化なし", count: 0 });
  });

  it("機種依存文字を展開する", () => {
    expect(expandDependentChars("㈱テスト ①② Ⅳ ⅻ ㌔ ㍻ № ㎡").text).toBe("(株)テスト (1)(2) IV xii キロ 平成 No. m2");
    expect(expandDependentChars("⑳").text).toBe("(20)");
  });

  it("旧字体・異体字を変換する", () => {
    expect(convertItaiji("髙橋 山﨑 齋藤 國學")).toEqual({ text: "高橋 山崎 斎藤 国学", count: 5 });
  });
});

describe("ハイフン・チルダ・句読点", () => {
  it("ハイフン類を統一し、カナの後ろは長音符にする", () => {
    const minus = c(0x2212);
    const enDash = c(0x2013);
    expect(unifyDashes(`03${minus}1234${enDash}5678`, "-").text).toBe("03-1234-5678");
    expect(unifyDashes("コンピュ－タ ラ―メン", "-").text).toBe("コンピュータ ラーメン");
    expect(unifyDashes("ラーメン 03ー1234", "-").text).toBe("ラーメン 03-1234");
    expect(unifyDashes("A-B", "－").text).toBe("A－B");
    expect(unifyDashes("ラーメン", "-").count).toBe(0);
  });

  it("チルダを統一し、URL の ~ は残す", () => {
    expect(unifyTildes("10～20 10~20 1日〜3日", "〜").text).toBe("10〜20 10〜20 1日〜3日");
    expect(unifyTildes("https://example.com/~user", "〜").text).toBe("https://example.com/~user");
    expect(unifyTildes("10〜20", "~").text).toBe("10~20");
  });

  it("句読点を統一し、数値・英文のカンマとピリオドは残す", () => {
    expect(unifyPunctuation("今日は，晴れ．明日も,晴れ.", "、。").text).toBe("今日は、晴れ。明日も、晴れ。");
    expect(unifyPunctuation("価格は1,000円です. Hello, world.", "、。").text).toBe("価格は1,000円です。 Hello, world.");
    expect(unifyPunctuation("今日は、晴れ。", "，．").text).toBe("今日は，晴れ．");
    expect(unifyPunctuation("今日は、晴れ。", ",.").text).toBe("今日は,晴れ.");
  });
});

describe("空白・改行", () => {
  it("空白を整える", () => {
    expect(fullwidthSpaceToHalf(`あ${IDEO_SPACE}い`)).toEqual({ text: "あ い", count: 1 });
    expect(collapseSpaces("a   b\t\tc d")).toEqual({ text: "a b c d", count: 2 });
    expect(trimLines(`  a  \n${IDEO_SPACE}b\t`).text).toBe("a\nb");
  });

  it("空行の圧縮・除去（空白だけの行も空行とみなす）", () => {
    const text = "a\n\n\n  \nb\n\nc";
    expect(normalizeBlankLines(text, "collapse").text).toBe("a\n\nb\n\nc");
    expect(normalizeBlankLines(text, "remove").text).toBe("a\nb\nc");
    expect(normalizeBlankLines("a\r\n\r\n\r\nb", "collapse").text).toBe("a\r\n\r\nb");
  });

  it("改行コードを統一する（混在にも対応）", () => {
    expect(normalizeNewlines("a\r\nb\rc\nd", "lf")).toEqual({ text: "a\nb\nc\nd", count: 2 });
    expect(normalizeNewlines("a\nb", "crlf").text).toBe("a\r\nb");
    expect(normalizeNewlines("a\r\nb", "cr").text).toBe("a\rb");
  });
});

describe("不可視文字", () => {
  it("種類を判定する", () => {
    expect(invisibleInfo(0x200b)?.category).toBe("zeroWidth");
    expect(invisibleInfo(0x202e)?.category).toBe("bidi");
    expect(invisibleInfo(0x07)?.category).toBe("control");
    expect(invisibleInfo(0x09)).toBeNull();
    expect(invisibleInfo(0x0a)).toBeNull();
    expect(invisibleInfo(0xe0041)?.category).toBe("tag");
    expect(invisibleInfo(0x41)).toBeNull();
  });

  it("除去する（ノーブレークスペースは通常のスペース、行区切りは改行にする）", () => {
    const text = `${BOM}あ${ZWSP}い${NBSP}う${RLO}え${c(0x2028)}お${c(0x07)}`;
    const result = normalizeText(text, { ...NO_NORMALIZE_OPTIONS, removeInvisible: true });
    expect(result.text).toBe("あい うえ\nお");
    expect(result.counts).toEqual({ removeInvisible: 6 });
  });

  it("絵文字のゼロ幅接合子や異体字セレクタも不可視文字として扱う（除去すると絵文字が分かれる）", () => {
    const family = `👨${ZWJ}👩${ZWJ}👧`;
    expect(normalizeText(family, PRESETS.invisible).text).toBe("👨👩👧");
  });
});

describe("detectSpecialChars", () => {
  it("位置・行・列・種類を一覧にする（サロゲートペアを1文字として数える）", () => {
    const text = `😀${ZWSP}\r\nabc①\n漢${c(0xe0100)}${NBSP}`;
    const { items, total } = detectSpecialChars(text);
    expect(total).toBe(4);
    expect(items.map((item) => [item.kind, item.line, item.column, item.index, formatCodePoint(item.codePoint)])).toEqual([
      ["invisible", 1, 2, 2, "U+200B"],
      ["dependent", 2, 4, 8, "U+2460"],
      ["variationSelector", 3, 2, 11, "U+E0100"],
      ["invisible", 3, 3, 13, "U+00A0"],
    ]);
    expect(items[2]).toMatchObject({ name: "IVS (VS17)", length: 2 });
  });

  it("CR のみの改行でも行を数える", () => {
    expect(detectSpecialChars(`a\rb${ZWSP}`).items[0]).toMatchObject({ line: 2, column: 2 });
  });

  it("上限を超えた分は件数だけ数える", () => {
    const result = detectSpecialChars(ZWSP.repeat(5), 3);
    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(5);
  });
});

describe("normalizeText", () => {
  it("すべてオフなら何も変えない", () => {
    const text = `ｶﾀｶﾅ　ＡＢＣ${ZWSP}①\r\n`;
    expect(normalizeText(text, NO_NORMALIZE_OPTIONS)).toEqual({ text, counts: {} });
  });

  it("Excel/CSV取り込み用プリセット", () => {
    const text = `${BOM}ｶﾞｲﾄﾞ ＡＢＣ${IDEO_SPACE}①\n  東京都－千代田区  \n`;
    const result = normalizeText(text, PRESETS.csv);
    expect(result.text).toBe("ガイド ABC (1)\r\n東京都-千代田区\r\n");
    expect(result.counts).toMatchObject({ removeInvisible: 1, halfwidthKana: 3, fullwidthAlnum: 3, dependentChars: 1, fullwidthSpace: 1, trimLines: 2, newline: 2 });
  });

  it("データベース登録用プリセット（NFKC）", () => {
    const result = normalizeText("（株）ﾃｽﾄ　　ＡＢＣ  １０～２０", PRESETS.database);
    expect(result.text).toBe("(株)テスト ABC 10〜20");
  });

  it("文書校正用プリセット", () => {
    const result = normalizeText("今日は，晴れ．\n\n\n\nｺﾝﾋﾟｭｰﾀを使う", PRESETS.proofreading);
    expect(result.text).toBe("今日は、晴れ。\n\nコンピュータを使う");
  });

  it("絵文字・サロゲートペアの漢字を壊さない", () => {
    const text = "𠮷野家で🍣を食べた👍🏽";
    expect(normalizeText(text, PRESETS.database).text).toBe(text);
    expect(normalizeText(text, PRESETS.csv).text).toBe(text);
  });
});
