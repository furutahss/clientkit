import { describe, expect, it } from "vitest";

import { sortChanges, summarizePlan } from "./terraform-plan";

const plan = JSON.stringify({
  terraform_version: "1.9.0",
  output_changes: { url: {} },
  resource_changes: [
    { address: "aws_instance.web", type: "aws_instance", change: { actions: ["update"], before: { ami: "ami-1", tags: { Name: "a" }, ebs: [{ size: 8 }] }, after: { ami: "ami-2", tags: { Name: "a", Env: "prod" }, ebs: [{ size: 16 }] }, after_unknown: {} } },
    { address: "aws_db.main", type: "aws_db", change: { actions: ["delete", "create"], before: { name: "old", password: "x" }, after: { name: "new", password: "y", arn: null }, after_unknown: { arn: true }, before_sensitive: { password: true }, after_sensitive: { password: true }, replace_paths: [["name"]] } },
    { address: "aws_s3_bucket.logs", type: "aws_s3_bucket", change: { actions: ["create"], before: null, after: { bucket: "logs" }, after_unknown: { id: true } } },
    { address: "aws_sg.old", type: "aws_sg", change: { actions: ["delete"], before: { name: "sg" }, after: null } },
    { address: "aws_vpc.main", type: "aws_vpc", change: { actions: ["no-op"], before: {}, after: {} } },
  ],
});

describe("Terraform plan", () => {
  const r = summarizePlan(plan);
  it("アクションを集計する（delete+create は replace）", () => {
    expect(r.counts).toMatchObject({ create: 1, update: 1, delete: 1, replace: 1, "no-op": 1 });
    expect(r.outputs).toBe(1);
    expect(r.terraformVersion).toBe("1.9.0");
    expect(sortChanges(r.changes).map((c) => c.action)).toEqual(["delete", "replace", "update", "create", "no-op"]);
  });

  it("変更された属性だけを before→after で出す", () => {
    const web = r.changes.find((c) => c.address === "aws_instance.web")!;
    expect(web.changes).toEqual([{ path: "ami", before: '"ami-1"', after: '"ami-2"' }, { path: "tags.Env", before: "(none)", after: '"prod"' }, { path: "ebs[0].size", before: "8", after: "16" }]);
  });

  it("機密値は隠し、apply後に決まる値と置換の理由を示す", () => {
    const db = r.changes.find((c) => c.address === "aws_db.main")!;
    expect(db.changes).toEqual([{ path: "name", before: '"old"', after: '"new"' }, { path: "password", before: "(sensitive)", after: "(sensitive)" }, { path: "arn", before: "(none)", after: "(known after apply)" }]);
    expect(db.replaceReasons).toEqual(["name"]);
    expect(db.sensitive).toBe(true);
    expect(r.changes.find((c) => c.address === "aws_s3_bucket.logs")!.changes).toEqual([{ path: "bucket", before: "(none)", after: '"logs"' }, { path: "id", before: "(none)", after: "(known after apply)" }]);
  });

  it("planでないJSONは例外", () => {
    expect(() => summarizePlan("{}")).toThrow("not-plan");
  });
});
