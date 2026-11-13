import { ENCODINGS, convertLineEndings, decodeBytes, detectEncoding, encodeText, lineEndingKind, repairMojibake, type EncodingName } from "@/lib/more/encoding";
import { ESCAPE_KINDS, escapeText, unescapeText, type EscapeKind } from "@/lib/more/escape";
import { floatFromHex, inspectFloat } from "@/lib/more/ieee754";
import { formatAcross, type IntlKind } from "@/lib/more/intl-playground";
import { LINE_OPS, SET_OPS, runLineOp, type LineOp } from "@/lib/more/line-tools";
import { WIDTHS, bitOp, bitsString, fitsWidth, parseInteger, toBase, toSigned, toUnsigned, type BitOp } from "@/lib/more/radix";
import { CASES, type CaseName } from "@/lib/more/text-case";

import type { Specs } from "./shared";

const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
const concat = (a: Uint8Array, b: Uint8Array) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };

export const specs: Specs = {
  "encoding-converter": {
    inputs: [{ id: "text", label: ["文字化けしたテキスト（修復する場合）", "Garbled text (to repair)"], rows: 5 }],
    files: { label: ["テキストファイルをドロップ（文字コードの判定・変換）", "Drop a text file (detect and convert its encoding)"] },
    options: [
      { id: "to", kind: "select", label: ["変換先の文字コード", "Convert to"], default: "utf-8", choices: ["utf-8", "shift_jis", "euc-jp", "iso-2022-jp", "utf-16le", "utf-16be"].map((v) => ({ value: v, label: v === "shift_jis" ? "Shift_JIS (CP932)" : v.toUpperCase() })) },
      { id: "bom", kind: "checkbox", label: ["UTF-8にBOMを付ける", "Add a BOM to UTF-8"], default: false },
      { id: "eol", kind: "select", label: ["改行コード", "Line endings"], default: "keep", choices: [{ value: "keep", label: ["そのまま", "Keep"] }, { value: "lf", label: "LF" }, { value: "crlf", label: "CRLF" }, { value: "cr", label: "CR" }] },
      { id: "from", kind: "select", label: ["元の文字コード（ファイル）", "Source encoding (file)"], default: "auto", choices: [{ value: "auto", label: ["自動判定", "Auto-detect"] }, ...ENCODINGS.map((v) => ({ value: v, label: v }))] },
    ],
    run: ({ inputs, files, opts, t }) => {
      const tables: import("@/lib/more/types").Table[] = [];
      const notes: string[] = [];
      let text = "";
      let source = "";
      if (files[0]) {
        const bytes = files[0].bytes;
        const det = detectEncoding(bytes);
        tables.push({ title: t("判定結果", "Detection"), head: [t("文字コード", "Encoding"), t("確からしさ", "Confidence"), t("プレビュー", "Preview")], rows: det.slice(0, 5).map((d) => [d.encoding + (d.bom ? " (BOM)" : ""), `${Math.round(d.score * 100)}%`, d.text.slice(0, 40).replace(/\s+/g, " ")]) });
        source = opts.from === "auto" ? (det[0]?.encoding.startsWith("ascii") ? "utf-8" : det[0]?.encoding ?? "utf-8") : String(opts.from);
        text = det[0]?.bom && opts.from === "auto" ? det[0].text : decodeBytes(bytes, source);
        if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf && opts.from !== "auto") text = text.replace(/^\ufeff/, "");
        notes.push(t(`${files[0].name}: ${source} として読み込みました。改行: ${lineEndingKind(text)}`, `${files[0].name}: read as ${source}. Line endings: ${lineEndingKind(text)}`));
      } else {
        text = inputs.text;
        const fixes = repairMojibake(text);
        if (fixes.length) tables.push({ title: t("文字化けの修復候補", "Mojibake repair candidates"), head: [t("原因（元の符号化 → 誤った復号）", "Cause (original → wrong decoding)"), t("確からしさ", "Confidence"), t("修復結果", "Repaired text")], rows: fixes.map((f) => [f.path, `${Math.round(f.score * 100)}%`, f.text]) });
        else notes.push(t("修復できる文字化けのパターンは見つかりませんでした。ファイルとして読み込むと、文字コードを判定できます。", "No repairable mojibake pattern found. Load it as a file to detect its encoding."));
        if (fixes.length && fixes.some((f) => f.text.includes("\ufffd"))) notes.push(t("一部の文字は、化けた時点でバイトが失われており復元できません（� で表示）。", "Some characters lost bytes when they were garbled and cannot be restored (shown as �)."));
        if (!fixes.length) return { notes };
        text = fixes[0].text;
      }
      text = convertLineEndings(text, opts.eol as "lf");
      const target = String(opts.to) as EncodingName;
      const { bytes: out, replaced } = encodeText(text, target);
      if (replaced) notes.push(t(`${target} で表せない文字が ${replaced} 個あり、? に置き換えました。`, `${replaced} character(s) cannot be represented in ${target} and were replaced with ?.`));
      const data = target === "utf-8" && opts.bom ? concat(BOM, out) : out;
      const ext = target === "utf-8" ? "utf8" : target.replace(/[^a-z0-9]/g, "");
      return { notes, tables, text, downloads: [{ name: `converted-${ext}.txt`, data, mime: "text/plain" }] };
    },
    outputLabel: ["変換後のテキスト（画面表示はUnicode）", "Converted text (shown as Unicode)"],
  },

  "escape-tool": {
    inputs: [{ id: "text", label: ["文字列", "Text"], rows: 8 }],
    options: [
      { id: "kind", kind: "select", label: ["形式", "Format"], default: "js", choices: ESCAPE_KINDS.map((v) => ({ value: v, label: { js: "JavaScript string", json: "JSON string", html: "HTML entities", xml: "XML attribute", sql: "SQL (single quote)", shell: "Shell (single quote)", regex: "Regular expression", csv: "CSV field", "url-component": "URL component" }[v] })) },
      { id: "dir", kind: "select", label: ["方向", "Direction"], default: "escape", choices: [{ value: "escape", label: ["エスケープ", "Escape"] }, { value: "unescape", label: ["アンエスケープ", "Unescape"] }] },
    ],
    sample: { text: `He said "it's <b>fine</b> & done"\n\tpath C:\\temp` },
    run: ({ inputs, opts, t }) => {
      try { return { text: (opts.dir === "escape" ? escapeText : unescapeText)(opts.kind as EscapeKind, inputs.text) }; }
      catch { return { error: t("この形式としてアンエスケープできません。", "Cannot unescape as this format.") }; }
    },
  },

  "case-converter": {
    inputs: [{ id: "text", label: ["変換する文字列（1行1件）", "Text to convert (one per line)"], rows: 6 }],
    options: [{ id: "only", kind: "select", label: ["出力", "Output"], default: "all", choices: [{ value: "all", label: ["すべてのケースを表示", "Show all cases"] }, ...Object.keys(CASES).map((v) => ({ value: v, label: v }))] }],
    sample: { text: "getHTTPResponse\nuser_account_id\nMy Page Title" },
    run: ({ inputs, opts, t }) => {
      const lines = inputs.text.split(/\r?\n/).filter((l) => l.trim());
      if (opts.only !== "all") return { text: lines.map((l) => CASES[opts.only as CaseName](l)).join("\n") };
      const names = Object.keys(CASES) as CaseName[];
      return { notes: [t("camelCase・PascalCase・略語（HTTPServer）・snake_case・kebab-case・空白区切りを自動で単語に分けます。", "camelCase, PascalCase, acronyms (HTTPServer), snake_case, kebab-case, and spaces are split into words automatically.")], tables: [{ head: [t("入力", "Input"), ...names], rows: lines.map((l) => [l, ...names.map((n) => CASES[n](l))]) }] };
    },
  },

  "line-tools": {
    inputs: [{ id: "text", label: ["テキスト（1行1要素）", "Text (one item per line)"], rows: 10 }, { id: "other", label: ["2つ目のリスト（集合演算用）", "Second list (for set operations)"], rows: 5 }],
    options: [
      { id: "op", kind: "select", label: ["操作", "Operation"], default: "sort", choices: LINE_OPS.map((v) => ({ value: v, label: { sort: ["昇順に並べ替え", "Sort ascending"], "sort-desc": ["降順に並べ替え", "Sort descending"], "sort-natural": ["自然順で並べ替え（file2 < file10）", "Natural sort (file2 < file10)"], "sort-number": ["数値順で並べ替え", "Sort numerically"], "sort-length": ["長さ順で並べ替え", "Sort by length"], unique: ["重複を削除", "Remove duplicates"], duplicates: ["重複している行だけ抽出", "Extract duplicated lines"], count: ["出現回数を集計", "Count occurrences"], reverse: ["逆順", "Reverse"], shuffle: ["シャッフル", "Shuffle"], trim: ["前後の空白を削除", "Trim whitespace"], "remove-empty": ["空行を削除", "Remove empty lines"], number: ["行番号を付ける", "Number lines"], "prefix-suffix": ["前後に文字列を追加", "Add prefix and suffix"], join: ["1行に結合", "Join into one line"], union: ["和集合（A ∪ B）", "Union (A ∪ B)"], intersection: ["共通部分（A ∩ B）", "Intersection (A ∩ B)"], difference: ["差集合（A − B）", "Difference (A − B)"], symmetric: ["対称差（A △ B）", "Symmetric difference (A △ B)"] }[v] as [string, string] })) },
      { id: "ic", kind: "checkbox", label: ["大文字小文字を区別しない", "Ignore case"], default: false },
      { id: "trim", kind: "checkbox", label: ["前後の空白を無視して比較", "Ignore surrounding whitespace"], default: false },
      { id: "prefix", kind: "text", label: ["先頭に追加", "Prefix"], default: "", hidden: (v) => v.op !== "prefix-suffix" },
      { id: "suffix", kind: "text", label: ["末尾に追加", "Suffix"], default: "", hidden: (v) => v.op !== "prefix-suffix" },
      { id: "sep", kind: "text", label: ["区切り文字", "Separator"], default: ", ", hidden: (v) => v.op !== "join" && v.op !== "number" },
      { id: "seed", kind: "number", label: ["シャッフルのシード", "Shuffle seed"], default: 1, hidden: (v) => v.op !== "shuffle" },
    ],
    run: ({ inputs, opts, t }) => {
      const op = opts.op as LineOp;
      const r = runLineOp(op, inputs.text, { ignoreCase: !!opts.ic, trim: !!opts.trim, prefix: String(opts.prefix), suffix: String(opts.suffix), separator: String(opts.sep), seed: Number(opts.seed) || 1, other: inputs.other });
      const note = op === "unique" ? [t(`${r.info} 行の重複を削除しました。`, `Removed ${r.info} duplicate line(s).`)] : SET_OPS.includes(op) && !inputs.other.trim() ? [t("2つ目のリストが空です。", "The second list is empty.")] : [];
      return { notes: [...note, t(`${r.lines.length} 行`, `${r.lines.length} line(s)`)], text: r.lines.join("\n") };
    },
  },

  "radix-calculator": {
    inputs: [{ id: "a", label: ["値A（0x・0b・0o の接頭辞可、負数可）", "Value A (0x, 0b, 0o prefixes and negatives allowed)"], rows: 2 }, { id: "b", label: ["値B（ビット演算・シフト量）", "Value B (bit operations and shift amount)"], rows: 2 }],
    options: [
      { id: "base", kind: "select", label: ["入力の基数", "Input base"], default: "10", choices: [2, 8, 10, 16, 32, 36].map((v) => ({ value: String(v), label: String(v) })) },
      { id: "width", kind: "select", label: ["ビット幅", "Bit width"], default: "32", choices: WIDTHS.map((v) => ({ value: String(v), label: `${v} bit` })) },
      { id: "op", kind: "select", label: ["演算（AとB）", "Operation (A and B)"], default: "none", choices: [{ value: "none", label: ["なし", "None"] }, ...["and", "or", "xor", "not", "shl", "shr", "sar"].map((v) => ({ value: v, label: v.toUpperCase() }))] },
    ],
    sample: { a: "0xDEADBEEF", b: "8" },
    run: ({ inputs, opts, t }) => {
      const base = Number(opts.base), width = Number(opts.width);
      const a = parseInteger(inputs.a, base);
      if (a === null) return { error: t("値Aを基数 " + base + " の整数として読み取れません。", `Cannot read value A as a base-${base} integer.`) };
      let v = a;
      const notes: string[] = [];
      if (opts.op !== "none") {
        const b = inputs.b.trim() ? parseInteger(inputs.b, base) : 0n;
        if (b === null) return { error: t("値Bを読み取れません。", "Cannot read value B.") };
        v = bitOp(opts.op as BitOp, a, b, width);
        notes.push(`A ${String(opts.op).toUpperCase()} B = ${v}`);
      }
      const fit = fitsWidth(v, width);
      if (!fit.unsigned && !fit.signed) notes.push(t(`${width}ビットに収まらないため、下位${width}ビットのみで2の補数を表示します。`, `The value does not fit in ${width} bits, so two's complement shows the low ${width} bits only.`));
      return {
        notes,
        tables: [
          { title: t("基数変換", "Bases"), head: [t("基数", "Base"), t("値", "Value")], rows: [2, 8, 10, 16, 32, 36].map((b) => [String(b), toBase(v, b)]) },
          { title: t(`${width}ビット表現`, `${width}-bit representation`), head: [t("項目", "Field"), t("値", "Value")], rows: [[t("ビット列", "Bits"), bitsString(v, width)], [t("符号なし", "Unsigned"), toUnsigned(v, width).toString()], [t("符号付き（2の補数）", "Signed (two's complement)"), toSigned(v, width).toString()], ["hex", "0x" + toUnsigned(v, width).toString(16).toUpperCase().padStart(width / 4, "0")]] },
        ],
      };
    },
  },

  "ieee754-viewer": {
    inputs: [{ id: "v", label: ["数値（例: 0.1、-1.5e10、NaN、Infinity）／ 16進のビット列", "Number (e.g. 0.1, -1.5e10, NaN, Infinity) / hex bit pattern"], rows: 2 }],
    options: [
      { id: "width", kind: "select", label: ["形式", "Format"], default: "64", choices: [{ value: "64", label: "binary64 (double)" }, { value: "32", label: "binary32 (float)" }] },
      { id: "mode", kind: "select", label: ["入力", "Input is"], default: "number", choices: [{ value: "number", label: ["10進の数値", "Decimal number"] }, { value: "hex", label: ["16進のビット列", "Hex bit pattern"] }] },
    ],
    sample: { v: "0.1" },
    run: ({ inputs, opts, t }) => {
      const width = Number(opts.width) as 32 | 64;
      const raw = inputs.v.trim();
      const n = opts.mode === "hex" ? floatFromHex(raw, width) : /^[+-]?(nan)$/i.test(raw) ? NaN : /^[+-]?inf(inity)?$/i.test(raw) ? (raw.startsWith("-") ? -Infinity : Infinity) : raw === "" || Number.isNaN(Number(raw)) ? null : Number(raw);
      if (n === null) return { error: t("数値（または16進のビット列）として読み取れません。", "Cannot read the input as a number (or hex bit pattern).") };
      const i = inspectFloat(n, width);
      const sum = opts.mode === "number" && Number(raw) === 0.1 ? [t("0.1 + 0.2 = " + (0.1 + 0.2) + "（0.30000000000000004）。厳密な値が2進で表せないため誤差が出ます。", "0.1 + 0.2 = " + (0.1 + 0.2) + " (0.30000000000000004). Exact values cannot be represented in binary, so rounding error appears.")] : [];
      return {
        notes: [t(`入力を ${width === 64 ? "double" : "float"} に丸めた値が、実際に保持される値です。`, `The input rounded to ${width === 64 ? "double" : "float"} is the value actually stored.`), ...sum],
        tables: [{ head: [t("項目", "Field"), t("値", "Value")], rows: [[t("種類", "Kind"), i.kind], ["JavaScript", String(n)], [t("正確な10進値", "Exact decimal value"), i.exact], [t("符号 (1bit)", "Sign (1 bit)"), String(i.sign)], [t(`指数部 (${i.exponentBits.length}bit)`, `Exponent (${i.exponentBits.length} bits)`), `${i.exponentBits} (raw ${i.exponentRaw}${i.exponentUnbiased !== null ? `, 2^${i.exponentUnbiased}` : ""})`], [t(`仮数部 (${i.mantissaBits.length}bit)`, `Mantissa (${i.mantissaBits.length} bits)`), i.mantissaBits], [t("16進", "Hex"), `0x${i.hex}`], [t("全ビット", "All bits"), `${i.bits[0]} ${i.exponentBits} ${i.mantissaBits}`]] }],
      };
    },
  },

  "intl-playground": {
    inputs: [{ id: "value", label: ["値（数値・日時（ISO 8601）・リスト（カンマ区切り））", "Value (number, date-time (ISO 8601), or comma-separated list)"], rows: 2 }],
    options: [
      { id: "kind", kind: "select", label: ["種類", "Kind"], default: "number", choices: [{ value: "number", label: ["数値", "Number"] }, { value: "currency", label: ["通貨", "Currency"] }, { value: "percent", label: ["パーセント", "Percent"] }, { value: "compact", label: ["コンパクト表記", "Compact"] }, { value: "unit", label: ["単位", "Unit"] }, { value: "date", label: ["日付", "Date"] }, { value: "time", label: ["時刻", "Time"] }, { value: "datetime", label: ["日付と時刻", "Date and time"] }, { value: "relative", label: ["相対時間", "Relative time"] }, { value: "list", label: ["リスト", "List"] }, { value: "plural", label: ["複数形・序数", "Plural / ordinal"] }] },
      { id: "locales", kind: "text", label: ["ロケール（カンマ区切り）", "Locales (comma separated)"], default: "ja-JP, en-US, en-GB, de-DE, fr-FR, zh-CN, ko-KR, ar-EG, hi-IN" },
      { id: "currency", kind: "text", label: ["通貨コード", "Currency code"], default: "JPY", hidden: (v) => v.kind !== "currency" },
      { id: "tz", kind: "text", label: ["タイムゾーン（例: Asia/Tokyo、UTC）", "Time zone (e.g. Asia/Tokyo, UTC)"], default: "UTC", hidden: (v) => !["date", "time", "datetime"].includes(String(v.kind)) },
      { id: "style", kind: "select", label: ["スタイル", "Style"], default: "medium", choices: ["short", "medium", "long", "full"].map((v) => ({ value: v, label: v })), hidden: (v) => !["date", "time", "datetime"].includes(String(v.kind)) },
      { id: "unit", kind: "text", label: ["単位（unit: kilometer-per-hour など／relative: day, hour など）", "Unit (unit: kilometer-per-hour, …; relative: day, hour, …)"], default: "kilometer", hidden: (v) => v.kind !== "unit" && v.kind !== "relative" },
      { id: "lstyle", kind: "select", label: ["リストのスタイル", "List style"], default: "long", choices: ["long", "short", "narrow"].map((v) => ({ value: v, label: v })), hidden: (v) => v.kind !== "list" },
    ],
    sample: { value: "1234567.891" },
    run: ({ inputs, opts, t }) => {
      const locales = String(opts.locales).split(",").map((l) => l.trim()).filter(Boolean);
      const rows = formatAcross({ kind: opts.kind as IntlKind, value: inputs.value.trim(), currency: String(opts.currency).toUpperCase(), timeZone: String(opts.tz), dateStyle: String(opts.style), unit: String(opts.unit), listStyle: String(opts.lstyle) }, locales);
      return { notes: [t("結果はお使いのブラウザのIntl実装によります。ブラウザやバージョンで表記が変わることがあります。", "Results come from your browser's Intl implementation and may differ between browsers and versions.")], tables: [{ head: [t("ロケール", "Locale"), t("結果", "Result")], rows: rows.map((r) => [r.locale, r.result]) }] };
    },
  },
};
