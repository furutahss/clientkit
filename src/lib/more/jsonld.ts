import type { T } from "./types";

export type LdFinding = { level: "error" | "warn" | "ok"; type: string; message: string };

const RULES: Record<string, { required: string[]; recommended: string[] }> = {
  Article: { required: ["headline"], recommended: ["image", "datePublished", "dateModified", "author"] },
  Product: { required: ["name"], recommended: ["image", "description", "offers", "sku", "brand"] },
  FAQPage: { required: ["mainEntity"], recommended: [] },
  BreadcrumbList: { required: ["itemListElement"], recommended: [] },
  Organization: { required: ["name"], recommended: ["url", "logo"] },
  WebSite: { required: ["url"], recommended: ["name"] },
  Event: { required: ["name", "startDate", "location"], recommended: ["endDate", "description", "image", "offers"] },
  Recipe: { required: ["name", "image"], recommended: ["recipeIngredient", "recipeInstructions", "author"] },
  LocalBusiness: { required: ["name", "address"], recommended: ["telephone", "openingHours", "image"] },
  Person: { required: ["name"], recommended: ["url"] },
  VideoObject: { required: ["name", "thumbnailUrl", "uploadDate"], recommended: ["description", "contentUrl"] },
  JobPosting: { required: ["title", "description", "datePosted", "hiringOrganization", "jobLocation"], recommended: ["validThrough", "baseSalary"] },
};
const ALIAS: Record<string, string> = { NewsArticle: "Article", BlogPosting: "Article", TechArticle: "Article", Restaurant: "LocalBusiness", Store: "LocalBusiness" };
const DATE_PROPS = ["datePublished", "dateModified", "startDate", "endDate", "uploadDate", "datePosted", "validThrough"];
const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const filled = (v: unknown) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length);

/** HTML内の ld+json を取り出す。HTMLでなくJSONそのものが貼られた場合はそれを返す */
export function extractJsonLd(input: string): { blocks: string[]; fromHtml: boolean } {
  const blocks = [...input.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim());
  if (blocks.length) return { blocks, fromHtml: true };
  return { blocks: /^\s*[[{]/.test(input) ? [input.trim()] : [], fromHtml: false };
}

export function validateJsonLd(input: string, t: T): { findings: LdFinding[]; summary: string[] } {
  const findings: LdFinding[] = [];
  const summary: string[] = [];
  const add = (level: LdFinding["level"], type: string, ja: string, en: string) => findings.push({ level, type, message: t(ja, en) });
  const { blocks } = extractJsonLd(input);
  if (!blocks.length) { add("error", "-", "JSON-LD（<script type=\"application/ld+json\">）が見つかりません。", "No JSON-LD (<script type=\"application/ld+json\">) found."); return { findings, summary }; }

  const nodes: Obj[] = [];
  blocks.forEach((b, i) => {
    let data: unknown;
    try { data = JSON.parse(b); } catch (e) { add("error", `#${i + 1}`, `JSONとして解析できません: ${(e as Error).message}`, `Cannot parse as JSON: ${(e as Error).message}`); return; }
    const roots = Array.isArray(data) ? data : [data];
    for (const r of roots) {
      if (!isObj(r)) continue;
      if (!/schema\.org/.test(JSON.stringify(r["@context"] ?? ""))) add("warn", `#${i + 1}`, "@context に schema.org がありません。", "@context does not include schema.org.");
      if (Array.isArray(r["@graph"])) nodes.push(...(r["@graph"] as unknown[]).filter(isObj)); else nodes.push(r);
    }
  });

  for (const node of nodes) {
    const types = ([] as unknown[]).concat(node["@type"] ?? []).map(String);
    if (!types.length) { add("warn", "?", "@type がないオブジェクトがあります。", "An object has no @type."); continue; }
    for (const type of types) {
      const rule = RULES[type] ?? RULES[ALIAS[type]];
      summary.push(type);
      if (!rule) { add("ok", type, "このタイプの必須項目チェックは未対応です（構文のみ確認）。", "Required-property checks are not available for this type (syntax only)."); continue; }
      for (const p of rule.required) if (!filled(node[p])) add("error", type, `必須プロパティ ${p} がありません。`, `Required property ${p} is missing.`);
      for (const p of rule.recommended) if (!filled(node[p])) add("warn", type, `推奨プロパティ ${p} がありません。`, `Recommended property ${p} is missing.`);
    }
    for (const p of DATE_PROPS) if (typeof node[p] === "string" && !ISO.test(node[p] as string)) add("error", String(types[0]), `${p} がISO 8601形式ではありません（${node[p]}）。`, `${p} is not ISO 8601 (${node[p]}).`);
    if (types.includes("FAQPage")) for (const q of ([] as unknown[]).concat(node.mainEntity ?? [])) {
      if (!isObj(q) || !filled(q.name) || !isObj(q.acceptedAnswer) || !filled(q.acceptedAnswer.text)) add("error", "FAQPage", "Question には name と acceptedAnswer.text が必要です。", "Each Question needs name and acceptedAnswer.text.");
    }
    if (types.includes("BreadcrumbList")) for (const item of ([] as unknown[]).concat(node.itemListElement ?? [])) {
      if (!isObj(item) || !filled(item.position) || !filled(item.name)) add("error", "BreadcrumbList", "ListItem には position と name が必要です。", "Each ListItem needs position and name.");
    }
    if (types.includes("Product")) for (const o of ([] as unknown[]).concat(node.offers ?? [])) {
      if (!isObj(o) || !filled(o.price) || !filled(o.priceCurrency)) add("error", "Product", "offers には price と priceCurrency が必要です。", "offers needs price and priceCurrency.");
    }
  }
  if (!findings.some((f) => f.level !== "ok")) add("ok", "-", "問題は見つかりませんでした。", "No problems found.");
  return { findings, summary };
}
