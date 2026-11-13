import * as React from "react";

import { DiffView } from "@/components/tools/more/diff-view";
import { buildScale } from "@/lib/more/color-scale";
import { cmpSpec, formatSpec, specificity, splitSelectors } from "@/lib/more/css-specificity";
import { fluidClamp, pxToRem, remToPx, sizeAt } from "@/lib/more/css-units";
import { composeToRun, parseDockerRun, runToCompose } from "@/lib/more/docker";
import { analyzeWorkflow } from "@/lib/more/gha";
import { evaluateGlobs } from "@/lib/more/glob";
import { htmlToJsx } from "@/lib/more/html-jsx";
import { checkManifests, decodeSecrets, describeResource, parseManifests } from "@/lib/more/k8s-check";
import { analyzeExplain, parseExplain } from "@/lib/more/mysql-explain";
import { baseUrl, curlExamples, listOperations, loadSpec, schemasToTypeScript } from "@/lib/more/openapi-view";
import { diffSchemas, type Dialect } from "@/lib/more/sql-schema-diff";
import { sortChanges, summarizePlan } from "@/lib/more/terraform-plan";
import { parseUnifiedDiff } from "@/lib/more/unified-diff";
import { textOrFile } from "@/lib/more/util";

import { countNote, findingsTable, type Specs } from "./shared";

