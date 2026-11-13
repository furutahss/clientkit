import * as React from "react";
import { zipSync } from "fflate";

import { barcodeSvg, encodeBarcode, type BarcodeKind } from "@/lib/more/barcode";
import { decodeBlurHash, encodeBlurHash } from "@/lib/more/blurhash";
import { analyzeBundle } from "@/lib/more/sourcemap-bundle";
import { fromUtf8 } from "@/lib/more/util";

import type { Specs } from "./shared";

const MIME: Record<string, string> = { webp: "image/webp", jpeg: "image/jpeg", png: "image/png", avif: "image/avif" };

async function loadBitmap(bytes: Uint8Array): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([bytes as BlobPart]));
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of Array.from(text)) {
    if (ch === "\n") { lines.push(cur); cur = ""; continue; }
    if (ctx.measureText(cur + ch).width > maxWidth && cur) { lines.push(cur); cur = ch.trim() ? ch : ""; } else cur += ch;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const cut = lines.slice(0, maxLines); cut[maxLines - 1] = cut[maxLines - 1].replace(/.?$/, "…"); return cut; }
  return lines;
}

const fmtBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

export const specs: Specs = {
  "blurhash-generator": {
    inputs: [{ id: "hash", label: ["BlurHash（デコードして確認する場合）", "BlurHash (to decode and preview)"], rows: 2 }],
    files: { accept: "image/*", label: ["画像をドロップして BlurHash を生成", "Drop an image to generate its BlurHash"] },
    options: [{ id: "xc", kind: "number", label: ["横の成分数（1〜9）", "X components (1-9)"], default: 4, min: 1, max: 9 }, { id: "yc", kind: "number", label: ["縦の成分数（1〜9）", "Y components (1-9)"], default: 3, min: 1, max: 9 }],
    run: async ({ files, inputs, opts, t }) => {
      let hash = inputs.hash.trim();
      const notes: string[] = [];
      if (files[0]) {
        try {
          const bmp = await loadBitmap(files[0].bytes);
          const scale = Math.min(1, 64 / Math.max(bmp.width, bmp.height));
          const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(bmp, 0, 0, w, h);
          hash = encodeBlurHash(ctx.getImageData(0, 0, w, h).data, w, h, Math.max(1, Math.min(9, Number(opts.xc) || 4)), Math.max(1, Math.min(9, Number(opts.yc) || 3)));
          notes.push(t(`${bmp.width}×${bmp.height} の画像から ${hash.length} 文字のハッシュを生成しました（計算には ${w}×${h} に縮小した画像を使用）。`, `Generated a ${hash.length}-character hash from a ${bmp.width}×${bmp.height} image (computed from a ${w}×${h} downscale).`));
        } catch { return { error: t("画像を読み込めません。", "Could not load the image.") }; }
      }
      if (!hash) return { notes: [t("画像をドロップするか、BlurHashを入力してください。", "Drop an image or enter a BlurHash.")] };
      try {
        const W = 32, H = 32;
        const px = decodeBlurHash(hash, W, H);
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        canvas.getContext("2d")!.putImageData(new ImageData(px as unknown as Uint8ClampedArray<ArrayBuffer>, W, H), 0, 0);
        const preview = React.createElement("img", { src: canvas.toDataURL(), alt: t("BlurHashのプレビュー", "BlurHash preview"), width: 192, height: 192, className: "rounded-md border", style: { imageRendering: "auto" } });
        return { notes, preview, text: hash };
      } catch (e) { return { error: t(`BlurHashとして解釈できません（${(e as Error).message}）。`, `Not a valid BlurHash (${(e as Error).message}).`) }; }
    },
  },

  "srcset-generator": {
    inputs: [],
    files: { accept: "image/*", label: ["元の画像をドロップ", "Drop the source image"] },
    options: [
      { id: "widths", kind: "text", label: ["幅（px、カンマ区切り）", "Widths (px, comma separated)"], default: "320, 640, 960, 1280" },
      { id: "formats", kind: "select", label: ["形式", "Formats"], default: "webp+jpeg", choices: [{ value: "webp", label: "WebP" }, { value: "jpeg", label: "JPEG" }, { value: "png", label: "PNG" }, { value: "webp+jpeg", label: ["WebP + JPEG（<picture>）", "WebP + JPEG (<picture>)"] }, { value: "avif+webp+jpeg", label: ["AVIF + WebP + JPEG（対応ブラウザのみ生成）", "AVIF + WebP + JPEG (where supported)"] }] },
      { id: "quality", kind: "number", label: ["品質（0.1〜1）", "Quality (0.1-1)"], default: 0.82, min: 0.1, max: 1 },
      { id: "sizes", kind: "text", label: ["sizes 属性", "sizes attribute"], default: "(max-width: 960px) 100vw, 960px" },
      { id: "alt", kind: "text", label: ["alt テキスト", "alt text"], default: "" },
    ],
    run: async ({ files, opts, t }) => {
      const file = files[0];
      if (!file) return { notes: [t("画像をドロップしてください。", "Drop an image.")] };
      let bmp: ImageBitmap;
      try { bmp = await loadBitmap(file.bytes); } catch { return { error: t("画像を読み込めません。", "Could not load the image.") }; }
      const widths = [...new Set(String(opts.widths).split(",").map((w) => Math.round(Number(w.trim()))).filter((w) => w > 0))].sort((a, b) => a - b);
      if (!widths.length) return { error: t("幅を1つ以上指定してください。", "Specify at least one width.") };
      const formats = String(opts.formats).split("+");
      const base = file.name.replace(/\.[^.]+$/, "") || "image";
      const out: { name: string; bytes: Uint8Array; fmt: string; w: number }[] = [];
      const skipped = new Set<string>();
      for (const w of widths) {
        const width = Math.min(w, bmp.width);
        const height = Math.round((bmp.height * width) / bmp.width);
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        if (formats.includes("jpeg")) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height); }
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bmp, 0, 0, width, height);
        for (const fmt of formats) {
          const blob = await toBlob(canvas, MIME[fmt], Number(opts.quality) || 0.82);
          if (!blob || blob.type !== MIME[fmt]) { skipped.add(fmt); continue; }
          out.push({ name: `${base}-${width}w.${fmt === "jpeg" ? "jpg" : fmt}`, bytes: new Uint8Array(await blob.arrayBuffer()), fmt, w: width });
        }
      }
      const alt = String(opts.alt).replace(/"/g, "&quot;");
      const set = (fmt: string) => out.filter((o) => o.fmt === fmt).map((o) => `${o.name} ${o.w}w`).join(",\n      ");
      const fallbackFmt = formats.includes("jpeg") ? "jpeg" : formats[formats.length - 1];
      const fallback = out.filter((o) => o.fmt === fallbackFmt);
      const biggest = fallback[fallback.length - 1];
      const html = formats.length === 1 || skipped.size >= formats.length - 1 && formats.length > 1 && out.every((o) => o.fmt === fallbackFmt)
        ? `<img\n  src="${biggest?.name}"\n  srcset="${set(fallbackFmt)}"\n  sizes="${opts.sizes}"\n  width="${biggest?.w}" height="${Math.round((bmp.height * (biggest?.w ?? 1)) / bmp.width)}"\n  alt="${alt}" loading="lazy">`
        : `<picture>\n${formats.filter((f) => f !== fallbackFmt && out.some((o) => o.fmt === f)).map((f) => `  <source type="${MIME[f]}"\n    srcset="${set(f)}"\n    sizes="${opts.sizes}">`).join("\n")}\n  <img\n    src="${biggest?.name}"\n    srcset="${set(fallbackFmt)}"\n    sizes="${opts.sizes}"\n    width="${biggest?.w}" height="${Math.round((bmp.height * (biggest?.w ?? 1)) / bmp.width)}"\n    alt="${alt}" loading="lazy">\n</picture>`;
      const zip = zipSync(Object.fromEntries(out.map((o) => [o.name, o.bytes])), { level: 0 });
      return {
        notes: [t(`${out.length} 枚を生成（元画像 ${bmp.width}×${bmp.height}、元より大きい幅は元のサイズに丸めます）。`, `Generated ${out.length} image(s) (source ${bmp.width}×${bmp.height}; widths above the source are capped).`), ...(skipped.size ? [t(`お使いのブラウザでは ${[...skipped].join("・")} の書き出しに対応していないため、生成しませんでした。`, `Your browser cannot encode ${[...skipped].join(", ")}, so it was skipped.`)] : [])],
        tables: [{ head: [t("ファイル", "File"), t("幅", "Width"), t("サイズ", "Size")], rows: out.map((o) => [o.name, o.w, fmtBytes(o.bytes.length)]) }],
        text: html,
        downloads: [{ name: `${base}-responsive.zip`, data: zip, mime: "application/zip" }],
      };
    },
    outputLabel: ["HTML（<img srcset> / <picture>）", "HTML (<img srcset> / <picture>)"],
  },

  "og-image-generator": {
    inputs: [{ id: "title", label: ["タイトル", "Title"], rows: 3, mono: false }, { id: "sub", label: ["サブタイトル（任意）", "Subtitle (optional)"], rows: 2, mono: false }],
    options: [
      { id: "size", kind: "select", label: ["サイズ", "Size"], default: "1200x630", choices: [{ value: "1200x630", label: "1200×630 (OGP / X summary_large_image)" }, { value: "1200x1200", label: "1200×1200 (1:1)" }, { value: "1500x500", label: "1500×500 (X header)" }] },
      { id: "bg1", kind: "text", label: ["背景色1（#RRGGBB）", "Background color 1 (#RRGGBB)"], default: "#4f46e5" },
      { id: "bg2", kind: "text", label: ["背景色2（#RRGGBB、同じ色で単色）", "Background color 2 (#RRGGBB; same for solid)"], default: "#9333ea" },
      { id: "fg", kind: "text", label: ["文字色（#RRGGBB）", "Text color (#RRGGBB)"], default: "#ffffff" },
      { id: "site", kind: "text", label: ["サイト名（右下・任意）", "Site name (bottom right, optional)"], default: "" },
      { id: "align", kind: "select", label: ["配置", "Alignment"], default: "left", choices: [{ value: "left", label: ["左揃え", "Left"] }, { value: "center", label: ["中央揃え", "Center"] }] },
    ],
    sample: { title: "ClientKitで開発をもっと快適に", sub: "ブラウザだけで使える開発者ツール集" },
    run: async ({ inputs, opts, t }) => {
      const [W, H] = String(opts.size).split("x").map(Number);
      const hex = /^#[0-9a-f]{6}$/i;
      for (const k of ["bg1", "bg2", "fg"]) if (!hex.test(String(opts[k]).trim())) return { error: t("色は #RRGGBB の形式で入力してください。", "Enter colors as #RRGGBB.") };
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, String(opts.bg1)); grad.addColorStop(1, String(opts.bg2));
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      const font = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", system-ui, sans-serif';
      const pad = Math.round(W * 0.07);
      const center = opts.align === "center";
      ctx.textAlign = center ? "center" : "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = String(opts.fg);
      const maxW = W - pad * 2;
      const titleSize = Math.round(H * (inputs.title.length > 28 ? 0.1 : 0.13));
      ctx.font = `700 ${titleSize}px ${font}`;
      const titleLines = wrapText(ctx, inputs.title.trim(), maxW, 3);
      const subSize = Math.round(titleSize * 0.45);
      ctx.font = `400 ${subSize}px ${font}`;
      const subLines = inputs.sub.trim() ? wrapText(ctx, inputs.sub.trim(), maxW, 2) : [];
      const block = titleLines.length * titleSize * 1.25 + (subLines.length ? subSize * 0.8 + subLines.length * subSize * 1.35 : 0);
      let y = (H - block) / 2 + titleSize;
      const x = center ? W / 2 : pad;
      ctx.font = `700 ${titleSize}px ${font}`;
      for (const l of titleLines) { ctx.fillText(l, x, y); y += titleSize * 1.25; }
      ctx.font = `400 ${subSize}px ${font}`; ctx.globalAlpha = 0.85; y += subSize * 0.1;
      for (const l of subLines) { ctx.fillText(l, x, y); y += subSize * 1.35; }
      ctx.globalAlpha = 0.9;
      if (String(opts.site).trim()) { ctx.textAlign = "right"; ctx.font = `600 ${Math.round(H * 0.045)}px ${font}`; ctx.fillText(String(opts.site).trim(), W - pad, H - pad * 0.7); }
      const blob = await toBlob(canvas, "image/png");
      if (!blob) return { error: t("画像を生成できませんでした。", "Could not generate the image.") };
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const preview = React.createElement("img", { src: canvas.toDataURL("image/png"), alt: t("生成したOGP画像", "Generated OGP image"), className: "w-full max-w-xl rounded-lg border" });
      return { notes: [t(`${W}×${H} の PNG（${fmtBytes(bytes.length)}）。SNSでは 5MB 以下、1200×630 が推奨です。`, `${W}×${H} PNG (${fmtBytes(bytes.length)}). Social networks recommend 1200×630 and under 5 MB.`), t("文字は、お使いの環境にあるフォントで描画します。", "Text is drawn with fonts available on your device.")], preview, downloads: [{ name: `og-${W}x${H}.png`, data: bytes, mime: "image/png" }] };
    },
  },

  "barcode-tool": {
    inputs: [{ id: "value", label: ["値（生成）", "Value (to generate)"], rows: 2 }],
    files: { accept: "image/*", label: ["バーコードの画像をドロップして読み取り", "Drop a barcode image to read it"] },
    options: [
      { id: "kind", kind: "select", label: ["種類", "Type"], default: "ean13", choices: [{ value: "ean13", label: "JAN / EAN-13" }, { value: "ean8", label: "JAN / EAN-8" }, { value: "upca", label: "UPC-A" }, { value: "code128", label: "Code 128" }, { value: "code39", label: "Code 39" }, { value: "itf", label: "ITF (Interleaved 2 of 5)" }] },
      { id: "mw", kind: "number", label: ["バーの太さ（px）", "Module width (px)"], default: 2, min: 1, max: 6 },
      { id: "height", kind: "number", label: ["高さ（px）", "Height (px)"], default: 80, min: 20, max: 300 },
      { id: "text", kind: "checkbox", label: ["数字を表示", "Show text"], default: true },
    ],
    sample: { value: "4006381333931" },
    run: async ({ inputs, files, opts, t }) => {
      if (files[0]) {
        try {
          const zxing = await import("@zxing/library");
          const bmp = await loadBitmap(files[0].bytes);
          const hints = new Map();
          hints.set(zxing.DecodeHintType.TRY_HARDER, true);
          hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [zxing.BarcodeFormat.EAN_13, zxing.BarcodeFormat.EAN_8, zxing.BarcodeFormat.UPC_A, zxing.BarcodeFormat.UPC_E, zxing.BarcodeFormat.CODE_128, zxing.BarcodeFormat.CODE_39, zxing.BarcodeFormat.ITF, zxing.BarcodeFormat.CODABAR]);
          const reader = new zxing.MultiFormatReader();
          reader.setHints(hints);
          for (const scale of [1, 0.5, 2]) {
            const w = Math.round(bmp.width * Math.min(scale, 2000 / bmp.width)), h = Math.round(bmp.height * Math.min(scale, 2000 / bmp.width));
            if (w < 40) continue;
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(bmp, 0, 0, w, h);
            const d = ctx.getImageData(0, 0, w, h).data;
            const lum = new Uint8ClampedArray(w * h);
            for (let i = 0; i < lum.length; i++) lum[i] = (d[i * 4] * 306 + d[i * 4 + 1] * 601 + d[i * 4 + 2] * 117) >> 10;
            for (const src of [new zxing.RGBLuminanceSource(lum, w, h)]) {
              for (const cand of [src, src.invert()]) {
                try { const r = reader.decode(new zxing.BinaryBitmap(new zxing.HybridBinarizer(cand))); return { notes: [t(`形式: ${zxing.BarcodeFormat[r.getBarcodeFormat()]}`, `Format: ${zxing.BarcodeFormat[r.getBarcodeFormat()]}`)], text: r.getText() }; } catch { reader.reset(); }
              }
            }
          }
          return { error: t("バーコードを読み取れませんでした。ピントの合った、バーが水平な画像を試してください。", "Could not read a barcode. Try a sharp image with horizontal bars.") };
        } catch { return { error: t("画像を読み込めません。", "Could not load the image.") }; }
      }
      if (!inputs.value.trim()) return { notes: [t("値を入力するか、バーコードの画像をドロップしてください。", "Enter a value or drop a barcode image.")] };
      try {
        const { modules, text } = encodeBarcode(opts.kind as BarcodeKind, inputs.value);
        const svg = barcodeSvg(modules, text, { moduleWidth: Number(opts.mw) || 2, height: Number(opts.height) || 80, quiet: 10, showText: !!opts.text });
        const preview = React.createElement("div", { className: "overflow-x-auto rounded-md border bg-white p-2", role: "img", "aria-label": text, dangerouslySetInnerHTML: { __html: svg } });
        return { notes: [t(`エンコード結果: ${text}（${modules.length} モジュール）。EAN・UPCはチェックディジットを自動で補います。`, `Encoded: ${text} (${modules.length} modules). EAN and UPC check digits are added automatically.`)], preview, text: svg, downloads: [{ name: `${opts.kind}-${text.replace(/[^\w-]/g, "_")}.svg`, data: svg, mime: "image/svg+xml" }] };
      } catch (e) {
        const m = (e as Error).message;
        const msg: Record<string, string> = { "digits-only": t("数字だけを入力してください。", "Enter digits only."), "check-digit": t("チェックディジットが正しくありません。", "The check digit is incorrect."), "ascii-printable": t("Code 128 は半角の英数字・記号（ASCII）のみ使えます。", "Code 128 supports ASCII printable characters only."), "code39-chars": t("Code 39 は英大文字・数字と - . 空白 $ / + % が使えます。", "Code 39 supports A-Z, digits, and - . space $ / + %."), "itf-even": t("ITF は偶数桁の数字のみです。", "ITF needs an even number of digits."), empty: t("値を入力してください。", "Enter a value.") };
        return { error: msg[m] ?? (m.startsWith("length:") ? t(`桁数が違います（${m.slice(7).replace("or", " または ")} 桁）。`, `Wrong length (${m.slice(7).replace("or", " or ")} digits).`) : m) };
      }
    },
    outputLabel: ["SVG", "SVG"],
  },

  "font-inspector": {
    inputs: [{ id: "chars", label: ["対応を確認したい文字・文章", "Characters or text to check for support"], rows: 4, mono: false }],
    files: { accept: ".ttf,.otf,.ttc,.woff,.woff2", label: ["フォントファイル（TTF・OTF・WOFF）をドロップ", "Drop a font file (TTF, OTF, WOFF)"] },
    sample: { chars: "日本語の文章ABC 123 ①㈱髙﨑😀" },
    run: async ({ files, inputs, t }) => {
      const file = files[0];
      if (!file) return { notes: [t("フォントファイルをドロップしてください。", "Drop a font file.")] };
      try {
        const fk = (await import("fontkit")) as unknown as { create: (b: Uint8Array) => Record<string, unknown> };
        const create = fk.create ?? (fk as unknown as { default: { create: typeof fk.create } }).default.create;
        const font = create(Buffer.from(file.bytes)) as unknown as { familyName: string; subfamilyName: string; fullName: string; postscriptName: string; version: number | string; unitsPerEm: number; numGlyphs: number; ascent: number; descent: number; copyright?: string; license?: string; licenseURL?: string; hasGlyphForCodePoint: (cp: number) => boolean; availableFeatures?: string[]; "OS/2"?: { usWeightClass?: number }; fonts?: unknown[] };
        const chars = Array.from(new Set(Array.from(inputs.chars.replace(/\s/g, ""))));
        const missing = chars.filter((c) => !font.hasGlyphForCodePoint(c.codePointAt(0)!));
        const info: [string, string][] = [[t("ファミリー名", "Family"), font.familyName], [t("スタイル", "Style"), font.subfamilyName], [t("フルネーム", "Full name"), font.fullName], ["PostScript", font.postscriptName], [t("バージョン", "Version"), String(font.version)], [t("グリフ数", "Glyphs"), String(font.numGlyphs)], ["unitsPerEm", String(font.unitsPerEm)], [t("太さ (usWeightClass)", "Weight (usWeightClass)"), String(font["OS/2"]?.usWeightClass ?? "-")], [t("ファイルサイズ", "File size"), fmtBytes(file.bytes.length)], [t("著作権", "Copyright"), font.copyright ?? "-"], [t("ライセンス", "License"), (font.license ?? font.licenseURL ?? "-").slice(0, 200)], [t("OpenType機能", "OpenType features"), (font.availableFeatures ?? []).join(" ") || "-"]];
        const notes: string[] = [];
        if (chars.length) notes.push(missing.length ? t(`${chars.length} 文字中 ${missing.length} 文字がこのフォントにありません（表示時は別のフォントで代替されるか、□になります）: ${missing.join(" ")}`, `${missing.length} of ${chars.length} characters are missing from this font (they fall back to another font or show as □): ${missing.join(" ")}`) : t(`確認した ${chars.length} 文字はすべて、このフォントに含まれています。`, `All ${chars.length} characters checked are present in this font.`));
        return { notes, tables: [{ head: [t("項目", "Field"), t("値", "Value")], rows: info }] };
      } catch { return { error: t("フォントとして読み取れません（対応形式: TTF・OTF・WOFF・WOFF2）。", "Could not read this as a font (supported: TTF, OTF, WOFF, WOFF2).") }; }
    },
  },

  "sourcemap-bundle-analyzer": {
    inputs: [{ id: "map", label: ["Source Map（.map の内容）", "Source Map (.map contents)"], rows: 5 }],
    files: { multiple: true, accept: ".map,.js,.mjs,.json", label: [".map ファイルと、生成された .js ファイルをドロップ（js は任意）", "Drop the .map file and the generated .js file (js is optional)"] },
    options: [{ id: "mode", kind: "select", label: ["まとめる単位", "Group by"], default: "package", choices: [{ value: "package", label: ["パッケージ（node_modules）", "Package (node_modules)"] }, { value: "file", label: ["ファイル", "File"] }] }, { id: "limit", kind: "number", label: ["表示件数", "Rows"], default: 30, min: 5, max: 500 }],
    run: ({ inputs, files, opts, t }) => {
      const mapFile = files.find((f) => /\.map$/i.test(f.name) || /^\s*\{/.test(fromUtf8(f.bytes.subarray(0, 200))));
      const jsFile = files.find((f) => f !== mapFile && /\.(m?js|cjs)$/i.test(f.name));
      const mapText = mapFile ? fromUtf8(mapFile.bytes) : inputs.map;
      if (!mapText.trim()) return { notes: [t("Source Map をドロップするか貼り付けてください。", "Drop or paste a source map.")] };
      try {
        const r = analyzeBundle(mapText, jsFile ? fromUtf8(jsFile.bytes) : undefined, opts.mode as "package" | "file");
        const bar = (p: number) => "█".repeat(Math.max(0, Math.round(p / 3))) || "▏";
        return {
          notes: [r.unit === "bytes" ? t(`生成ファイル ${fmtBytes(r.total)} のうち、ソースに対応づけられない部分: ${fmtBytes(r.unmapped)}（ランタイムのコード・空白・コメントなど）`, `Of the ${fmtBytes(r.total)} generated file, ${fmtBytes(r.unmapped)} cannot be mapped to a source (runtime code, whitespace, comments, …).`) : t("生成された .js がないため、マッピングされた文字数で按分しています。.js も一緒にドロップすると、バイト数で集計できます。", "Without the generated .js, sizes are apportioned by mapped characters. Drop the .js too to get byte counts.")],
          tables: [{ head: [t("名前", "Name"), r.unit === "bytes" ? "bytes" : "chars", "%", ""], rows: r.entries.slice(0, Number(opts.limit) || 30).map((e) => [e.name, e.bytes.toLocaleString(), e.percent.toFixed(1), bar(e.percent)]) }],
        };
      } catch (e) { return { error: t(`Source Map を解析できません: ${(e as Error).message}`, `Cannot parse the source map: ${(e as Error).message}`) }; }
    },
  },
};
