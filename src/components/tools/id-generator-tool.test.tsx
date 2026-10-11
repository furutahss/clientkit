import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IdGeneratorTool, UuidGeneratorTool } from "./id-generator-tool";

describe("ID生成ツール", () => {
  it("UUID専用画面ではULID・パスワードへの切り替えを表示しない", () => {
    const html = renderToStaticMarkup(createElement(UuidGeneratorTool));

    expect(html).toContain("v4（ランダム）");
    expect(html).toContain("v7（時刻順）");
    expect(html).not.toContain("ULID");
    expect(html).not.toContain("パスワード");
  });

  it("既存画面ではUUID・ULID・パスワードへの切り替えを表示する", () => {
    const html = renderToStaticMarkup(createElement(IdGeneratorTool));

    expect(html).toContain(">UUID</button>");
    expect(html).toContain(">ULID</button>");
    expect(html).toContain(">パスワード</button>");
  });
});
