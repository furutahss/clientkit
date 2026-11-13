import { unzipSync, zipSync } from "fflate";

import { decodeCbor, decodeMsgpack, encodeCbor, encodeMsgpack, type V } from "@/lib/more/binary-codecs";
import { FIELD_NAMES, generateRows, renderRows } from "@/lib/more/fake-data";
import { formatGraphql, sdlToTypeScript } from "@/lib/more/graphql";
import { runJq, type J } from "@/lib/more/jq";
import { repairJson, type RepairNote } from "@/lib/more/json-repair";
import { generateTypes, type Lang } from "@/lib/more/json-types";
import { diffLockfiles, readLockfile } from "@/lib/more/lockfile";
import { formatMarkdownTable, gridFromRows, gridToDelimited, parseDelimited, parseMarkdownTable, type Align } from "@/lib/more/markdown-table";
import { LEVELS, defaultColumns, filterRows, levelCounts, parseNdjson } from "@/lib/more/ndjson";
import { checkPackageJson } from "@/lib/more/package-json-check";
import { decodeProtobuf, formatProtobuf } from "@/lib/more/protobuf";
import { sampleFromSchema } from "@/lib/more/schema-sample";
import { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes, textOrFile } from "@/lib/more/util";
import { formatXml, jsonToXml, minifyXml, parseXml, xmlToJson, xpath, XmlError, type Json } from "@/lib/more/xml";

import { countNote, findingsTable, type Specs } from "./shared";

const jsonError = (t: (ja: string, en: string) => string, e: unknown) => ({ error: t(`JSONの形式が正しくありません: ${(e as Error).message}`, `Invalid JSON: ${(e as Error).message}`) });

const REPAIR_NOTES: Record<RepairNote, [string, string]> = {
  fence: ["コードフェンス（```）を取り除きました", "Removed the code fence (```)"],
  comments: ["コメントを取り除きました", "Removed comments"],
  "single-quotes": ["シングルクォートの文字列を二重引用符にしました", "Converted single-quoted strings to double quotes"],
  "unquoted-keys": ["引用符のないキーを引用符で囲みました", "Quoted unquoted keys"],
  "trailing-comma": ["末尾のカンマを取り除きました", "Removed trailing commas"],
  "missing-comma": ["抜けていたカンマを補いました", "Added missing commas"],
  literals: ["Python/JS風のリテラル（True・None・undefined など）を変換しました", "Converted Python/JS-style literals (True, None, undefined, …)"],
  closed: ["途中で切れていたため、文字列・配列・オブジェクトを閉じました（内容が欠けている可能性があります）", "The input was cut off, so strings, arrays, and objects were closed (content may be missing)"],
  "extra-text": ["JSONの後ろにあった余分な文字を無視しました", "Ignored extra text after the JSON"],
  "special-numbers": ["NaN・Infinity・16進数を変換しました（NaN・Infinityはnullにしています）", "Converted NaN, Infinity, and hex numbers (NaN and Infinity become null)"],
};

function toBytes(text: string, files: { bytes: Uint8Array }[], enc: string): Uint8Array | null {
  if (files[0]) return files[0].bytes;
  return enc === "base64" ? base64ToBytes(text) : hexToBytes(text);
}

