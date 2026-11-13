import { describe, expect, it } from "vitest";

import { defaultColumns, filterRows, levelCounts, parseNdjson } from "./ndjson";

const log = [
  '{"time":"2026-01-01T00:00:02Z","level":"error","msg":"db down","ctx":{"host":"a"}}',
  '{"time":"2026-01-01T00:00:01Z","level":"info","msg":"started","ctx":{"host":"b"}}',
  "not json",
  '{"time":"2026-01-01T00:00:03Z","level":"WARN","msg":"slow"}',
].join("\n");

describe("NDJSONビューア", () => {
  const { rows, errors, keys } = parseNdjson(log);
  it("解析・エラー行・キーの平坦化", () => {
    expect(rows).toHaveLength(3);
    expect(errors).toEqual([{ line: 3, message: expect.any(String) }]);
    expect(keys).toContain("ctx.host");
    expect(defaultColumns(keys).slice(0, 3)).toEqual(["time", "level", "msg"]);
  });
  it("時刻順に並べ、レベル・文字列・フィールドで絞り込む", () => {
    expect(filterRows(rows, keys, { text: "", minLevel: 0, field: "", limit: 10 }).map((r) => r.data.msg)).toEqual(["started", "db down", "slow"]);
    expect(filterRows(rows, keys, { text: "", minLevel: 3, field: "", limit: 10 }).map((r) => r.data.msg)).toEqual(["db down", "slow"]);
    expect(filterRows(rows, keys, { text: "DB", minLevel: 0, field: "", limit: 10 })).toHaveLength(1);
    expect(filterRows(rows, keys, { text: "", minLevel: 0, field: "ctx.host=b", limit: 10 })[0].data.msg).toBe("started");
    expect(filterRows(rows, keys, { text: "", minLevel: 0, field: "", limit: 1 })).toHaveLength(1);
  });
  it("レベル別の件数", () => {
    expect(levelCounts(rows, keys).map(([k]) => k).sort()).toEqual(["WARN", "error", "info"]);
  });
});
