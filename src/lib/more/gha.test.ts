import { describe, expect, it } from "vitest";

import { analyzeWorkflow, cronToJst } from "./gha";

const en = (_: string, e: string) => e;
const wf = `
name: CI
on:
  push:
    branches: [main]
  pull_request_target:
  schedule:
    - cron: "30 18 * * 1-5"
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { ref: "\${{ github.event.pull_request.head.sha }}" }
      - uses: someone/action@main
      - uses: third/party@v2
      - run: echo "\${{ github.event.pull_request.title }}"
  test:
    needs: [build]
    runs-on: [self-hosted, linux]
    timeout-minutes: 10
    permissions: { contents: read }
    steps:
      - uses: actions/setup-node@0123456789abcdef0123456789abcdef01234567
      - run: curl -fsSL https://x.sh | sh
`;

describe("GitHub Actions", () => {
  it("cronをJSTに直す", () => {
    expect(cronToJst("30 18 * * 1-5")).toBe("03:30 JST (+1 day)");
    expect(cronToJst("0 0 * * *")).toBe("09:00 JST");
    expect(cronToJst("*/5 * * * *")).toBe("");
  });

  it("トリガー・ジョブ・依存関係を取り出す", () => {
    const r = analyzeWorkflow(wf, en);
    expect(r.name).toBe("CI");
    expect(r.triggers.map((t) => t.event)).toEqual(["push", "pull_request_target", "schedule"]);
    expect(r.triggers[2].detail).toBe("30 18 * * 1-5 (= 03:30 JST (+1 day))");
    expect(r.jobs.map((j) => [j.id, j.needs, j.steps, j.runsOn])).toEqual([["build", [], 4, "ubuntu-latest"], ["test", ["build"], 2, "self-hosted, linux"]]);
    expect(r.mermaid).toContain("build --> test");
  });

  it("危険な設定を検出する", () => {
    const f = analyzeWorkflow(wf, en).findings;
    const msgs = (target: string) => f.filter((x) => x.target === target).map((x) => x.message).join("|");
    expect(f.find((x) => x.target === "pull_request_target")).toMatchObject({ level: "error" });
    expect(msgs("build#4")).toContain("script injection");
    expect(msgs("build")).toContain("pinned to a branch");
    expect(msgs("build")).toContain("third/party@v2");
    expect(msgs("build")).toContain("permissions is not set");
    expect(msgs("test#2")).toContain("curl");
    expect(msgs("test")).toBe("");
  });

  it("ワークフローでないYAMLは例外", () => {
    expect(() => analyzeWorkflow("a: 1", en)).toThrow("not-workflow");
    expect(analyzeWorkflow("on: push\njobs:\n  a:\n    runs-on: x\n    steps: []", en).triggers[0].event).toBe("push");
  });
});