export const specs: Specs = {
  "css-specificity": {
    inputs: [{ id: "css", label: ["CSSセレクター（カンマ区切り、または1行1つ）", "CSS selectors (comma separated or one per line)"], rows: 8 }],
    sample: { css: "#nav .item:hover\nul li a::before\n:is(#a, .b) p\n:where(.reset) .x\n.btn.btn-primary:not(.disabled)" },
    run: ({ inputs, t }) => {
      const sels = inputs.css.split(/\n/).flatMap((l) => splitSelectors(l)).filter(Boolean);
      const rows = sels.map((s) => ({ s, spec: specificity(s) })).sort((a, b) => cmpSpec(b.spec, a.spec));
      return { notes: [t("(a,b,c): a = IDセレクター、b = クラス・属性・疑似クラス、c = 要素・疑似要素。大きい順に左から比較し、同じ詳細度なら後に書いたルールが勝ちます。", "(a,b,c): a = ID selectors, b = classes, attributes, and pseudo-classes, c = elements and pseudo-elements. Compared left to right; with equal specificity, the later rule wins.")], tables: [{ head: [t("順位", "Rank"), t("セレクター", "Selector"), "(a,b,c)"], rows: rows.map((r, i) => [i + 1, r.s, formatSpec(r.spec)]) }] };
    },
  },

  "css-units": {
    inputs: [],
    runWithoutInput: true,
    options: [
      { id: "mode", kind: "select", label: ["操作", "Mode"], default: "clamp", choices: [{ value: "clamp", label: ["フルードな clamp() を作る", "Build a fluid clamp()"] }, { value: "convert", label: ["px ⇄ rem 変換", "px ⇄ rem conversion"] }] },
      { id: "base", kind: "number", label: ["ルートのフォントサイズ（px）", "Root font size (px)"], default: 16, min: 1 },
      { id: "minSize", kind: "number", label: ["最小サイズ（px）", "Min size (px)"], default: 16, hidden: (v) => v.mode !== "clamp" },
      { id: "maxSize", kind: "number", label: ["最大サイズ（px）", "Max size (px)"], default: 24, hidden: (v) => v.mode !== "clamp" },
      { id: "minVw", kind: "number", label: ["最小の画面幅（px）", "Min viewport (px)"], default: 320, hidden: (v) => v.mode !== "clamp" },
      { id: "maxVw", kind: "number", label: ["最大の画面幅（px）", "Max viewport (px)"], default: 1280, hidden: (v) => v.mode !== "clamp" },
      { id: "unit", kind: "select", label: ["出力の単位", "Output unit"], default: "rem", choices: [{ value: "rem", label: "rem" }, { value: "px", label: "px" }], hidden: (v) => v.mode !== "clamp" },
      { id: "value", kind: "number", label: ["値", "Value"], default: 24, hidden: (v) => v.mode !== "convert" },
    ],
    run: ({ opts, t }) => {
      const base = Number(opts.base) || 16;
      if (opts.mode === "convert") {
        const v = Number(opts.value);
        return { tables: [{ head: [t("入力", "Input"), t("結果", "Result")], rows: [[`${v}px`, `${Math.round(pxToRem(v, base) * 10000) / 10000}rem`], [`${v}rem`, `${Math.round(remToPx(v, base) * 10000) / 10000}px`]] }] };
      }
      const [a, b, c, d] = [Number(opts.minSize), Number(opts.maxSize), Number(opts.minVw), Number(opts.maxVw)];
      if (c === d) return { error: t("最小と最大の画面幅が同じです。", "The min and max viewport widths are the same.") };
      const r = fluidClamp(a, b, c, d, base, opts.unit as "rem" | "px");
      const widths = [c, Math.round((c + d) / 2), d, 375, 768, 1024, 1440].filter((w, i, arr) => arr.indexOf(w) === i).sort((x, y) => x - y);
      return { notes: [t(`画面幅 ${c}px 以下で ${a}px、${d}px 以上で ${b}px になり、その間は線形に変化します。`, `${a}px at ${c}px viewport and below, ${b}px at ${d}px and above, changing linearly in between.`)], text: `font-size: ${r.css};`, tables: [{ title: t("画面幅ごとの実際のサイズ", "Actual size by viewport width"), head: [t("画面幅(px)", "Viewport (px)"), t("サイズ(px)", "Size (px)")], rows: widths.map((w) => [w, Math.round(sizeAt(a, b, c, d, w) * 100) / 100]) }] };
    },
  },

  "css-visual-generator": {
    inputs: [],
    runWithoutInput: true,
    options: [
      { id: "mode", kind: "select", label: ["種類", "Type"], default: "gradient", choices: [{ value: "gradient", label: ["グラデーション", "Gradient"] }, { value: "shadow", label: ["ボックスシャドウ", "Box shadow"] }, { value: "easing", label: ["イージング（cubic-bezier）", "Easing (cubic-bezier)"] }] },
      { id: "gType", kind: "select", label: ["グラデーションの種類", "Gradient type"], default: "linear", choices: [{ value: "linear", label: "linear-gradient" }, { value: "radial", label: "radial-gradient" }, { value: "conic", label: "conic-gradient" }], hidden: (v) => v.mode !== "gradient" },
      { id: "angle", kind: "number", label: ["角度（deg）", "Angle (deg)"], default: 135, min: 0, max: 360, hidden: (v) => v.mode !== "gradient" || v.gType === "radial" },
      { id: "stops", kind: "text", label: ["色（カンマ区切り。例: #6366f1, #ec4899 40%, #f59e0b）", "Colors (comma separated, e.g. #6366f1, #ec4899 40%, #f59e0b)"], default: "#6366f1, #ec4899, #f59e0b", hidden: (v) => v.mode !== "gradient" },
      { id: "x", kind: "number", label: ["横オフセット（px）", "Offset X (px)"], default: 0, hidden: (v) => v.mode !== "shadow" },
      { id: "y", kind: "number", label: ["縦オフセット（px）", "Offset Y (px)"], default: 8, hidden: (v) => v.mode !== "shadow" },
      { id: "blur", kind: "number", label: ["ぼかし（px）", "Blur (px)"], default: 24, min: 0, hidden: (v) => v.mode !== "shadow" },
      { id: "spread", kind: "number", label: ["広がり（px）", "Spread (px)"], default: -4, hidden: (v) => v.mode !== "shadow" },
      { id: "color", kind: "text", label: ["色（#RRGGBB）", "Color (#RRGGBB)"], default: "#000000", hidden: (v) => v.mode !== "shadow" },
      { id: "opacity", kind: "number", label: ["不透明度（0〜1）", "Opacity (0-1)"], default: 0.25, min: 0, max: 1, hidden: (v) => v.mode !== "shadow" },
      { id: "inset", kind: "checkbox", label: ["内側（inset）", "Inset"], default: false, hidden: (v) => v.mode !== "shadow" },
      { id: "preset", kind: "select", label: ["プリセット", "Preset"], default: "ease", choices: [["ease", "0.25, 0.1, 0.25, 1"], ["ease-in", "0.42, 0, 1, 1"], ["ease-out", "0, 0, 0.58, 1"], ["ease-in-out", "0.42, 0, 0.58, 1"], ["easeOutBack", "0.34, 1.56, 0.64, 1"], ["easeInOutQuint", "0.83, 0, 0.17, 1"], ["custom", ""]].map(([v, c]) => ({ value: v, label: c ? `${v} (${c})` : "custom" })), hidden: (v) => v.mode !== "easing" },
      { id: "bezier", kind: "text", label: ["カスタム（x1, y1, x2, y2）", "Custom (x1, y1, x2, y2)"], default: "0.4, 0, 0.2, 1", hidden: (v) => v.mode !== "easing" || v.preset !== "custom" },
    ],
    run: ({ opts, t }) => {
      let css = "";
      let preview: React.ReactNode = null;
      if (opts.mode === "gradient") {
        const stops = String(opts.stops).split(",").map((s) => s.trim()).filter(Boolean).join(", ");
        const angle = Number(opts.angle);
        css = opts.gType === "linear" ? `linear-gradient(${angle}deg, ${stops})` : opts.gType === "radial" ? `radial-gradient(circle, ${stops})` : `conic-gradient(from ${angle}deg, ${stops})`;
        css = `background: ${css};`;
        preview = React.createElement("div", { className: "h-40 rounded-lg border", style: { background: css.replace(/^background: /, "").replace(/;$/, "") }, role: "img", "aria-label": t("グラデーションのプレビュー", "Gradient preview") });
      } else if (opts.mode === "shadow") {
        const hex = /^#?([0-9a-f]{6})$/i.exec(String(opts.color).trim());
        if (!hex) return { error: t("色は #RRGGBB の形式で入力してください。", "Enter the color as #RRGGBB.") };
        const rgb = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).join(", ");
        const value = `${opts.inset ? "inset " : ""}${Number(opts.x)}px ${Number(opts.y)}px ${Number(opts.blur)}px ${Number(opts.spread)}px rgba(${rgb}, ${Number(opts.opacity)})`;
        css = `box-shadow: ${value};`;
        preview = React.createElement("div", { className: "flex h-40 items-center justify-center rounded-lg border bg-muted/30" }, React.createElement("div", { className: "h-24 w-40 rounded-lg bg-background", style: { boxShadow: value }, role: "img", "aria-label": t("シャドウのプレビュー", "Shadow preview") }));
      } else {
        const presets: Record<string, string> = { ease: "0.25, 0.1, 0.25, 1", "ease-in": "0.42, 0, 1, 1", "ease-out": "0, 0, 0.58, 1", "ease-in-out": "0.42, 0, 0.58, 1", easeOutBack: "0.34, 1.56, 0.64, 1", easeInOutQuint: "0.83, 0, 0.17, 1" };
        const raw = opts.preset === "custom" ? String(opts.bezier) : presets[String(opts.preset)];
        const n = raw.split(",").map((x) => Number(x.trim()));
        if (n.length !== 4 || n.some(Number.isNaN) || n[0] < 0 || n[0] > 1 || n[2] < 0 || n[2] > 1) return { error: t("x1・x2 は 0〜1、4つの数値を指定してください。", "Provide four numbers; x1 and x2 must be between 0 and 1.") };
        css = `transition-timing-function: cubic-bezier(${n.join(", ")});`;
        const pts = Array.from({ length: 41 }, (_, i) => { const u = i / 40; const x = 3 * (1 - u) ** 2 * u * n[0] + 3 * (1 - u) * u ** 2 * n[2] + u ** 3; const y = 3 * (1 - u) ** 2 * u * n[1] + 3 * (1 - u) * u ** 2 * n[3] + u ** 3; return `${(x * 200).toFixed(1)},${(200 - y * 160 - 20).toFixed(1)}`; }).join(" ");
        preview = React.createElement("svg", { viewBox: "0 0 200 200", className: "h-48 w-48 rounded-lg border bg-muted/30", role: "img", "aria-label": t("イージング曲線", "Easing curve") }, React.createElement("line", { x1: 0, y1: 180, x2: 200, y2: 20, stroke: "currentColor", strokeOpacity: 0.2, strokeDasharray: "4" }), React.createElement("polyline", { points: pts, fill: "none", stroke: "currentColor", strokeWidth: 3 }));
      }
      return { preview, text: css };
    },
  },

  "color-scale": {
    inputs: [{ id: "color", label: ["基準にする色（#RRGGBB）", "Base color (#RRGGBB)"], rows: 1, placeholder: "#3b82f6" }],
    options: [{ id: "name", kind: "text", label: ["色の名前（CSS変数・Tailwind用）", "Color name (for CSS variables and Tailwind)"], default: "brand" }],
    sample: { color: "#3b82f6" },
    run: ({ inputs, opts, t }) => {
      const scale = buildScale(inputs.color.trim());
      if (!scale) return { error: t("色を #RGB または #RRGGBB の形式で入力してください。", "Enter a color as #RGB or #RRGGBB.") };
      const name = String(opts.name).trim() || "brand";
      const swatch = React.createElement("div", { className: "grid grid-cols-6 gap-2 sm:grid-cols-11", role: "img", "aria-label": t("カラースケール", "Color scale") }, scale.map((s) => React.createElement("div", { key: s.step, className: "flex flex-col items-center gap-1 text-xs" }, React.createElement("div", { className: "h-12 w-full rounded-md border", style: { background: s.hex } }), React.createElement("span", null, s.step))));
      return {
        notes: [t("OKLCH（知覚的に均一な色空間）で明度を段階的に変え、色相を保っています。元の色に一番近い段は、その色そのものです。", "Lightness is stepped in OKLCH (a perceptually uniform color space) while keeping the hue. The step closest to your color is that exact color.")],
        preview: swatch,
        tables: [{ head: [t("段", "Step"), "HEX", t("白との対比", "On white"), t("黒との対比", "On black"), ""], rows: scale.map((s) => [s.step, s.hex, s.onWhite, s.onBlack, s.anchor ? t("← 元の色", "← your color") : ""]) }],
        text: `:root {\n${scale.map((s) => `  --${name}-${s.step}: ${s.hex};`).join("\n")}\n}\n\n// tailwind.config\n${name}: {\n${scale.map((s) => `  ${s.step}: "${s.hex}",`).join("\n")}\n}`,
      };
    },
  },

  "html-to-jsx": {
    inputs: [{ id: "html", label: ["HTML / SVG", "HTML / SVG"], rows: 12 }],
    options: [
      { id: "component", kind: "checkbox", label: ["Reactコンポーネントとして出力", "Output as a React component"], default: false },
      { id: "name", kind: "text", label: ["コンポーネント名", "Component name"], default: "Component", hidden: (v) => !v.component },
    ],
    sample: { html: '<div class="card" style="margin-top: 8px">\n  <label for="n">Name</label>\n  <input id="n" type="text" maxlength="20" readonly>\n  <!-- save -->\n  <svg viewBox="0 0 24 24"><path stroke-width="2" d="M5 12h14"/></svg>\n</div>' },
    files: { accept: ".html,.htm,.svg", label: ["HTML / SVGファイルをドロップ（任意）", "Drop an HTML / SVG file (optional)"] },
    run: ({ inputs, files, opts, t }) => {
      const r = htmlToJsx(textOrFile(inputs.html, files), { component: !!opts.component, name: String(opts.name) || "Component", indent: 2 });
      const notes: Record<string, string> = { event: t("onclick などのイベント属性は、関数に置き換えて元のコードをコメントにしました。処理を実装してください。", "Event attributes such as onclick were replaced with functions holding the original code as a comment. Implement the handler."), fragment: t("ルート要素が複数あるため、<>…</> で包みました。", "Multiple root elements were wrapped in <>…</>."), unclosed: t("閉じられていないタグを補いました。", "Unclosed tags were closed.") };
      return { notes: r.notes.map((n) => notes[n]), text: r.jsx };
    },
  },

  "glob-tester": {
    inputs: [{ id: "patterns", label: ["globパターン（1行1つ。! で始めると除外）", "Glob patterns (one per line; a leading ! excludes)"], rows: 5 }, { id: "paths", label: ["テストするパス（1行1つ）", "Paths to test (one per line)"], rows: 8 }],
    options: [{ id: "dot", kind: "checkbox", label: ["ドットで始まるファイルにも * を一致させる", "Let * match dotfiles"], default: false }, { id: "nocase", kind: "checkbox", label: ["大文字小文字を区別しない", "Case-insensitive"], default: false }],
    sample: { patterns: "src/**/*.{ts,tsx}\n!**/*.test.ts", paths: "src/a.ts\nsrc/ui/button.tsx\nsrc/a.test.ts\nlib/b.ts\nsrc/.hidden/x.ts" },
    run: ({ inputs, opts, t }) => {
      const patterns = inputs.patterns.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
      const paths = inputs.paths.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
      const rows = paths.map((p) => { const r = evaluateGlobs(patterns, p, { dot: !!opts.dot, nocase: !!opts.nocase }); return [r.included ? "✔" : "✖", p, r.by ?? "-"]; });
      return { notes: [t(`${rows.filter((r) => r[0] === "✔").length} / ${rows.length} 件が対象。最後に一致したパターンが結果を決めます。`, `${rows.filter((r) => r[0] === "✔").length} of ${rows.length} included. The last matching pattern decides.`)], tables: [{ head: [t("対象", "Included"), t("パス", "Path"), t("決めたパターン", "Decided by")], rows }] };
    },
  },

  "diff-viewer": {
    inputs: [{ id: "diff", label: ["unified diff（git diff の出力など）", "Unified diff (e.g. git diff output)"], rows: 12 }],
    files: { accept: ".diff,.patch,.txt", label: [".diff / .patch ファイルをドロップ（任意）", "Drop a .diff / .patch file (optional)"] },
    options: [{ id: "side", kind: "checkbox", label: ["左右に並べて表示", "Side by side"], default: true }],
    sample: { diff: "diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,3 +1,3 @@\n const a = 1;\n-const b = 2;\n+const b = 20;\n export {};\n" },
    run: ({ inputs, files, opts, t }) => {
      const parsed = parseUnifiedDiff(textOrFile(inputs.diff, files));
      if (!parsed.length) return { error: t("unified diff を読み取れません。", "Could not read a unified diff.") };
      const added = parsed.reduce((n, f) => n + f.added, 0), removed = parsed.reduce((n, f) => n + f.removed, 0);
      return { notes: [t(`${parsed.length} ファイル、+${added} −${removed}`, `${parsed.length} file(s), +${added} −${removed}`)], preview: React.createElement(DiffView, { files: parsed, sideBySide: !!opts.side }) };
    },
  },

  "mysql-explain-viewer": {
    inputs: [{ id: "text", label: ["EXPLAIN の結果（表・TSV・\\G形式・FORMAT=JSON）", "EXPLAIN output (table, TSV, \\G format, or FORMAT=JSON)"], rows: 10 }],
    sample: { text: "+----+-------------+-------+------+---------------+------+---------+------+--------+----------+----------------------------------------------+\n| id | select_type | table | type | possible_keys | key  | key_len | ref  | rows   | filtered | Extra                                        |\n+----+-------------+-------+------+---------------+------+---------+------+--------+----------+----------------------------------------------+\n|  1 | SIMPLE      | users | ALL  | NULL          | NULL | NULL    | NULL | 120000 |     5.00 | Using where; Using temporary; Using filesort |\n+----+-------------+-------+------+---------------+------+---------+------+--------+----------+----------------------------------------------+" },
    run: ({ inputs, t }) => {
      try {
        const rows = parseExplain(inputs.text);
        if (!rows.length) return { error: t("EXPLAINの結果として読み取れません。", "Could not read this as EXPLAIN output.") };
        const warnings = analyzeExplain(rows, t);
        const cols = ["id", "select_type", "table", "type", "possible_keys", "key", "key_len", "rows", "filtered", "extra"].filter((c) => rows.some((r) => r[c]));
        return { notes: [countNote(t, warnings.map((w) => ({ level: w.level === "info" ? "ok" : w.level })))], tables: [findingsTable(warnings, (w) => w.table, [t("レベル", "Level"), t("テーブル", "Table"), t("内容", "Message")]), { title: t("実行計画", "Plan"), head: cols, rows: rows.map((r) => cols.map((c) => r[c] ?? "")) }] };
      } catch { return { error: t("EXPLAINの結果を解析できません。", "Cannot parse the EXPLAIN output.") }; }
    },
  },

  "sql-schema-diff": {
    inputs: [{ id: "old", label: ["変更前のスキーマ（CREATE TABLE）", "Old schema (CREATE TABLE)"], rows: 8 }, { id: "new", label: ["変更後のスキーマ（CREATE TABLE）", "New schema (CREATE TABLE)"], rows: 8 }],
    options: [{ id: "dialect", kind: "select", label: ["方言", "Dialect"], default: "postgres", choices: [{ value: "postgres", label: "PostgreSQL" }, { value: "mysql", label: "MySQL" }] }],
    sample: { old: "CREATE TABLE users (\n  id int PRIMARY KEY,\n  name varchar(50) NOT NULL,\n  age int\n);", new: "CREATE TABLE users (\n  id int PRIMARY KEY,\n  name varchar(100) NOT NULL,\n  email varchar(255) NOT NULL DEFAULT ''\n);\nCREATE TABLE posts (id int PRIMARY KEY, title text);" },
    outputLabel: ["マイグレーションSQL", "Migration SQL"],
    run: ({ inputs, opts, t }) => {
      if (!inputs.old.trim() || !inputs.new.trim()) return { notes: [t("変更前と変更後の両方のCREATE TABLEを入力してください。", "Enter CREATE TABLE statements for both old and new.")] };
      const r = diffSchemas(inputs.old, inputs.new, opts.dialect as Dialect);
      return { notes: [r.statements.length ? t(`${r.statements.length} 件の変更。データの移行・インデックスの再作成・ロックの影響は確認してください。DROP は元に戻せません。`, `${r.statements.length} change(s). Review data migration, index rebuilds, and locking. DROP cannot be undone.`) : t("差分はありません。", "No differences.")], text: r.statements.join("\n"), tables: r.summary.length ? [{ head: [t("変更の概要", "Summary")], rows: r.summary.map((s) => [s]) }] : [] };
    },
  },

  "openapi-viewer": {
    inputs: [{ id: "spec", label: ["OpenAPI / Swagger（JSONまたはYAML）", "OpenAPI / Swagger (JSON or YAML)"], rows: 12 }],
    files: { accept: ".json,.yaml,.yml", label: ["仕様ファイルをドロップ（任意）", "Drop a spec file (optional)"] },
    options: [{ id: "view", kind: "select", label: ["表示", "View"], default: "endpoints", choices: [{ value: "endpoints", label: ["エンドポイント一覧", "Endpoints"] }, { value: "types", label: ["スキーマ → TypeScript型", "Schemas → TypeScript types"] }, { value: "curl", label: ["curlの例", "curl examples"] }] }],
    sample: { spec: "openapi: 3.0.3\ninfo: { title: Pets, version: '1' }\nservers: [{ url: https://api.example.com/v1 }]\npaths:\n  /pets:\n    get: { summary: List pets, operationId: listPets, responses: { '200': { description: ok } } }\n    post:\n      summary: Create a pet\n      requestBody:\n        content: { application/json: { schema: { $ref: '#/components/schemas/NewPet' } } }\n      responses: { '201': { description: created } }\ncomponents:\n  schemas:\n    NewPet:\n      type: object\n      required: [name]\n      properties: { name: { type: string }, tag: { type: string, nullable: true } }" },
    run: ({ inputs, files, opts, t }) => {
      try {
        const doc = loadSpec(textOrFile(inputs.spec, files));
        if (opts.view === "types") return { text: schemasToTypeScript(doc) || "// no schemas" };
        if (opts.view === "curl") return { text: curlExamples(doc) };
        const ops = listOperations(doc);
        return { notes: [t(`${ops.length} 件のエンドポイント。ベースURL: ${baseUrl(doc)}`, `${ops.length} endpoint(s). Base URL: ${baseUrl(doc)}`)], tables: [{ head: [t("メソッド", "Method"), t("パス", "Path"), t("概要", "Summary"), "operationId", t("タグ", "Tags"), t("パラメーター", "Parameters"), t("リクエスト", "Body"), t("レスポンス", "Responses"), t("認証", "Auth")], rows: ops.map((o) => [o.method + (o.deprecated ? " (deprecated)" : ""), o.path, o.summary, o.operationId, o.tags.join(", "), o.params.join(", "), o.body, o.responses.join(", "), o.security || "-"]) }] };
      } catch (e) { return { error: (e as Error).message === "not-openapi" ? t("OpenAPI / Swagger の仕様として読み取れません。", "Not recognized as an OpenAPI / Swagger spec.") : t(`解析できません: ${(e as Error).message}`, `Cannot parse: ${(e as Error).message}`) }; }
    },
  },

  "terraform-plan-viewer": {
    inputs: [{ id: "json", label: ["terraform show -json の出力", "Output of terraform show -json"], rows: 12 }],
    files: { accept: ".json", label: ["plan.json をドロップ（任意）", "Drop plan.json (optional)"] },
    options: [{ id: "noop", kind: "checkbox", label: ["変更なし（no-op）も表示", "Show no-op resources"], default: false }],
    run: ({ inputs, files, opts, t }) => {
      try {
        const r = summarizePlan(textOrFile(inputs.json, files));
        const shown = sortChanges(r.changes).filter((c) => opts.noop || c.action !== "no-op");
        const danger = r.changes.filter((c) => c.action === "delete" || c.action === "replace");
        const c = r.counts;
        return {
          notes: [t(`作成 ${c.create} ／ 更新 ${c.update} ／ 置換 ${c.replace} ／ 削除 ${c.delete}（変更なし ${c["no-op"]}）`, `${c.create} to add, ${c.update} to change, ${c.replace} to replace, ${c.delete} to destroy (${c["no-op"]} unchanged)`), ...(danger.length ? [t(`⚠ 削除・置換されるリソース: ${danger.map((d) => d.address).join(", ")}`, `⚠ Resources to be destroyed or replaced: ${danger.map((d) => d.address).join(", ")}`)] : []), ...(r.outputs ? [t(`出力値の変更: ${r.outputs} 件`, `Output changes: ${r.outputs}`)] : [])],
          tables: [{ title: t("リソース", "Resources"), head: [t("操作", "Action"), t("リソース", "Resource"), t("変更される属性", "Changed attributes")], rows: shown.map((x) => [{ create: "＋ create", update: "～ update", delete: "－ delete", replace: "± replace", read: "read", "no-op": "no-op", forget: "forget" }[x.action], x.address, x.changes.slice(0, 12).map((a) => `${a.path}: ${a.before} → ${a.after}`).join("\n") + (x.changes.length > 12 ? `\n… +${x.changes.length - 12}` : "") + (x.replaceReasons.length ? `\n(replace: ${x.replaceReasons.join(", ")})` : "")]) }],
        };
      } catch (e) { return { error: (e as Error).message === "not-plan" ? t("planのJSONとして読み取れません（terraform show -json plan.out の出力が必要です）。", "Not a plan JSON (use the output of terraform show -json plan.out).") : t(`解析できません: ${(e as Error).message}`, `Cannot parse: ${(e as Error).message}`) }; }
    },
  },

  "k8s-manifest-checker": {
    inputs: [{ id: "yaml", label: ["Kubernetesマニフェスト（複数ドキュメント可）", "Kubernetes manifests (multi-document allowed)"], rows: 14 }],
    files: { accept: ".yaml,.yml,.json", label: ["YAMLファイルをドロップ（任意）", "Drop a YAML file (optional)"] },
    options: [{ id: "secrets", kind: "checkbox", label: ["Secretの値をデコードして表示", "Decode and show Secret values"], default: false }],
    sample: { yaml: "apiVersion: apps/v1\nkind: Deployment\nmetadata: { name: web }\nspec:\n  replicas: 1\n  selector: { matchLabels: { app: web } }\n  template:\n    metadata: { labels: { app: web } }\n    spec:\n      containers:\n        - name: app\n          image: nginx:latest\n          securityContext: { privileged: true }\n" },
    run: ({ inputs, files, opts, t }) => {
      const { resources, errors } = parseManifests(textOrFile(inputs.yaml, files));
      if (!resources.length) return { error: errors[0] ? t(`YAMLを解析できません: ${errors[0]}`, `Cannot parse the YAML: ${errors[0]}`) : t("リソースが見つかりません。", "No resources found.") };
      const findings = checkManifests(resources, t);
      const secrets = opts.secrets ? decodeSecrets(resources) : [];
      return { notes: [countNote(t, findings), ...(errors.length ? [t(`解析できないドキュメントが ${errors.length} 件あります。`, `${errors.length} document(s) could not be parsed.`)] : [])], tables: [findingsTable(findings, (f) => f.resource, [t("レベル", "Level"), t("リソース", "Resource"), t("内容", "Message")]), { title: t("リソース一覧", "Resources"), head: ["kind", "name", "namespace", "apiVersion"], rows: resources.map((r) => { const d = describeResource(r); return [d.kind, d.name, d.namespace || "-", d.apiVersion]; }) }, ...(secrets.length ? [{ title: "Secrets", head: ["secret", "key", "value"], rows: secrets.map((s) => [s.secret, s.key, s.value]) }] : [])] };
    },
  },

  "docker-converter": {
    inputs: [{ id: "src", label: ["docker run コマンド、または docker-compose.yml", "docker run command or docker-compose.yml"], rows: 10 }],
    sample: { src: 'docker run -d --name web -p 8080:80 -v ./html:/usr/share/nginx/html:ro -e TZ=Asia/Tokyo --restart unless-stopped nginx:1.25' },
    run: ({ inputs, t }) => {
      const text = inputs.src.trim();
      try {
        if (/^(sudo\s+)?docker\s/.test(text)) {
          const spec = parseDockerRun(text);
          return { notes: spec.unsupported.length ? [t(`変換できなかったオプション: ${spec.unsupported.join(", ")}`, `Options not converted: ${spec.unsupported.join(", ")}`)] : [], text: runToCompose(spec) };
        }
        const runs = composeToRun(text);
        return { notes: runs.flatMap((r) => r.notes.map((n) => `${r.service}: ${n}`)), text: runs.map((r) => `# ${r.service}\n${r.command}`).join("\n\n") };
      } catch (e) {
        const m = (e as Error).message;
        return { error: m === "not-compose" ? t("docker run のコマンドとしても、compose の YAML としても読み取れません。", "Not recognized as a docker run command or compose YAML.") : m === "no-image" ? t("イメージ名が見つかりません。", "No image name found.") : m === "unterminated quote" ? t("引用符が閉じられていません。", "A quote is not closed.") : t(`変換できません: ${m}`, `Cannot convert: ${m}`) };
      }
    },
  },

  "github-actions-viewer": {
    inputs: [{ id: "yaml", label: ["ワークフロー（.github/workflows/*.yml）", "Workflow (.github/workflows/*.yml)"], rows: 14 }],
    files: { accept: ".yml,.yaml", label: ["ワークフローをドロップ（任意）", "Drop a workflow file (optional)"] },
    sample: { yaml: "name: CI\non:\n  push:\n    branches: [main]\n  schedule:\n    - cron: '30 18 * * 1-5'\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: someone/action@main\n      - run: echo \"${{ github.event.pull_request.title }}\"\n  deploy:\n    needs: [build]\n    runs-on: ubuntu-latest\n    steps:\n      - run: ./deploy.sh" },
    run: ({ inputs, files, t }) => {
      try {
        const r = analyzeWorkflow(textOrFile(inputs.yaml, files), t);
        return { notes: [countNote(t, r.findings), t("scheduleのcronはUTCです。JSTへの換算を併記しています。", "Schedule crons run in UTC. A JST conversion is shown alongside.")], tables: [{ title: t("トリガー", "Triggers"), head: [t("イベント", "Event"), t("詳細", "Details")], rows: r.triggers.map((x) => [x.event, x.detail]) }, { title: t("ジョブ", "Jobs"), head: ["id", t("名前", "Name"), "runs-on", "needs", t("ステップ数", "Steps"), "timeout", t("使用アクション", "Actions used")], rows: r.jobs.map((j) => [j.id, j.name, j.runsOn, j.needs.join(", ") || "-", j.steps, j.timeout || "-", j.uses.join("\n") || "-"]) }, findingsTable(r.findings, (f) => f.target, [t("レベル", "Level"), t("対象", "Target"), t("内容", "Message")])], text: r.mermaid };
      } catch (e) { return { error: (e as Error).message === "not-workflow" ? t("GitHub Actionsのワークフロー（jobs を含むYAML）として読み取れません。", "Not recognized as a GitHub Actions workflow (YAML with jobs).") : t(`解析できません: ${(e as Error).message}`, `Cannot parse: ${(e as Error).message}`) }; }
    },
    outputLabel: ["ジョブの依存関係（Mermaid）", "Job dependencies (Mermaid)"],
  },
};
