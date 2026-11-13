import { describe, expect, it } from "vitest";

import { analyzeAccessLog, parseLogLine } from "./access-log";

const a = '203.0.113.5 - - [10/Oct/2026:13:55:36 +0900] "GET /index.html?x=1 HTTP/1.1" 200 2326 "-" "Mozilla/5.0" 0.123';
const b = '198.51.100.7 - bob [10/Oct/2026:13:55:37 +0900] "POST /api HTTP/1.1" 502 0 "-" "curl/8" 2.5';
const alb = 'https 2026-10-10T04:55:36.000000Z app/x/abc 192.0.2.9:5000 10.0.0.1:80 0.001 0.050 0.000 404 404 100 200 "GET https://example.com:443/missing HTTP/1.1" "UA" - -';

describe("アクセスログ解析", () => {
  it("nginx/Apache combined とALBの行を解析する", () => {
    expect(parseLogLine(a)).toMatchObject({ ip: "203.0.113.5", method: "GET", status: 200, bytes: 2326, seconds: 0.123 });
    expect(parseLogLine(alb)).toMatchObject({ ip: "192.0.2.9", path: "/missing", status: 404 });
    expect(parseLogLine("garbage")).toBeNull();
  });

  it("集計する", () => {
    const r = analyzeAccessLog([a, b, a, alb, "garbage"].join("\n"));
    expect(r).toMatchObject({ total: 5, parsed: 4, failed: 1 });
    expect(r.statuses).toEqual([["2xx", 2], ["4xx", 1], ["5xx", 1]]);
    expect(r.topPaths[0]).toEqual(["/index.html", 2]);
    expect(r.slowest[0].status).toBe(502);
    expect(r.errorPaths).toEqual([["502 /api", 1]]);
  });
});
