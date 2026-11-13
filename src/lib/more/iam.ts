import type { T } from "./types";

export type IamFinding = { level: "error" | "warn" | "info"; sid: string; message: string };
type Stmt = { Sid?: string; Effect?: string; Principal?: unknown; NotPrincipal?: unknown; Action?: unknown; NotAction?: unknown; Resource?: unknown; NotResource?: unknown; Condition?: unknown };

const list = (v: unknown): string[] => (v === undefined ? [] : Array.isArray(v) ? v.map(String) : [String(v)]);
const principals = (p: unknown): string[] => (typeof p === "string" ? [p] : p && typeof p === "object" ? Object.entries(p).flatMap(([k, v]) => list(v).map((x) => `${k}:${x}`)) : []);

export function explainIamPolicy(json: string, t: T): { statements: string[]; findings: IamFinding[] } {
  const doc = JSON.parse(json) as { Version?: string; Statement?: Stmt | Stmt[] };
  const findings: IamFinding[] = [];
  const statements: string[] = [];
  const add = (level: IamFinding["level"], sid: string, ja: string, en: string) => findings.push({ level, sid, message: t(ja, en) });
  if (!doc || typeof doc !== "object" || !doc.Statement) throw new Error("no-statement");
  if (doc.Version !== "2012-10-17") add("warn", "-", "Version は \"2012-10-17\" にしてください（古いVersionではポリシー変数が使えません）。", "Set Version to \"2012-10-17\" (the old version does not support policy variables).");
  const stmts = Array.isArray(doc.Statement) ? doc.Statement : [doc.Statement];
  stmts.forEach((s, i) => {
    const sid = s.Sid ?? `#${i + 1}`;
    const allow = s.Effect === "Allow";
    if (s.Effect !== "Allow" && s.Effect !== "Deny") add("error", sid, "Effect は Allow か Deny です。", "Effect must be Allow or Deny.");
    const actions = list(s.Action), notActions = list(s.NotAction), res = list(s.Resource), notRes = list(s.NotResource);
    const who = principals(s.Principal);
    const hasCondition = s.Condition !== undefined && Object.keys(s.Condition as object).length > 0;
    const verb = allow ? t("許可", "ALLOW") : t("拒否", "DENY");
    const act = actions.length ? actions.join(", ") : notActions.length ? t(`${notActions.join(", ")} 以外のすべて`, `everything except ${notActions.join(", ")}`) : "?";
    const target = res.length ? res.join(", ") : notRes.length ? t(`${notRes.join(", ")} 以外のすべて`, `everything except ${notRes.join(", ")}`) : t("(リソース指定なし)", "(no resource)");
    statements.push(`${verb}: ${who.length ? `${t("対象", "principal")}=${who.join(", ")} ` : ""}${t("操作", "actions")}=[${act}] ${t("リソース", "resources")}=[${target}]${hasCondition ? ` ${t("条件あり", "with conditions")}(${Object.keys(s.Condition as object).join(", ")})` : ""}`);
    if (!allow) return;
    if (actions.includes("*") && res.includes("*")) add("error", sid, "Action \"*\" と Resource \"*\" の組み合わせは、すべての操作をすべてのリソースに許可する管理者権限です。", "Action \"*\" with Resource \"*\" grants administrator access to everything.");
    else if (actions.includes("*")) add("warn", sid, "Action \"*\" はすべての操作を許可します。", "Action \"*\" allows every action.");
    for (const a of actions.filter((x) => x !== "*" && x.endsWith(":*"))) add("warn", sid, `${a} はそのサービスのすべての操作を許可します。必要な操作だけに絞ってください。`, `${a} allows every action of that service. Narrow it to the actions you need.`);
    if (notActions.length) add("warn", sid, "Allow と NotAction の組み合わせは、列挙した以外のすべての操作を許可します。意図したものか確認してください。", "Allow with NotAction allows everything except the listed actions. Confirm that is intended.");
    if (res.includes("*") && !actions.includes("*")) add("warn", sid, "Resource \"*\" はすべてのリソースを対象にします。ARNで絞れないか確認してください。", "Resource \"*\" targets every resource. See whether you can restrict it by ARN.");
    if (notRes.length) add("warn", sid, "Allow と NotResource の組み合わせは、列挙した以外のすべてのリソースを許可します。", "Allow with NotResource allows every resource except those listed.");
    if (actions.some((a) => a.toLowerCase() === "iam:passrole") && res.includes("*")) add("error", sid, "iam:PassRole を Resource \"*\" で許可すると権限昇格につながります。ロールのARNを指定してください。", "iam:PassRole on Resource \"*\" can lead to privilege escalation. Specify role ARNs.");
    if (actions.some((a) => /^iam:(create|attach|put|update)/i.test(a) || a === "iam:*" || a === "sts:AssumeRole") && res.includes("*")) add("warn", sid, "IAMの変更系操作を Resource \"*\" で許可しています。権限昇格の経路になりえます。", "IAM write actions on Resource \"*\" can be a privilege escalation path.");
    if (who.some((x) => x === "*" || x === "AWS:*") && !hasCondition) add("error", sid, "Principal \"*\" に条件なしで許可しており、誰でも（匿名を含む）アクセスできます。", "Principal \"*\" is allowed without a condition, so anyone (including anonymous users) can access.");
    if (s.NotPrincipal !== undefined) add("warn", sid, "NotPrincipal は挙動が分かりにくく、非推奨です。", "NotPrincipal is hard to reason about and discouraged.");
    if (actions.some((a) => /^s3:(\*|putbucketpolicy|putbucketacl|putobjectacl)$/i.test(a)) && !hasCondition) add("warn", sid, "S3のポリシー・ACL変更を含む操作です。公開設定の変更に注意してください。", "Includes S3 policy/ACL changes. Be careful about changes that make data public.");
  });
  if (!findings.length) add("info", "-", "目立った問題は見つかりませんでした。", "No obvious problems found.");
  return { statements, findings };
}
