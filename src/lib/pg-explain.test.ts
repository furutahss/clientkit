import { describe, expect, it } from "vitest";

import { flattenPlan, parseExplain } from "./pg-explain";

const ANALYZED = JSON.stringify([
  {
    Plan: {
      "Node Type": "Nested Loop",
      "Join Type": "Inner",
      "Plan Rows": 100,
      "Actual Rows": 100000,
      "Actual Loops": 1,
      "Actual Total Time": 50,
      Plans: [
        { "Node Type": "Seq Scan", "Relation Name": "orders", Alias: "o", "Plan Rows": 10, "Actual Rows": 10, "Actual Loops": 1, "Actual Total Time": 5 },
        {
          "Node Type": "Index Scan",
          "Relation Name": "items",
          "Index Name": "items_order_id_idx",
          "Plan Rows": 0,
          "Actual Rows": 0,
          "Actual Loops": 10,
          "Actual Total Time": 4,
        },
        { "Node Type": "Seq Scan", "Relation Name": "x", "Plan Rows": 5, "Actual Rows": 0, "Actual Loops": 0, "Actual Total Time": 0 },
      ],
    },
    "Planning Time": 0.5,
    "Execution Time": 51,
  },
]);

function plan(text: string) {
  const result = parseExplain(text);
  if (result.status !== "ok") throw new Error(result.status);
  return result.plan;
}

describe("EXPLAIN解析", () => {
  it("ループ回数を考慮して子ノードを除いた自身の時間を計算する", () => {
    const { root, analyzed, executionTime, nodeCount } = plan(ANALYZED);
    expect([analyzed, executionTime, nodeCount]).toEqual([true, 51, 4]);
    const [seq, index, never] = root.children;
    expect(index.inclusiveTime).toBe(40);
    expect(root.selfTime).toBe(5);
    expect(seq.selfTime).toBe(5);
    expect(never.neverExecuted).toBe(true);
    expect(root.label).toBe("Inner");
    expect(index.label).toBe("on items using items_order_id_idx");
    expect(seq.label).toBe("on orders o");
  });

  it("推定行数と実測行数のずれ。0行でも計算エラーにならない", () => {
    const [root, seq, index, never] = flattenPlan(plan(ANALYZED).root);
    expect([root.misestimate, root.underestimated]).toEqual([1000, true]);
    expect(seq.misestimate).toBe(1);
    expect(index.misestimate).toBe(1);
    expect(never.misestimate).toBeUndefined();
  });

  it("ANALYZEなしの計画では実測値を0として扱わない", () => {
    const { root, analyzed } = plan('[{"Plan": {"Node Type": "Seq Scan", "Plan Rows": 3, "Total Cost": 1.5}}]');
    expect(analyzed).toBe(false);
    expect([root.actualRows, root.loops, root.inclusiveTime, root.selfTime, root.misestimate]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(root.neverExecuted).toBe(false);
  });

  it("Gather配下はプロセス数で割って時間を概算する", () => {
    const { root } = plan(
      JSON.stringify({
        Plan: {
          "Node Type": "Gather",
          "Workers Launched": 2,
          "Actual Loops": 1,
          "Actual Total Time": 10,
          Plans: [{ "Node Type": "Parallel Seq Scan", "Actual Loops": 3, "Actual Total Time": 9 }],
        },
      })
    );
    expect(root.children[0].inclusiveTime).toBe(9);
    expect(root.selfTime).toBe(1);
  });

  it("psqlの表形式の装飾を取り除いて読み込む", () => {
    const text = `                QUERY PLAN\n-------------------------------\n [                            +\n   {                          +\n     "Plan": {"Node Type": "Result"} +\n   }                          +\n ]\n(1 row)\n`;
    expect(plan(text).root.nodeType).toBe("Result");
  });

  it("構文エラーと計画のないJSON", () => {
    expect(parseExplain("[{").status).toBe("syntax");
    expect(parseExplain('{"a": 1}').status).toBe("noPlan");
  });
});
