import { describe, expect, it } from "vitest";

import { htmlToJsx } from "./html-jsx";

const conv = (html: string, o: Partial<{ component: boolean; name: string; indent: number }> = {}) => htmlToJsx(html, { component: false, name: "Demo", indent: 2, ...o });

describe("HTML→JSX", () => {
  it("属性名・style・void要素・コメントを変換する", () => {
    const { jsx } = conv('<div class="box" style="margin-top: 4px; background-color:red; --x: 1"><label for="a">Name</label><input type="text" value="x" readonly maxlength="5"><br><!-- note --></div>');
    expect(jsx).toBe([
      '<div className="box" style={{ marginTop: "4px", backgroundColor: "red", "--x": 1 }}>',
      '  <label htmlFor="a">Name</label>',
      '  <input type="text" defaultValue="x" readOnly maxLength="5" />',
      "  <br />",
      "  {/* note */}",
      "</div>",
    ].join("\n"));
  });

  it("SVGの属性とイベント属性を変換する", () => {
    const { jsx, notes } = conv('<svg viewBox="0 0 24 24" xmlns:xlink="http://www.w3.org/1999/xlink"><path stroke-width="2" fill-rule="evenodd" clip-path="url(#a)" d="M0 0"/><use xlink:href="#a"/></svg><button onclick="go()" data-id="1" aria-label="x" disabled>OK</button>');
    expect(jsx).toContain('strokeWidth="2" fillRule="evenodd" clipPath="url(#a)"');
    expect(jsx).toContain('xlinkHref="#a"');
    expect(jsx).toContain('xmlnsXlink=');
    expect(jsx).toContain('data-id="1" aria-label="x" disabled');
    expect(jsx).toContain("onClick={() => { /* go() */ }}");
    expect(notes).toEqual(expect.arrayContaining(["event", "fragment"]));
    expect(jsx.startsWith("<>")).toBe(true);
  });

  it("波括弧をエスケープし、コンポーネントとして出力できる", () => {
    expect(conv("<p>a {b} c</p>").jsx).toBe("<p>a {'{'}b{'}'} c</p>");
    const { jsx } = conv("<p>Hi</p>", { component: true, name: "Hello" });
    expect(jsx).toBe("export default function Hello() {\n  return (\n    <p>Hi</p>\n  );\n}\n");
  });

  it("閉じ忘れを補い、通知する", () => {
    expect(conv("<div><span>x").notes).toContain("unclosed");
    expect(conv('<img src="a.png" alt="x">').jsx).toBe('<img src="a.png" alt="x" />');
  });
});
