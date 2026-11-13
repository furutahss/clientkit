import { describe, expect, it } from "vitest";

import { analyzeExplain, parseExplain } from "./mysql-explain";

const en = (_: string, e: string) => e;
const table = `+----+-------------+-------+------+---------------+------+---------+------+--------+----------+----------------------------------------------+
| id | select_type | table | type | possible_keys | key  | key_len | ref  | rows   | filtered | Extra                                        |
+----+-------------+-------+------+---------------+------+---------+------+--------+----------+----------------------------------------------+
|  1 | SIMPLE      | u     | ALL  | NULL          | NULL | NULL    | NULL | 120000 |     5.00 | Using where; Using temporary; Using filesort |
|  1 | SIMPLE      | o     | ref  | idx_user      | idx_user | 4   | db.u.id |  3  |   100.00 | Using index                                  |
+----+-------------+-------+------+---------------+------+---------+------+--------+----------+----------------------------------------------+`;

describe("MySQL EXPLAIN", () => {
  it("罫線付きの表・TSV・\\G形式を解析する", () => {
    const rows = parseExplain(table);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ table: "u", type: "ALL", rows: "120000", extra: "Using where; Using temporary; Using filesort" });
    expect(parseExplain("id\tselect_type\ttable\ttype\tkey\trows\textra\n1\tSIMPLE\tt\tref\tidx\t5\t")[0]).toMatchObject({ table: "t", key: "idx" });
    expect(parseExplain("*************************** 1. row ***************************\n           id: 1\n        table: t\n         type: ALL\n         rows: 10\n")[0]).toMatchObject({ table: "t", type: "ALL" });
  });

  it("フルスキャン・filesort・temporary・インデックス未使用を警告する", () => {
    const w = analyzeExplain(parseExplain(table), en);
    const msgs = w.map((x) => x.message).join("|");
    expect(w[0]).toMatchObject({ level: "error", table: "u" });
    for (const k of ["type=ALL", "filesort", "temporary", "No index", "filtered=5%"]) expect(msgs).toContain(k);
    expect(w.some((x) => x.table === "o")).toBe(false);
  });

  it("FORMAT=JSON を解析する", () => {
    const json = JSON.stringify({ query_block: { select_id: 1, ordering_operation: { using_filesort: true, table: { table_name: "t", access_type: "range", key: "idx", rows_examined_per_scan: 40, filtered: "100.00" } } } });
    expect(parseExplain(json)[0]).toMatchObject({ table: "t", type: "range", key: "idx", extra: "Using filesort" });
  });

  it("問題がなければ、その旨を返す", () => {
    expect(analyzeExplain(parseExplain("id\ttable\ttype\tkey\trows\textra\n1\tt\tconst\tPRIMARY\t1\t"), en)).toEqual([{ level: "info", table: "-", message: "No obvious problems found." }]);
  });
});
