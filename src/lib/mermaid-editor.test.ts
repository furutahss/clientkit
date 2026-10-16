import { describe, expect, it } from "vitest";

import {
  clampZoom,
  decodeShareState,
  encodeShareState,
  errorLine,
  fitZoom,
  indentText,
  svgViewBox,
  TEMPLATES,
  withBackground,
  withSize,
} from "./mermaid-editor";

describe("共有リンクの状態", () => {
  it("圧縮して元に戻せる（日本語・長い図）", () => {
    const state = { code: TEMPLATES.er + "\n".repeat(3) + "%% 日本語のコメント 🎉", theme: "forest" as const, background: "transparent" };
    const encoded = encodeShareState(state);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShareState(encoded)).toEqual(state);
  });

  it("不正な値は null、不明なテーマ・背景は既定値にする", () => {
    expect(decodeShareState("!!!")).toBeNull();
    expect(decodeShareState("")).toBeNull();
    const encoded = encodeShareState({ code: "graph TD", theme: "evil" as never, background: "url(javascript:x)" });
    expect(decodeShareState(encoded)).toEqual({ code: "graph TD", theme: "default", background: "#ffffff" });
  });
});

describe("errorLine", () => {
  it("エラーメッセージから行番号を取り出す", () => {
    expect(errorLine("Parse error on line 3:\n...A --> \n---^\nExpecting 'NODE'")).toBe(3);
    expect(errorLine("Lexical error on line 12. Unrecognized text.")).toBe(12);
    expect(errorLine("No diagram type detected")).toBeNull();
  });
});

describe("SVG の加工", () => {
  const svg = '<svg id="m" width="100%" style="max-width: 320px;" viewBox="-8 -8 320.5 200" xmlns="http://www.w3.org/2000/svg"><g/></svg>';

  it("viewBox を読み取る", () => {
    expect(svgViewBox(svg)).toEqual({ x: -8, y: -8, width: 320.5, height: 200 });
    expect(svgViewBox("<svg></svg>")).toBeNull();
  });

  it("背景の矩形を入れる", () => {
    expect(withBackground(svg, "#112233")).toContain('<rect x="-8" y="-8" width="320.5" height="200" fill="#112233"/><g/>');
    expect(withBackground(svg, "transparent")).toBe(svg);
  });

  it("幅と高さを明示する", () => {
    const sized = withSize(svg, 641, 400);
    expect(sized).toContain('width="641" height="400"');
    expect(sized).not.toContain("100%");
    expect(sized).not.toContain("max-width");
  });
});

describe("ズーム", () => {
  it("範囲内に収める", () => {
    expect(clampZoom(100)).toBe(8);
    expect(clampZoom(0)).toBe(0.1);
    expect(fitZoom({ width: 2000, height: 500 }, { width: 1032, height: 600 })).toBe(0.5);
    expect(fitZoom({ width: 100, height: 100 }, { width: 1000, height: 1000 })).toBe(1);
  });
});

describe("indentText", () => {
  it("カーソル位置に字下げを入れる", () => {
    expect(indentText("ab", 1, 1, false)).toEqual({ value: "a  b", start: 3, end: 3 });
  });

  it("複数行を字下げ・字下げ解除する", () => {
    const value = "flowchart\nA --> B\nB --> C\n";
    const indented = indentText(value, 10, value.length, false);
    expect(indented.value).toBe("flowchart\n  A --> B\n  B --> C\n");
    const outdented = indentText(indented.value, indented.start, indented.end, true);
    expect(outdented.value).toBe(value);
  });

  it("Shift+Tab は行の途中にカーソルがあっても行頭の空白を取る", () => {
    expect(indentText("x\n    abc", 7, 7, true)).toEqual({ value: "x\n  abc", start: 5, end: 5 });
  });
});
