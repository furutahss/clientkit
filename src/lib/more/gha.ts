import { parse } from "yaml";

import type { T } from "./types";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export type Trigger = { event: string; detail: string };
export type Job = { id: string; name: string; runsOn: string; needs: string[]; steps: number; uses: string[]; timeout: string };
export type GhaFinding = { level: "error" | "warn" | "info"; target: string; message: string };

const INJECTABLE = /\$\{\{\s*github\.(event\.(issue\.(title|body)|pull_request\.(title|body|head\.(ref|label|repo\.full_name))|comment\.body|review\.body|review_comment\.body|head_commit\.(message|author\.(email|name))|commits[^}]*message|pages[^}]*page_name|discussion\.(title|body))|head_ref)\s*\}\}/;

/** UTC の cron を JST（+9時間）の時刻に直す。時・分が数値のときだけ */
export function cronToJst(cron: string): string {
  const [min, hour, ...rest] = cron.trim().split(/\s+/);
  if (!/^\d+$/.test(min) || !/^\d+$/.test(hour) || rest.length < 3) return "";
  const total = (Number(hour) * 60 + Number(min) + 9 * 60) % (24 * 60);
  const dayShift = Number(hour) * 60 + Number(min) + 9 * 60 >= 24 * 60;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")} JST${dayShift ? " (+1 day)" : ""}`;
}

export function analyzeWorkflow(text: string, t: T) {
  const doc = parse(text) as Obj;
  if (!isObj(doc) || !isObj(doc.jobs)) throw new Error("not-workflow");
  const triggers: Trigger[] = [];
  const on = doc.on ?? (doc as Obj).true; // YAML 1.1 では on が true になることがある
  const events = typeof on === "string" ? { [on]: null } : Array.isArray(on) ? Object.fromEntries(on.map((e) => [String(e), null])) : isObj(on) ? on : {};
  for (const [event, cfg] of Object.entries(events)) {
    let detail = "";
    if (event === "schedule" && Array.isArray(cfg)) detail = cfg.map((c) => { const cr = String((c as Obj).cron); const j = cronToJst(cr); return `${cr}${j ? ` (= ${j})` : ""}`; }).join("\n");
    else if (isObj(cfg)) detail = Object.entries(cfg).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : JSON.stringify(v)}`).join("\n");
    triggers.push({ event, detail });
  }
  const jobs: Job[] = [];
  const findings: GhaFinding[] = [];
  const add = (level: GhaFinding["level"], target: string, ja: string, en: string) => findings.push({ level, target, message: t(ja, en) });
  const hasWorkflowPerms = doc.permissions !== undefined;
  for (const [id, j] of Object.entries(doc.jobs)) {
    if (!isObj(j)) continue;
    const steps = Array.isArray(j.steps) ? (j.steps as Obj[]) : [];
    const uses = [...(typeof j.uses === "string" ? [j.uses] : []), ...steps.map((s) => s.uses).filter((u): u is string => typeof u === "string")];
    jobs.push({ id, name: String(j.name ?? id), runsOn: Array.isArray(j["runs-on"]) ? j["runs-on"].join(", ") : isObj(j["runs-on"]) ? JSON.stringify(j["runs-on"]) : String(j["runs-on"] ?? (typeof j.uses === "string" ? "(reusable workflow)" : "?")), needs: ([] as unknown[]).concat(j.needs ?? []).map(String), steps: steps.length, uses, timeout: String(j["timeout-minutes"] ?? "") });
    if (!hasWorkflowPerms && j.permissions === undefined) add("info", id, "permissions が未指定です。既定のGITHUB_TOKEN権限が広い場合があるため、最小権限を明示してください。", "permissions is not set. The default GITHUB_TOKEN permissions may be broad; set the least privilege explicitly.");
    if (j["timeout-minutes"] === undefined && typeof j.uses !== "string") add("info", id, "timeout-minutes が未指定です（既定は360分）。", "timeout-minutes is not set (the default is 360 minutes).");
    if (j.secrets === "inherit") add("warn", id, "secrets: inherit は呼び出し元のすべてのシークレットを渡します。", "secrets: inherit passes every secret of the caller.");
    for (const u of uses) {
      if (u.startsWith("./") || u.startsWith("docker://")) continue;
      const ref = u.split("@")[1];
      if (!ref) add("error", id, `${u}: バージョン（@ref）がありません。`, `${u}: no version (@ref).`);
      else if (/^[0-9a-f]{40}$/i.test(ref)) continue;
      else if (/^(main|master|develop|dev|trunk|latest)$/i.test(ref)) add("warn", id, `${u}: ブランチ指定です。内容が予告なく変わります。タグか、コミットSHAで固定してください。`, `${u}: pinned to a branch, which can change without notice. Pin to a tag or commit SHA.`);
      else if (!/^actions\//.test(u)) add("info", id, `${u}: サードパーティのアクションをコミットSHAで固定すると、改ざんの影響を受けません。`, `${u}: pin third-party actions to a commit SHA to be safe from tampering.`);
    }
    steps.forEach((s, i) => {
      const run = typeof s.run === "string" ? s.run : "";
      if (INJECTABLE.test(run)) add("error", `${id}#${i + 1}`, "run 内で、外部から制御できる値（issueのタイトル・PRのブランチ名など）を ${{ }} で直接展開しています。スクリプトインジェクションの危険があるため、env 経由で渡してください。", "A run script expands an attacker-controllable value (issue title, PR branch name, …) with ${{ }}. This allows script injection; pass it through env instead.");
      if (/curl[^|\n]*\|\s*(sudo\s+)?(ba)?sh/.test(run)) add("warn", `${id}#${i + 1}`, "curl | sh でスクリプトを直接実行しています。", "Runs a script piped straight from curl.");
    });
  }
  if ("pull_request_target" in events) {
    const checksOutHead = JSON.stringify(doc.jobs).match(/github\.event\.pull_request\.head\.(sha|ref)|github\.head_ref/);
    add(checksOutHead ? "error" : "warn", "pull_request_target", checksOutHead ? "pull_request_target でPRのコードをチェックアウトしています。シークレットが奪われる危険があります。" : "pull_request_target は、リポジトリのシークレットを持つ権限で実行されます。PRのコードを実行しないでください。", checksOutHead ? "pull_request_target checks out the PR's code, which can leak secrets." : "pull_request_target runs with repository secrets. Do not run the PR's code.");
  }
  const mermaid = ["graph LR", ...jobs.map((j) => `  ${j.id.replace(/\W/g, "_")}["${j.name.replace(/"/g, "'")}"]`), ...jobs.flatMap((j) => j.needs.map((n) => `  ${n.replace(/\W/g, "_")} --> ${j.id.replace(/\W/g, "_")}`))].join("\n");
  return { name: String(doc.name ?? ""), triggers, jobs, findings, mermaid };
}
