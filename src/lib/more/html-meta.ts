import type { T } from "./types";

export type MetaTag = { key: string; value: string };
export type PageMeta = { title: string; lang: string; canonical: string; tags: MetaTag[] };

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** HTMLからtitle・canonical・meta（name / property）を取り出す */
export function extractMeta(html: string): PageMeta {
  const head = html.replace(/<!--[\s\S]*?-->/g, "");
  const tags: MetaTag[] = [];
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = a.property ?? a.name ?? a["http-equiv"];
    if (key && a.content !== undefined) tags.push({ key: key.toLowerCase(), value: decode(a.content) });
  }
  let canonical = "";
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (/\bcanonical\b/i.test(a.rel ?? "")) canonical = a.href ?? "";
  }
  return {
    title: decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]?.trim() ?? ""),
    lang: attrs(/<html\b[^>]*>/i.exec(head)?.[0] ?? "").lang ?? "",
    canonical,
    tags,
  };
}

export type SeoFinding = { level: "error" | "warn" | "ok"; item: string; message: string };

export function checkMeta(meta: PageMeta, t: T): SeoFinding[] {
  const f: SeoFinding[] = [];
  const get = (k: string) => meta.tags.find((x) => x.key === k)?.value ?? "";
  const add = (level: SeoFinding["level"], item: string, ja: string, en: string) => f.push({ level, item, message: t(ja, en) });
  const absolute = (u: string) => /^https?:\/\//i.test(u);
  // 文字数はおおよその目安（全角は2幅として数える）
  const width = (s: string) => Array.from(s).reduce((n, c) => n + (c.charCodeAt(0) > 0xff ? 2 : 1), 0);

  if (!meta.title) add("error", "title", "<title> がありません。", "<title> is missing.");
  else if (width(meta.title) > 60 * 1.1 * 1 + 10) add("warn", "title", `タイトルが長く、検索結果で省略される可能性があります（表示幅 ${width(meta.title)}）。`, `The title is long and may be truncated in search results (display width ${width(meta.title)}).`);
  const description = get("description");
  if (!description) add("warn", "description", "meta description がありません。", "meta description is missing.");
  else if (width(description) < 70 || width(description) > 320) add("warn", "description", `description の長さが目安（表示幅 70〜320）から外れています（${width(description)}）。`, `The description length is outside the usual range (display width 70-320; yours is ${width(description)}).`);
  if (!meta.canonical) add("warn", "canonical", "canonical リンクがありません。", "The canonical link is missing.");
  else if (!absolute(meta.canonical)) add("warn", "canonical", "canonical は絶対URLにしてください。", "canonical should be an absolute URL.");
  if (!meta.lang) add("warn", "lang", "<html lang> がありません。", "<html lang> is missing.");
  if (!get("viewport")) add("warn", "viewport", "viewport の meta がありません（モバイル表示に影響）。", "The viewport meta is missing (affects mobile rendering).");
  for (const k of ["og:title", "og:type", "og:image", "og:url"]) if (!get(k)) add("error", k, `${k} がありません。`, `${k} is missing.`);
  if (!get("og:description")) add("warn", "og:description", "og:description がありません。", "og:description is missing.");
  if (get("og:image") && !absolute(get("og:image"))) add("error", "og:image", "og:image は絶対URLにしてください。", "og:image must be an absolute URL.");
  if (get("og:url") && !absolute(get("og:url"))) add("error", "og:url", "og:url は絶対URLにしてください。", "og:url must be an absolute URL.");
  if (!get("twitter:card")) add("warn", "twitter:card", "twitter:card がありません（Xでのカード表示用）。", "twitter:card is missing (used for cards on X).");
  else if (!["summary", "summary_large_image", "app", "player"].includes(get("twitter:card"))) add("error", "twitter:card", "twitter:card の値が不正です。", "twitter:card has an invalid value.");
  if (get("og:image") && !get("og:image:alt") && !get("twitter:image:alt")) add("warn", "og:image:alt", "画像の代替テキスト（og:image:alt）がありません。", "Image alt text (og:image:alt) is missing.");
  if (!f.length) add("ok", "all", "主要なタグは揃っています。", "All main tags are present.");
  return f;
}
