import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IdGeneratorTool } from "./id-generator-tool";

describe("ID生成ツール", () => {
  it("既存画面ではUUID・ULID・パスワードへの切り替えを表示する", () => {
    const html = renderToStaticMarkup(createElement(IdGeneratorTool));

    expect(html).toContain(">UUID</button>");
    expect(html).toContain(">ULID</button>");
    expect(html).toContain(">パスワード</button>");
  });
});
