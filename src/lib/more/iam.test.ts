import { describe, expect, it } from "vitest";

import { explainIamPolicy } from "./iam";

const en = (_: string, e: string) => e;
const policy = (s: unknown) => JSON.stringify({ Version: "2012-10-17", Statement: s });

describe("IAMポリシー解説", () => {
  it("管理者権限とPassRoleをエラーにする", () => {
    const r = explainIamPolicy(policy([{ Sid: "A", Effect: "Allow", Action: "*", Resource: "*" }, { Sid: "B", Effect: "Allow", Action: ["iam:PassRole"], Resource: "*" }]), en);
    expect(r.findings.filter((f) => f.level === "error").map((f) => f.sid)).toEqual(["A", "B"]);
    expect(r.statements[0]).toBe("ALLOW: actions=[*] resources=[*]");
  });

  it("公開Principal・NotAction・Version を指摘し、Denyは対象外", () => {
    const r = explainIamPolicy(JSON.stringify({ Version: "2008-10-17", Statement: [{ Effect: "Allow", Principal: "*", Action: "s3:GetObject", Resource: "arn:aws:s3:::b/*" }, { Effect: "Allow", NotAction: "iam:*", Resource: "arn:aws:s3:::b" }, { Effect: "Deny", Action: "*", Resource: "*" }] }), en);
    const msgs = r.findings.map((f) => f.message).join("|");
    expect(msgs).toContain("anyone");
    expect(msgs).toContain("NotAction");
    expect(msgs).toContain("Version");
    expect(r.findings.some((f) => f.sid === "#3")).toBe(false);
  });

  it("条件付きの絞り込まれた許可は問題なし、Statementなしは例外", () => {
    const ok = explainIamPolicy(policy({ Effect: "Allow", Action: "s3:GetObject", Resource: "arn:aws:s3:::b/*", Condition: { StringEquals: { "aws:SourceVpc": "vpc-1" } } }), en);
    expect(ok.findings).toEqual([{ level: "info", sid: "-", message: "No obvious problems found." }]);
    expect(() => explainIamPolicy("{}", en)).toThrow("no-statement");
  });
});
