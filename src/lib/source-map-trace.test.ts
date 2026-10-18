import { describe, expect, it } from "vitest";

import { SAMPLE_SOURCE_MAP, SAMPLE_STACK } from "./source-map-sample";
import { loadSourceMap, parseStack, resolveStack, type ResolvedFrame } from "./source-map-trace";

function map(text = SAMPLE_SOURCE_MAP) {
  const result = loadSourceMap(text);
  if (result.status !== "ok") throw new Error(result.status);
  return result.map;
}

const summary = (frames: ResolvedFrame[]) =>
  frames.map((f) => (f.status === "mapped" ? `${f.source}:${f.line}:${f.column}` : f.status));

describe("スタックトレースの復元", () => {
  it("Chrome形式のフレームを元のソース位置に戻し、他のファイルや位置のない行は保持する", () => {
    const frames = resolveStack(map(), parseStack(SAMPLE_STACK), "app.min.js", 1);
    expect(summary(frames)).toEqual(["noLocation", "src/cart.js:5:20", "otherFile", "src/cart.js:15:10", "noLocation"]);
    expect(frames[1].frame.text).toContain("addToCart");
    const mapped = frames[1] as Extract<ResolvedFrame, { status: "mapped" }>;
    expect(mapped.snippet?.find((s) => s.line === 5)?.text).toContain("cart.items.find");
  });

  it("列番号の基準（1始まり・0始まり）の違いで位置がずれる", () => {
    const stack = parseStack("at f (app.min.js:1:47)");
    expect(summary(resolveStack(map(), stack, "app.min.js", 1))).toEqual(["src/cart.js:3:11"]);
    // 1始まりの値を0始まりとして扱うと1文字右にずれ、別の位置になることがある
    expect(summary(resolveStack(map(), parseStack("at f (app.min.js:1:46)"), "app.min.js", 0))).toEqual(["src/cart.js:3:11"]);
    expect(summary(resolveStack(map(), parseStack("at f (app.min.js:1:41)"), "app.min.js", 1))).toEqual(["src/cart.js:3:5"]);
  });

  it("Firefox・Safari形式と、生成ファイル名の指定なし", () => {
    const frames = resolveStack(map(), parseStack("addToCart@https://example.com/app.min.js:1:88"), "", 1);
    expect(summary(frames)).toEqual(["src/cart.js:5:20"]);
  });

  it("sourcesContent がなくても位置は復元できる", () => {
    const raw = JSON.parse(SAMPLE_SOURCE_MAP);
    delete raw.sourcesContent;
    const [frame] = resolveStack(map(JSON.stringify(raw)), parseStack("at f (app.min.js:1:88)"), "app.min.js", 1);
    expect(frame).toMatchObject({ status: "mapped", line: 5, snippet: undefined });
  });

  it("対応付けできない位置", () => {
    expect(summary(resolveStack(map(), parseStack("at f (app.min.js:9:1)"), "app.min.js", 1))).toEqual(["unmapped"]);
  });

  it.each([
    ["{", "syntax"],
    ["[]", "notObject"],
    ['{"version": 2, "mappings": "", "sources": []}', "version"],
    ['{"version": 3, "sections": []}', "indexed"],
    ['{"version": 3, "mappings": 1, "sources": []}', "invalid"],
  ])("不正なMap %s は %s", (text, status) => {
    expect(loadSourceMap(text).status).toBe(status);
  });
});
