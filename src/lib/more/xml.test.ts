import { describe, expect, it } from "vitest";

import { formatXml, jsonToXml, minifyXml, parseXml, xmlToJson, xpath, XmlError } from "./xml";

const src = `<?xml version="1.0"?><root a="1"><item id="x">A &amp; B</item><item id="y">C</item><!-- c --><empty/></root>`;

describe("XML", () => {
  it("整形・圧縮できる", () => {
    expect(formatXml(src)).toBe(`<?xml version="1.0"?>\n<root a="1">\n  <item id="x">A &amp; B</item>\n  <item id="y">C</item>\n  <!-- c -->\n  <empty/>\n</root>`);
    expect(minifyXml(src)).toBe(`<?xml version="1.0"?><root a="1"><item id="x">A &amp; B</item><item id="y">C</item><empty/></root>`);
  });

  it("閉じ忘れ・不一致を行番号付きで報告する", () => {
    expect(() => parseXml("<a>\n<b></a>")).toThrow(XmlError);
    expect(() => parseXml("<a>")).toThrow(/Missing/);
  });

  it("JSONと相互変換できる", () => {
    const json = xmlToJson(src);
    expect(json).toEqual({ root: { "@a": "1", item: [{ "@id": "x", "#text": "A & B" }, { "@id": "y", "#text": "C" }], empty: "" } });
    expect(xmlToJson(jsonToXml(json))).toEqual(json);
  });

  it("XPathの基本を評価する", () => {
    const nodes = parseXml(src);
    expect(xpath(nodes, "/root/item[@id='y']/text()")).toEqual(["C"]);
    expect(xpath(nodes, "//item/@id")).toEqual(["x", "y"]);
    expect(xpath(nodes, "/root/item[1]")).toEqual(['<item id="x">A &amp; B</item>']);
    expect(() => xpath(nodes, "count(//a)")).toThrow(XmlError);
  });
});
