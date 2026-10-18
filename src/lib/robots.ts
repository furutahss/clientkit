/**
 * robots.txt を RFC 9309 に沿って解析し、URLのクロール可否を判定する。
 * - User-Agent は製品トークンの大文字・小文字を無視した完全一致。一致するグループがなければ * のグループ
 * - 一致するグループが複数あればルールを結合する
 * - 最も長く一致したルールを採用し、同じ長さなら Allow を優先する
 * - * は任意の文字列、末尾の $ はURLの末尾を表す
 */

export type RobotsRule = { line: number; type: "allow" | "disallow"; value: string };
export type RobotsGroup = { agents: { line: number; value: string }[]; rules: RobotsRule[] };
export type RobotsNote = { line: number; text: string };

export type RobotsParseResult = {
  groups: RobotsGroup[];
  sitemaps: RobotsNote[];
  /** 判定に使わないディレクティブ（Crawl-delay・Host・Noindexなど） */
  unsupported: RobotsNote[];
  /** User-agent より前にあり、どのグループにも属さないルール */
  orphanRules: RobotsNote[];
  /** 「名前: 値」の形になっていない行 */
  invalid: RobotsNote[];
};

export function parseRobots(text: string): RobotsParseResult {
  const result: RobotsParseResult = { groups: [], sitemaps: [], unsupported: [], orphanRules: [], invalid: [] };
  let current: RobotsGroup | null = null;
  let collectingAgents = false;

  text.split(/\r\n|\r|\n/).forEach((raw, index) => {
    const line = index + 1;
    const content = raw.replace(/#.*/, "").trim();
    if (content === "") return;
    const colon = content.indexOf(":");
    if (colon <= 0) {
      result.invalid.push({ line, text: raw });
      return;
    }
    const key = content.slice(0, colon).trim().toLowerCase();
    const value = content.slice(colon + 1).trim();

    if (key === "user-agent") {
      if (!current || !collectingAgents) {
        current = { agents: [], rules: [] };
        result.groups.push(current);
        collectingAgents = true;
      }
      current.agents.push({ line, value });
    } else if (key === "allow" || key === "disallow") {
      collectingAgents = false;
      if (!current) result.orphanRules.push({ line, text: raw });
      else current.rules.push({ line, type: key, value });
    } else if (key === "sitemap") {
      result.sitemaps.push({ line, text: value });
    } else {
      result.unsupported.push({ line, text: raw });
    }
  });
  return result;
}

/** RFC 9309 の製品トークン（英字・_・-） */
export function isProductToken(agent: string): boolean {
  return /^[A-Za-z_-]+$/.test(agent);
}

/** パーセントエンコードの大文字・小文字をそろえ、非ASCII文字をエンコードする */
function normalizePath(path: string): string {
  return path
    .replace(/[^\x00-\x7f]+/gu, (chars) => encodeURIComponent(chars))
    .replace(/%[0-9a-f]{2}/gi, (hex) => hex.toUpperCase());
}

function ruleMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split("*")
    .map((part) => part.replace(/[\\^$.+?()[\]{}|]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`).test(path);
}

export type RobotsVerdict =
  | { input: string; status: "invalidUrl" }
  | {
      input: string;
      status: "checked";
      path: string;
      allowed: boolean;
      /** robotsTxt: /robots.txt 自体は常に許可 / noGroup: 該当グループなし / noRule: 一致するルールなし */
      reason: "rule" | "robotsTxt" | "noGroup" | "noRule";
      groups: RobotsGroup[];
      rule?: RobotsRule;
      /** 採用されなかったが一致したルール */
      otherMatches: RobotsRule[];
    };

export function selectGroups(parsed: RobotsParseResult, agent: string): RobotsGroup[] {
  const name = agent.trim().toLowerCase();
  const byName = (target: string) =>
    parsed.groups.filter((group) => group.agents.some((a) => a.value.toLowerCase() === target));
  const exact = byName(name);
  return exact.length > 0 ? exact : byName("*");
}

export function toRobotsPath(input: string): string | null {
  try {
    const url = new URL(input, "https://example.com");
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return normalizePath(url.pathname + url.search);
  } catch {
    return null;
  }
}

export function checkUrls(parsed: RobotsParseResult, agent: string, lines: string[]): RobotsVerdict[] {
  const groups = selectGroups(parsed, agent);
  const rules = groups.flatMap((group) => group.rules).filter((rule) => rule.value !== "");

  return lines
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((input): RobotsVerdict => {
      const path = toRobotsPath(input);
      if (path === null) return { input, status: "invalidUrl" };
      const base = { input, status: "checked" as const, path, groups };
      if (path === "/robots.txt") return { ...base, allowed: true, reason: "robotsTxt", otherMatches: [] };
      if (groups.length === 0) return { ...base, allowed: true, reason: "noGroup", otherMatches: [] };

      const matches = rules
        .map((rule) => ({ rule, pattern: normalizePath(rule.value) }))
        .filter(({ pattern }) => ruleMatches(pattern, path));
      if (matches.length === 0) return { ...base, allowed: true, reason: "noRule", otherMatches: [] };

      const best = matches.reduce((a, b) => {
        if (b.pattern.length !== a.pattern.length) return b.pattern.length > a.pattern.length ? b : a;
        return b.rule.type === "allow" && a.rule.type === "disallow" ? b : a;
      });
      return {
        ...base,
        allowed: best.rule.type === "allow",
        reason: "rule",
        rule: best.rule,
        otherMatches: matches.filter((m) => m !== best).map((m) => m.rule),
      };
    });
}
