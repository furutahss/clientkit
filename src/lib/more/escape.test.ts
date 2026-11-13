import { describe, expect, it } from "vitest";

import { ESCAPE_KINDS, escapeText, unescapeText } from "./escape";

describe("エスケープ", () => {
  it("各形式のエスケープ", () => {
    expect(escapeText("js", "a'b\"c\n\\")).toBe("a\\'b\\\"c\\n\\\\");
    expect(escapeText("json", 'a"b\n\t')).toBe('a\\"b\\n\\t');
    expect(escapeText("html", `<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    expect(escapeText("sql", "O'Brien")).toBe("O''Brien");
    expect(escapeText("shell", "it's $HOME")).toBe(`'it'\\''s $HOME'`);
    expect(escapeText("regex", "a.b*c(d)[e]")).toBe("a\\.b\\*c\\(d\\)\\[e\\]");
    expect(escapeText("csv", 'a,"b"')).toBe('"a,""b"""');
    expect(escapeText("csv", "plain")).toBe("plain");
    expect(escapeText("url-component", "a b&c")).toBe("a%20b%26c");
  });

  it("エスケープして戻すと元の文字列になる", () => {
    const sample = `He said "it's <b>fine</b> & done"\n\ttab \\ back`;
    for (const k of ESCAPE_KINDS) {
      const input = k === "regex" || k === "csv" || k === "sql" || k === "shell" ? sample : sample;
      expect(unescapeText(k, escapeText(k, input))).toBe(input);
    }
  });

  it("JSの各種エスケープ表記と名前付き文字参照を解釈する", () => {
    expect(unescapeText("js", "\\u3042\\x41\\u{1F600}\\n")).toBe("あA😀\n");
    expect(unescapeText("html", "&lt;&copy;&nbsp;&#65;&#x42;&unknown;")).toBe("<©\u00a0AB&unknown;");
    expect(() => unescapeText("url-component", "%E0%A4%A")).toThrow();
  });
});
