import { decodeEntities } from "./xml";
import type { T } from "./types";

export type SitemapFinding = { level: "error" | "warn" | "ok"; target: string; message: string };

const W3C = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;
const FREQ = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"];

export function validateSitemap(xml: string, t: T): { kind: "urlset" | "index" | "unknown"; count: number; findings: SitemapFinding[] } {
  const findings: SitemapFinding[] = [];
  const add = (level: SitemapFinding["level"], target: string, ja: string, en: string) => findings.push({ level, target, message: t(ja, en) });
  const kind = /<sitemapindex[\s>]/i.test(xml) ? "index" : /<urlset[\s>]/i.test(xml) ? "urlset" : "unknown";
  if (kind === "unknown") { add("error", "-", "<urlset> または <sitemapindex> が見つかりません。", "Neither <urlset> nor <sitemapindex> was found."); return { kind, count: 0, findings }; }
  const tag = kind === "index" ? "sitemap" : "url";
  const blocks = [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => m[1]);
  const bytes = new TextEncoder().encode(xml).length;
  if (bytes > 50 * 1024 * 1024) add("error", "-", `ファイルが非圧縮50MiBを超えています（${bytes}バイト）。`, `The file exceeds 50 MiB uncompressed (${bytes} bytes).`);
  if (blocks.length > 50000) add("error", "-", `URL（エントリ）数が上限の50,000件を超えています（${blocks.length}件）。`, `The entry count exceeds the 50,000 limit (${blocks.length}).`);
  if (!blocks.length) add("warn", "-", "エントリが1件もありません。", "There are no entries.");
  if (!/xmlns\s*=\s*["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/.test(xml)) add("warn", "-", "名前空間 xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" がありません。", "The xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" namespace is missing.");
  const seen = new Set<string>();
  const hosts = new Set<string>();
  blocks.forEach((b, i) => {
    const field = (n: string) => new RegExp(`<${n}>([\\s\\S]*?)</${n}>`, "i").exec(b)?.[1];
    const rawLoc = field("loc")?.trim();
    const label = rawLoc ? decodeEntities(rawLoc).slice(0, 80) : `#${i + 1}`;
    if (!rawLoc) { add("error", label, "<loc> がありません。", "<loc> is missing."); return; }
    if (/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(rawLoc)) add("error", label, "& がエスケープされていません（&amp; にしてください）。", "An & is not escaped (use &amp;).");
    const loc = decodeEntities(rawLoc);
    if (!/^https?:\/\/[^\s/]+/i.test(loc)) add("error", label, "loc は http(s) で始まる絶対URLにしてください。", "loc must be an absolute http(s) URL.");
    else hosts.add(new URL(loc).host);
    if (loc.length > 2048) add("error", label, "URLが2,048文字を超えています。", "The URL exceeds 2,048 characters.");
    if (seen.has(loc)) add("warn", label, "URLが重複しています。", "The URL is duplicated."); seen.add(loc);
    const lastmod = field("lastmod")?.trim();
    if (lastmod && !W3C.test(lastmod)) add("error", label, `lastmod がW3C日時形式ではありません（${lastmod}）。`, `lastmod is not W3C datetime format (${lastmod}).`);
    const freq = field("changefreq")?.trim();
    if (freq && !FREQ.includes(freq)) add("error", label, `changefreq の値が不正です（${freq}）。`, `changefreq has an invalid value (${freq}).`);
    const pr = field("priority")?.trim();
    if (pr && !(Number(pr) >= 0 && Number(pr) <= 1)) add("error", label, `priority は0.0〜1.0です（${pr}）。`, `priority must be 0.0-1.0 (${pr}).`);
  });
  if (hosts.size > 1) add("warn", "-", `複数のホストが混在しています（${[...hosts].join(", ")}）。サイトマップは同一ホストのURLのみ記載できます。`, `Multiple hosts are mixed (${[...hosts].join(", ")}). A sitemap may only list URLs from its own host.`);
  if (!findings.length) add("ok", "-", "問題は見つかりませんでした。", "No problems found.");
  return { kind, count: blocks.length, findings };
}
