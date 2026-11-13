import { describe, expect, it } from "vitest";

import { analyzeHeaders, explainCacheControl, parseCsp, parseHeaders } from "./http-headers";

const en = (_ja: string, en: string) => en;

describe("HTTPヘッダー診断", () => {
  it("ステータス行を無視し、折り返しを連結する", () => {
    const h = parseHeaders("HTTP/2 200\ncontent-type: text/html\ncontent-security-policy: default-src 'self';\n  img-src *");
    expect(h.map((x) => x.name)).toEqual(["content-type", "content-security-policy"]);
    expect(parseCsp(h[1].value).get("img-src")).toEqual(["*"]);
  });

  it("CORSの * と credentials の併用をエラーにする", () => {
    const f = analyzeHeaders(parseHeaders("Access-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true"), en);
    expect(f.some((x) => x.area === "CORS" && x.level === "error")).toBe(true);
  });

  it("Cookieの属性不足を検出する", () => {
    const f = analyzeHeaders(parseHeaders("Set-Cookie: sid=1; SameSite=None\nSet-Cookie: __Host-a=1; Secure; Path=/; Domain=x.com"), en);
    expect(f.filter((x) => x.level === "error").length).toBe(2);
  });

  it("CSPの unsafe-inline を警告し、Cache-Controlを説明する", () => {
    const f = analyzeHeaders(parseHeaders("Content-Security-Policy: script-src 'unsafe-inline'"), en);
    expect(f.some((x) => x.message.includes("unsafe-inline"))).toBe(true);
    expect(explainCacheControl("public, max-age=3600, immutable", en).length).toBe(3);
  });
});
