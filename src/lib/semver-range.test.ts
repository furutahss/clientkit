import { describe, expect, it } from "vitest";

import { checkCandidates, checkRange } from "./semver-range";

const statuses = (range: string, versions: string[], includePrerelease = false) =>
  checkCandidates(range, versions, includePrerelease).map((r) => r.status);

describe("SemVer範囲", () => {
  it("^ と ~ の範囲", () => {
    expect(statuses("^1.2.0", ["1.2.0", "1.9.0", "2.0.0", "1.1.9"])).toEqual(["match", "match", "noMatch", "noMatch"]);
    expect(statuses("~1.2.0", ["1.2.9", "1.3.0"])).toEqual(["match", "noMatch"]);
  });

  it("0.x 系の ^ はマイナー・パッチで固定される", () => {
    expect(statuses("^0.2.3", ["0.2.9", "0.3.0"])).toEqual(["match", "noMatch"]);
    expect(statuses("^0.0.3", ["0.0.3", "0.0.4"])).toEqual(["match", "noMatch"]);
    expect(checkRange("^0.2.3")).toEqual({ status: "valid", normalized: ">=0.2.3 <0.3.0-0" });
  });

  it("比較演算子・ハイフン範囲・|| の組み合わせ", () => {
    expect(statuses(">=1.0.0 <1.5.0 || 2.x", ["1.4.9", "1.5.0", "2.3.0"])).toEqual(["match", "noMatch", "match"]);
    expect(statuses("1.0.0 - 1.2.0", ["1.2.0", "1.2.1"])).toEqual(["match", "noMatch"]);
  });

  it("プレリリースは同じバージョンの比較子がある場合だけ含まれる", () => {
    const [beta, other] = checkCandidates("^1.2.0-beta.1", ["1.2.0-beta.2", "1.3.0-beta.1"], false);
    expect(beta.status).toBe("match");
    expect(other).toMatchObject({ status: "noMatch", prereleaseExcluded: true });
    expect(statuses("^1.2.0-beta.1", ["1.3.0-beta.1"], true)).toEqual(["match"]);
  });

  it("不正な候補は不正として区別する", () => {
    expect(statuses("^1.0.0", ["1.2", "latest", "1.0.0"])).toEqual(["invalid", "invalid", "match"]);
  });

  it.each([
    ["latest", "tag"],
    ["next", "tag"],
    ["git+https://github.com/a/b.git", "nonRegistry"],
    ["github:user/repo", "nonRegistry"],
    ["user/repo#v1", "nonRegistry"],
    ["file:../pkg", "nonRegistry"],
    ["npm:other@^1", "nonRegistry"],
    [">=1.0.0 <", "invalid"],
    ["^1.2.x.4", "invalid"],
    ["", "empty"],
  ])("範囲 %s は %s", (range, status) => {
    expect(checkRange(range).status).toBe(status);
  });

  it("* と x は有効な範囲", () => {
    expect(checkRange("*").status).toBe("valid");
    expect(checkRange("1.x").status).toBe("valid");
  });
});
