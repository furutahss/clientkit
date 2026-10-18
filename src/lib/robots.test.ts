import { describe, expect, it } from "vitest";

import { checkUrls, parseRobots } from "./robots";

const ROBOTS = `# sample
User-agent: *
Disallow: /admin/
Allow: /admin/public/
Disallow: /*.pdf$
Disallow: /search
Crawl-delay: 10

User-agent: Googlebot
User-agent: Bingbot
Disallow: /private
Allow: /private
Sitemap: https://example.com/sitemap.xml
`;

function verdicts(agent: string, urls: string[], text = ROBOTS) {
  return checkUrls(parseRobots(text), agent, urls).map((v) =>
    v.status === "invalidUrl" ? "invalid" : `${v.allowed ? "allow" : "disallow"}:${v.rule?.line ?? v.reason}`
  );
}

describe("robots.txt判定", () => {
  it("最も長く一致したルールを採用する", () => {
    expect(verdicts("ExampleBot", ["/admin/users", "/admin/public/a", "/top"])).toEqual(["disallow:3", "allow:4", "allow:noRule"]);
  });

  it("ワイルドカードと末尾指定 $", () => {
    expect(verdicts("ExampleBot", ["/files/a.pdf", "/files/a.pdf?x=1", "/searching?q=1"])).toEqual([
      "disallow:5",
      "allow:noRule",
      "disallow:6",
    ]);
  });

  it("同じ長さの Allow と Disallow は Allow を優先する", () => {
    expect(verdicts("googlebot", ["/private/x"])).toEqual(["allow:12"]);
  });

  it("User-Agent は大文字・小文字を無視して一致させ、一致するグループがあれば * は使わない", () => {
    expect(verdicts("BINGBOT", ["/admin/users"])).toEqual(["allow:noRule"]);
  });

  it("該当グループがない場合と /robots.txt", () => {
    expect(verdicts("Any", ["/x"], "User-agent: Foo\nDisallow: /\n")).toEqual(["allow:noGroup"]);
    expect(verdicts("Foo", ["/robots.txt", "https://example.com/a"], "User-agent: Foo\nDisallow: /\n")).toEqual([
      "allow:robotsTxt",
      "disallow:2",
    ]);
  });

  it("空の Disallow はどのURLにも一致しない", () => {
    expect(verdicts("A", ["/x"], "User-agent: *\nDisallow:\n")).toEqual(["allow:noRule"]);
  });

  it("同名のグループは結合する", () => {
    expect(verdicts("A", ["/a", "/b"], "User-agent: A\nDisallow: /a\n\nUser-agent: A\nDisallow: /b\n")).toEqual([
      "disallow:2",
      "disallow:5",
    ]);
  });

  it("非対応ディレクティブ・グループ外のルール・不正な行を区別する", () => {
    const parsed = parseRobots("Disallow: /x\nUser-agent: *\nCrawl-delay: 5\nnoindex /a\nSitemap: https://e.com/s.xml\n");
    expect(parsed.orphanRules.map((n) => n.line)).toEqual([1]);
    expect(parsed.unsupported.map((n) => n.line)).toEqual([3]);
    expect(parsed.invalid.map((n) => n.line)).toEqual([4]);
    expect(parsed.sitemaps.map((n) => n.line)).toEqual([5]);
  });

  it("非ASCIIとパーセントエンコードは同じものとして比較する", () => {
    expect(verdicts("A", ["/日本", "/%e6%97%a5%e6%9c%ac"], "User-agent: *\nDisallow: /日本\n")).toEqual(["disallow:2", "disallow:2"]);
  });

  it("http(s)以外のURLは判定しない", () => {
    expect(verdicts("A", ["ftp://example.com/x"])).toEqual(["invalid"]);
  });
});
