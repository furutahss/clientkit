import { describe, expect, it } from "vitest";

import { applySnippet, createTexRenderer, EXAMPLES, SNIPPET_GROUPS, toImageSvg } from "./tex-image";

const render = createTexRenderer();

describe("TeX の描画", () => {
  it("例とすべての補助ボタンの TeX がエラーなく描画できる", () => {
    for (const tex of Object.values(EXAMPLES)) expect(render(tex, true)).toContain("<svg");
    for (const snippet of Object.values(SNIPPET_GROUPS).flat()) {
      expect(() => render(`\\begin{aligned}${applySnippet("", 0, 0, snippet.tex).value} x \\end{aligned}`, true), snippet.tex).not.toThrow();
    }
  });

  it("構文エラーは例外になる", () => {
    expect(() => render("\\frac{a}{", true)).toThrow();
    expect(() => render("\\undefinedcommand", true)).toThrow(/undefinedcommand/);
  });

  it("文字の大きさ・余白から px の大きさと viewBox を決める", () => {
    const svg = '<svg style="vertical-align: -1ex" width="2ex" height="1ex" viewBox="0 -1000 2000 1000">';
    const image = toImageSvg(`${svg}<g/></svg>`, { fontSize: 50, padding: 10, color: "#123456", background: "#ffffff" });
    expect(image).toMatchObject({ width: 120, height: 70 });
    // 切り上げた px と viewBox の縦横比が一致する
    expect(toImageSvg('<svg viewBox="0 -1000 2010 1000"></svg>', { fontSize: 30, padding: 0, color: "#000", background: "#fff" }).svg).toContain('viewBox="0 -1000 2033.3333333333333 1000"');
    expect(image.svg).toContain('viewBox="-200 -1200 2400 1400"');
    expect(image.svg).toContain('color="#123456"');
    expect(image.svg).not.toContain("vertical-align");
    expect(image.svg).toContain('<rect x="-200" y="-1200" width="2400" height="1400" fill="#ffffff"/>');
  });
});

describe("補助ボタンの挿入", () => {
  it("選択中の文字列を $ の位置に入れ、カーソルをその後ろに置く", () => {
    expect(applySnippet("a+b", 0, 1, "\\frac{$}{}")).toEqual({ value: "\\frac{a}{}+b", insert: "\\frac{a}{}", cursor: 7 });
    expect(applySnippet("x", 1, 1, "\\alpha ")).toEqual({ value: "x\\alpha ", insert: "\\alpha ", cursor: 8 });
  });
});