export const specs: Specs = {
  "jq-playground": {
    inputs: [
      { id: "json", label: ["入力JSON", "Input JSON"], rows: 10 },
      { id: "filter", label: ["jqフィルター", "jq filter"], rows: 3, placeholder: ".users[] | select(.age >= 18) | .name" },
    ],
    options: [
      { id: "compact", kind: "checkbox", label: ["1行で出力 (-c)", "Compact output (-c)"], default: false },
      { id: "raw", kind: "checkbox", label: ["文字列を引用符なしで出力 (-r)", "Raw string output (-r)"], default: false },
    ],
    sample: { json: '{"users":[{"name":"Alice","age":30},{"name":"Bob","age":17},{"name":"Carol","age":45}]}', filter: ".users[] | select(.age >= 18) | {name, age}" },
    outputLabel: ["出力", "Output"],
    run: ({ inputs, opts, t }) => {
      if (!inputs.filter.trim()) return { error: t("jqフィルターを入力してください。", "Enter a jq filter.") };
      let data: J;
      try { data = JSON.parse(inputs.json); } catch (e) { return jsonError(t, e); }
      try {
        const out = runJq(inputs.filter, data);
        const text = out.map((v) => (opts.raw && typeof v === "string" ? v : JSON.stringify(v, null, opts.compact ? undefined : 2))).join("\n");
        return { notes: [t(`${out.length} 件の結果。jqの主要な機能のみ対応しています（def・reduce・代入演算子などは未対応）。`, `${out.length} result(s). Only the main jq features are supported (no def, reduce, or assignment operators).`)], text };
      } catch (e) { return { error: `jq: ${(e as Error).message}` }; }
    },
  },

  "json-repair": {
    inputs: [{ id: "text", label: ["壊れたJSON（LLMの出力・JS風の記法など）", "Broken JSON (LLM output, JS-style syntax, …)"], rows: 10 }],
    options: [{ id: "indent", kind: "select", label: ["出力", "Output"], default: "2", choices: [{ value: "2", label: ["整形（2スペース）", "Pretty (2 spaces)"] }, { value: "4", label: ["整形（4スペース）", "Pretty (4 spaces)"] }, { value: "0", label: ["1行（minify）", "Minified"] }] }],
    sample: { text: "```json\n{\n  name: 'Alice', // user\n  active: True,\n  tags: ['a', 'b',],\n  address: {city: \"Tokyo\"\n" },
    outputLabel: ["修復したJSON", "Repaired JSON"],
    run: ({ inputs, opts, t }) => {
      try {
        const { value, notes } = repairJson(inputs.text);
        return { notes: notes.length ? notes.map((n) => t(...REPAIR_NOTES[n])) : [t("修復の必要はありませんでした。", "No repairs were needed.")], text: JSON.stringify(value, null, Number(opts.indent) || undefined) };
      } catch (e) { return { error: t(`修復できませんでした: ${(e as Error).message}`, `Could not repair: ${(e as Error).message}`) }; }
    },
  },

  "json-to-types": {
    inputs: [{ id: "json", label: ["JSON", "JSON"], rows: 10 }],
    options: [
      { id: "lang", kind: "select", label: ["言語", "Language"], default: "go", choices: [{ value: "go", label: "Go (struct)" }, { value: "rust", label: "Rust (serde)" }, { value: "pydantic", label: "Python (Pydantic)" }, { value: "kotlin", label: "Kotlin (kotlinx.serialization)" }, { value: "swift", label: "Swift (Codable)" }, { value: "zod", label: "Zod (TypeScript)" }, { value: "csharp", label: "C# (System.Text.Json)" }, { value: "java", label: "Java (record + Jackson)" }] },
      { id: "root", kind: "text", label: ["ルートの型名", "Root type name"], default: "Root" },
    ],
    sample: { json: '{"id":1,"user_name":"alice","score":9.5,"active":true,"tags":["a","b"],"address":{"zip":"100-0001","type":"home"},"items":[{"sku":"A1","qty":2},{"sku":"B2","note":null}]}' },
    outputLabel: ["生成したコード", "Generated code"],
    run: ({ inputs, opts, t }) => {
      let data: unknown;
      try { data = JSON.parse(inputs.json); } catch (e) { return jsonError(t, e); }
      return { notes: [t("配列の要素は1つの型に統合し、一部の要素にしかないキーは省略可能、nullを含むものはnull許容にします。整数と小数が混在する場合は小数にします。", "Array elements are merged into one type; keys missing from some elements become optional and keys containing null become nullable. Mixed integers and decimals become decimals.")], text: generateTypes(data, opts.lang as Lang, String(opts.root).trim() || "Root") };
    },
  },

  "schema-sample-generator": {
    inputs: [{ id: "schema", label: ["JSON Schema", "JSON Schema"], rows: 12 }],
    sample: { schema: '{\n  "type": "object",\n  "required": ["id", "email"],\n  "properties": {\n    "id": { "type": "integer", "minimum": 1 },\n    "email": { "type": "string", "format": "email" },\n    "role": { "enum": ["admin", "user"] },\n    "tags": { "type": "array", "items": { "type": "string" }, "minItems": 2 }\n  }\n}' },
    outputLabel: ["サンプルJSON", "Sample JSON"],
    run: ({ inputs, t }) => {
      let schema: unknown;
      try { schema = JSON.parse(inputs.schema); } catch (e) { return jsonError(t, e); }
      return { notes: [t("enum・const・default・examplesを優先し、$ref（ローカル）・allOf・oneOf/anyOf（先頭）に対応します。patternは満たせません。", "enum, const, default, and examples take priority; local $ref, allOf, and oneOf/anyOf (first branch) are supported. pattern cannot be satisfied.")], text: JSON.stringify(sampleFromSchema(schema), null, 2) };
    },
  },

  "xml-tool": {
    inputs: [{ id: "xml", label: ["XML（またはJSON）", "XML (or JSON)"], rows: 12 }],
    files: { accept: ".xml,.svg,.xsd,.rss,.atom,.json,text/xml,application/xml", label: ["XML / JSONファイルをドロップ（任意）", "Drop an XML / JSON file (optional)"] },
    options: [
      { id: "mode", kind: "select", label: ["操作", "Action"], default: "format", choices: [{ value: "format", label: ["整形", "Format"] }, { value: "minify", label: ["圧縮（minify）", "Minify"] }, { value: "to-json", label: ["XML → JSON", "XML → JSON"] }, { value: "from-json", label: ["JSON → XML", "JSON → XML"] }, { value: "xpath", label: ["XPathで抽出", "Extract with XPath"] }] },
      { id: "xpath", kind: "text", label: ["XPath（例: /root/item[@id='x']/text()）", "XPath (e.g. /root/item[@id='x']/text())"], default: "//*", hidden: (v) => v.mode !== "xpath" },
    ],
    sample: { xml: '<?xml version="1.0"?>\n<catalog>\n  <book id="b1"><title>XML入門</title><price>1200</price></book>\n  <book id="b2"><title>JSON入門</title><price>1500</price></book>\n</catalog>' },
    run: ({ inputs, files, opts, t }) => {
      const src = textOrFile(inputs.xml, files);
      try {
        switch (opts.mode) {
          case "format": return { text: formatXml(src) };
          case "minify": return { text: minifyXml(src) };
          case "to-json": return { notes: [t("属性は \"@名前\"、テキストは \"#text\"、同名の子要素は配列で表します。", "Attributes become \"@name\", text becomes \"#text\", and repeated child elements become arrays.")], text: JSON.stringify(xmlToJson(src), null, 2) };
          case "from-json": return { text: jsonToXml(JSON.parse(src) as Json) };
          default: {
            const r = xpath(parseXml(src), String(opts.xpath));
            return { notes: [t(`${r.length} 件に一致。XPathは主要な構文のみ対応しています（関数・軸は未対応）。`, `${r.length} match(es). Only the main XPath syntax is supported (no functions or axes).`)], text: r.join("\n") };
          }
        }
      } catch (e) {
        if (e instanceof XmlError) return { error: t(`XMLを処理できません: ${e.message}`, `Cannot process the XML: ${e.message}`) };
        if (e instanceof SyntaxError) return jsonError(t, e);
        return { error: (e as Error).message };
      }
    },
  },

  "msgpack-cbor-converter": {
    inputs: [{ id: "data", label: ["入力（デコード: 16進またはBase64 / エンコード: JSON）", "Input (decode: hex or Base64 / encode: JSON)"], rows: 8 }],
    files: { label: ["バイナリファイルをドロップ（デコード用・任意）", "Drop a binary file (for decoding, optional)"] },
    options: [
      { id: "format", kind: "select", label: ["形式", "Format"], default: "msgpack", choices: [{ value: "msgpack", label: "MessagePack" }, { value: "cbor", label: "CBOR" }] },
      { id: "dir", kind: "select", label: ["方向", "Direction"], default: "decode", choices: [{ value: "decode", label: ["バイナリ → JSON", "Binary → JSON"] }, { value: "encode", label: ["JSON → バイナリ", "JSON → binary"] }] },
      { id: "enc", kind: "select", label: ["バイナリの表記", "Binary notation"], default: "hex", choices: [{ value: "hex", label: "hex" }, { value: "base64", label: "Base64" }] },
    ],
    sample: { data: "82 a1 61 01 a1 62 92 01 02" },
    run: ({ inputs, files, opts, t }) => {
      const msgpack = opts.format === "msgpack";
      try {
        if (opts.dir === "encode") {
          const bytes = (msgpack ? encodeMsgpack : encodeCbor)(JSON.parse(inputs.data) as V);
          return { notes: [t(`${bytes.length} バイト`, `${bytes.length} bytes`)], text: opts.enc === "hex" ? bytesToHex(bytes, " ") : bytesToBase64(bytes), downloads: [{ name: msgpack ? "data.msgpack" : "data.cbor", data: bytes, mime: "application/octet-stream" }] };
        }
        const bytes = toBytes(inputs.data, files, String(opts.enc));
        if (!bytes || !bytes.length) return { error: t(`${opts.enc === "hex" ? "16進数" : "Base64"}として読み取れません。`, `Cannot read the input as ${opts.enc === "hex" ? "hex" : "Base64"}.`) };
        const v = (msgpack ? decodeMsgpack : decodeCbor)(bytes);
        return { notes: [t("バイナリは {\"$binary\": 16進}、拡張型は {\"$ext\": 型, \"data\": 16進}、64ビットで安全な範囲を超える整数は文字列で表します。", "Binary data is shown as {\"$binary\": hex}, extension types as {\"$ext\": type, \"data\": hex}, and integers beyond the safe 64-bit range as strings.")], text: JSON.stringify(v, null, 2) };
      } catch (e) { return { error: e instanceof SyntaxError ? t(`JSONの形式が正しくありません: ${e.message}`, `Invalid JSON: ${e.message}`) : t(`処理できません: ${(e as Error).message}`, `Cannot process: ${(e as Error).message}`) }; }
    },
  },

  "protobuf-decoder": {
    inputs: [{ id: "data", label: ["Protobufのバイト列（16進またはBase64）", "Protobuf bytes (hex or Base64)"], rows: 6 }],
    files: { label: ["バイナリファイルをドロップ（任意）", "Drop a binary file (optional)"] },
    options: [{ id: "enc", kind: "select", label: ["表記", "Notation"], default: "hex", choices: [{ value: "hex", label: "hex" }, { value: "base64", label: "Base64" }] }],
    sample: { data: "12 07 74 65 73 74 69 6e 67 1a 03 08 96 01 25 00 00 80 3f" },
    outputLabel: ["デコード結果", "Decoded fields"],
    run: ({ inputs, files, opts, t }) => {
      const bytes = toBytes(inputs.data, files, String(opts.enc));
      if (!bytes || !bytes.length) return { error: t(`${opts.enc === "hex" ? "16進数" : "Base64"}として読み取れません。`, `Cannot read the input as ${opts.enc === "hex" ? "hex" : "Base64"}.`) };
      try { return { notes: [t(".protoのスキーマなしで解析するため、型は推測です。1つのフィールドに複数の解釈（符号付き・float など）を併記します。", "Without the .proto schema, types are guesses. Several interpretations (signed, float, …) are listed for each field.")], text: formatProtobuf(decodeProtobuf(bytes)) }; }
      catch (e) { return { error: t(`Protobufとして解析できません: ${(e as Error).message}`, `Cannot parse as Protobuf: ${(e as Error).message}`) }; }
    },
  },

  "graphql-tool": {
    inputs: [{ id: "src", label: ["GraphQL（クエリまたはSDL）", "GraphQL (query or SDL)"], rows: 12 }],
    options: [{ id: "mode", kind: "select", label: ["操作", "Action"], default: "format", choices: [{ value: "format", label: ["整形", "Format"] }, { value: "ts", label: ["SDL → TypeScript型", "SDL → TypeScript types"] }] }],
    sample: { src: 'type User implements Node { id: ID! name: String posts(first: Int): [Post!]! role: Role }\ninterface Node { id: ID! }\ntype Post { title: String! }\nenum Role { ADMIN USER }' },
    run: ({ inputs, opts, t }) => {
      try { return { text: opts.mode === "ts" ? sdlToTypeScript(inputs.src) : formatGraphql(inputs.src) }; }
      catch (e) { return { error: t(`GraphQLを処理できません: ${(e as Error).message}`, `Cannot process the GraphQL: ${(e as Error).message}`) }; }
    },
  },

  "ndjson-viewer": {
    inputs: [{ id: "text", label: ["NDJSON / JSON Lines（構造化ログ）", "NDJSON / JSON Lines (structured logs)"], rows: 10 }],
    files: { accept: ".ndjson,.jsonl,.log,.json,.txt", label: ["ログファイルをドロップ（任意）", "Drop a log file (optional)"] },
    options: [
      { id: "level", kind: "select", label: ["最低レベル", "Minimum level"], default: "any", choices: Object.keys(LEVELS).map((v) => ({ value: v, label: v })) },
      { id: "text", kind: "text", label: ["含む文字列", "Contains text"], default: "" },
      { id: "field", kind: "text", label: ["フィールド=値（例: ctx.host=a）", "field=value (e.g. ctx.host=a)"], default: "" },
      { id: "cols", kind: "text", label: ["表示する列（カンマ区切り、空なら自動）", "Columns (comma separated; empty for auto)"], default: "" },
      { id: "limit", kind: "number", label: ["最大表示行数", "Max rows"], default: 200, min: 1, max: 2000 },
    ],
    sample: { text: '{"time":"2026-01-01T00:00:02Z","level":"error","msg":"db down","ctx":{"host":"a"}}\n{"time":"2026-01-01T00:00:01Z","level":"info","msg":"started","ctx":{"host":"b"}}\n{"time":"2026-01-01T00:00:03Z","level":"warn","msg":"slow query","ms":1520}' },
    run: ({ inputs, files, opts, t }) => {
      const { rows, errors, keys } = parseNdjson(textOrFile(inputs.text, files));
      if (!rows.length) return { error: t("解析できるJSON行がありません。", "No parsable JSON lines.") };
      const shown = filterRows(rows, keys, { text: String(opts.text), minLevel: LEVELS[opts.level as keyof typeof LEVELS], field: String(opts.field), limit: Number(opts.limit) || 200 });
      const cols = String(opts.cols).split(",").map((c) => c.trim()).filter(Boolean);
      const columns = cols.length ? cols : defaultColumns(keys);
      const str = (v: unknown) => (v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
      return {
        notes: [t(`${rows.length} 行を解析、${shown.length} 行を表示${errors.length ? `。JSONではない行: ${errors.length}（行 ${errors.slice(0, 5).map((e) => e.line).join(", ")}${errors.length > 5 ? " …" : ""}）` : ""}。`, `Parsed ${rows.length} lines, showing ${shown.length}${errors.length ? `. Non-JSON lines: ${errors.length} (lines ${errors.slice(0, 5).map((e) => e.line).join(", ")}${errors.length > 5 ? " …" : ""})` : ""}.`)],
        tables: [
          ...(levelCounts(rows, keys).length ? [{ title: t("レベル別の件数", "Count by level"), head: [t("レベル", "Level"), t("件数", "Count")], rows: levelCounts(rows, keys) }] : []),
          { title: t("ログ", "Log lines"), head: ["#", ...columns], rows: shown.map((r) => [r.line, ...columns.map((c) => str(r.data[c]))]) },
        ],
      };
    },
  },

  "fake-data-generator": {
    inputs: [],
    runWithoutInput: true,
    options: [
      { id: "fields", kind: "text", label: [`項目（カンマ区切り。例: ${FIELD_NAMES.slice(0, 8).join(",")}）`, `Fields (comma separated, e.g. ${FIELD_NAMES.slice(0, 8).join(",")})`], default: "id,name,email,phone,address,birthday" },
      { id: "count", kind: "number", label: ["件数（最大1000）", "Rows (max 1000)"], default: 10, min: 1, max: 1000 },
      { id: "seed", kind: "number", label: ["シード（同じ値なら同じデータ）", "Seed (same value gives the same data)"], default: 1 },
      { id: "locale", kind: "select", label: ["地域", "Locale"], default: "ja", choices: [{ value: "ja", label: "日本 (ja)" }, { value: "en", label: "US (en)" }] },
      { id: "format", kind: "select", label: ["形式", "Format"], default: "csv", choices: [{ value: "csv", label: "CSV" }, { value: "tsv", label: "TSV" }, { value: "json", label: "JSON" }, { value: "ndjson", label: "NDJSON" }, { value: "sql", label: "SQL INSERT" }] },
      { id: "table", kind: "text", label: ["テーブル名（SQL用）", "Table name (for SQL)"], default: "users", hidden: (v) => v.format !== "sql" },
    ],
    safetyNote: ["生成するのは架空のダミーデータです。実在の個人情報ではありません。", "The generated data is fictional dummy data, not real personal information."],
    run: ({ opts, t }) => {
      const fields = String(opts.fields).split(",").map((f) => f.trim()).filter(Boolean);
      if (!fields.length) return { error: t("項目を1つ以上指定してください。", "Specify at least one field.") };
      const count = Math.max(1, Math.min(1000, Math.floor(Number(opts.count)) || 1));
      const rows = generateRows(fields, count, Math.floor(Number(opts.seed)) || 0, opts.locale as "ja" | "en");
      const unknown = fields.filter((f) => !FIELD_NAMES.some((n) => n.split(":")[0] === f.split(":")[0]));
      const ext = { csv: "csv", tsv: "tsv", json: "json", ndjson: "ndjson", sql: "sql" }[String(opts.format)] ?? "txt";
      const text = renderRows(rows, fields, opts.format as "csv", String(opts.table) || "users");
      return { notes: unknown.length ? [t(`未対応の項目: ${unknown.join(", ")}（? になります）。使える項目: ${FIELD_NAMES.join(", ")}`, `Unsupported fields: ${unknown.join(", ")} (they become ?). Available: ${FIELD_NAMES.join(", ")}`)] : [], text, downloads: [{ name: `dummy.${ext}`, data: text, mime: "text/plain" }] };
    },
  },

  "markdown-table": {
    inputs: [{ id: "text", label: ["CSV / TSV / Markdown表", "CSV / TSV / Markdown table"], rows: 10 }],
    files: { accept: ".csv,.tsv,.md,.txt", label: ["ファイルをドロップ（任意）", "Drop a file (optional)"] },
    options: [
      { id: "to", kind: "select", label: ["出力", "Output"], default: "md", choices: [{ value: "md", label: ["Markdown表（整形）", "Markdown table (formatted)"] }, { value: "csv", label: "CSV" }, { value: "tsv", label: "TSV" }, { value: "json", label: "JSON" }] },
      { id: "align", kind: "select", label: ["配置（Markdown出力）", "Alignment (Markdown output)"], default: "none", choices: [{ value: "none", label: ["そのまま", "Keep"] }, { value: "left", label: ["左揃え", "Left"] }, { value: "center", label: ["中央揃え", "Center"] }, { value: "right", label: ["右揃え", "Right"] }], hidden: (v) => v.to !== "md" },
    ],
    sample: { text: "名前,部署,メモ\n田中,開発,\"A, B\"\nSmith,営業,x|y" },
    run: ({ inputs, files, opts, t }) => {
      const src = textOrFile(inputs.text, files);
      const grid = parseMarkdownTable(src) ?? gridFromRows(parseDelimited(src));
      if (!grid.header.some(Boolean)) return { error: t("表として読み取れません。", "Cannot read the input as a table.") };
      switch (opts.to) {
        case "csv": return { text: gridToDelimited(grid, ",") };
        case "tsv": return { text: gridToDelimited(grid, "\t") };
        case "json": return { text: JSON.stringify(grid.rows.map((r) => Object.fromEntries(grid.header.map((h, i) => [h, r[i]]))), null, 2) };
        default: return { text: formatMarkdownTable(grid, opts.align as Align) };
      }
    },
  },

  "zip-viewer": {
    inputs: [],
    files: { multiple: true, label: ["ZIP（閲覧）または複数ファイル（作成）をドロップ", "Drop a ZIP (to view) or several files (to create one)"] },
    options: [{ id: "mode", kind: "select", label: ["操作", "Action"], default: "list", choices: [{ value: "list", label: ["ZIPの中身を表示・取り出し", "View and extract a ZIP"] }, { value: "create", label: ["ファイルをZIPにまとめる", "Create a ZIP from files"] }] }],
    run: ({ files, opts, t }) => {
      if (opts.mode === "create") {
        const used = new Set<string>();
        const entries: Record<string, Uint8Array> = {};
        for (const f of files) { let n = f.name, i = 2; while (used.has(n)) n = f.name.replace(/(\.[^.]*)?$/, ` (${i++})$1`); used.add(n); entries[n] = f.bytes; }
        const zip = zipSync(entries, { level: 6 });
        return { notes: [t(`${files.length} ファイル → ${zip.length.toLocaleString()} バイト`, `${files.length} file(s) → ${zip.length.toLocaleString()} bytes`)], downloads: [{ name: "archive.zip", data: zip, mime: "application/zip" }] };
      }
      const zip = files[0];
      const list: { name: string; size: number; originalSize: number; compression: number }[] = [];
      try { unzipSync(zip.bytes, { filter: (f) => { list.push({ name: f.name, size: f.size, originalSize: f.originalSize, compression: f.compression }); return false; } }); }
      catch { return { error: t("ZIPとして読み取れません（壊れている、またはZIP64・暗号化などに未対応の可能性があります）。", "Cannot read as a ZIP (it may be corrupt, or use unsupported features such as ZIP64 or encryption).") }; }
      const files2 = list.filter((e) => !e.name.endsWith("/"));
      const total = files2.reduce((n, e) => n + e.originalSize, 0);
      const extract = files2.slice(0, 20).filter((e) => e.originalSize <= 20 * 1024 * 1024);
      const downloads: { name: string; data: Uint8Array; mime: string }[] = [];
      if (total <= 100 * 1024 * 1024 && extract.length) {
        try { const got = unzipSync(zip.bytes, { filter: (f) => extract.some((e) => e.name === f.name) }); for (const e of extract) if (got[e.name]) downloads.push({ name: e.name.split("/").pop() || e.name, data: got[e.name], mime: "application/octet-stream" }); } catch { /* 取り出しできないエントリは表示のみ */ }
      }
      return {
        notes: [t(`${files2.length} ファイル、展開後 ${total.toLocaleString()} バイト。取り出しボタンは先頭20件までです。`, `${files2.length} file(s), ${total.toLocaleString()} bytes expanded. Extract buttons are limited to the first 20 entries.`), ...(total > 1024 * 1024 * 1024 ? [t("展開後のサイズが非常に大きいZIPです（ZIP爆弾の可能性）。", "The expanded size is very large (possibly a zip bomb).")] : [])],
        tables: [{ head: [t("名前", "Name"), t("展開後(B)", "Size (B)"), t("圧縮後(B)", "Compressed (B)"), t("方式", "Method"), t("圧縮率", "Ratio")], rows: list.map((e) => [e.name, e.originalSize, e.size, e.compression === 0 ? "stored" : e.compression === 8 ? "deflate" : String(e.compression), e.originalSize ? `${Math.round((e.size / e.originalSize) * 100)}%` : "-"]) }],
        downloads,
      };
    },
  },

  "lockfile-diff": {
    inputs: [
      { id: "old", label: ["変更前のロックファイル", "Old lockfile"], rows: 8 },
      { id: "new", label: ["変更後のロックファイル", "New lockfile"], rows: 8 },
    ],
    run: ({ inputs, t }) => {
      if (!inputs.old.trim() || !inputs.new.trim()) return { notes: [t("変更前と変更後の両方を貼り付けてください（package-lock.json・yarn.lock・pnpm-lock.yaml）。", "Paste both old and new (package-lock.json, yarn.lock, pnpm-lock.yaml).")] };
      try {
        const a = readLockfile(inputs.old), b = readLockfile(inputs.new);
        const changes = diffLockfiles(a.map, b.map);
        const n = (k: string) => changes.filter((c) => c.kind === k).length;
        return {
          notes: [t(`${a.format} → ${b.format}: 追加 ${n("added")}・削除 ${n("removed")}・変更 ${n("changed")}。メジャー更新: ${changes.filter((c) => c.bump === "major" || c.bump === "premajor").length} 件。`, `${a.format} → ${b.format}: ${n("added")} added, ${n("removed")} removed, ${n("changed")} changed. Major updates: ${changes.filter((c) => c.bump === "major" || c.bump === "premajor").length}.`), t("同じパッケージが複数のバージョンで入っている場合は、すべてのバージョンを並べて比較します。", "When a package is installed in several versions, all versions are compared together.")],
          tables: [{ head: [t("パッケージ", "Package"), t("種別", "Change"), t("変更前", "From"), t("変更後", "To"), t("更新の大きさ", "Bump")], rows: changes.map((c) => [c.name, c.kind, c.from.join(", ") || "-", c.to.join(", ") || "-", c.bump || "-"]) }],
        };
      } catch (e) { return { error: (e as Error).message === "unrecognized lockfile" ? t("ロックファイルとして認識できません（npm・yarn・pnpm に対応）。", "Not recognized as a lockfile (npm, yarn, and pnpm are supported).") : t(`解析できません: ${(e as Error).message}`, `Cannot parse: ${(e as Error).message}`) }; }
    },
  },

  "package-json-checker": {
    inputs: [{ id: "json", label: ["package.json", "package.json"], rows: 12 }],
    files: { accept: ".json", label: ["package.json をドロップ（任意）", "Drop a package.json (optional)"] },
    sample: { json: '{\n  "name": "demo",\n  "version": "1.0.0",\n  "dependencies": { "react": "^19.0.0", "typescript": "^5.0.0", "left-pad": "*", "lodash": "^4.17.0" },\n  "devDependencies": { "lodash": "^3.0.0", "eslint": "^9.0.0" }\n}' },
    run: ({ inputs, files, t }) => {
      try {
        const f = checkPackageJson(textOrFile(inputs.json, files), t);
        return { notes: [countNote(t, f)], tables: [findingsTable(f, (x) => x.target, [t("レベル", "Level"), t("対象", "Target"), t("内容", "Message")])] };
      } catch (e) { return jsonError(t, e); }
    },
  },
};
