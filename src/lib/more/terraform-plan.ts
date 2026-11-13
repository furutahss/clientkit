/** `terraform show -json <planfile>` の出力を、リソースごとの変更に要約する */
export type Action = "create" | "update" | "delete" | "replace" | "read" | "no-op" | "forget";
export type AttrChange = { path: string; before: string; after: string };
export type ResourceChange = { address: string; type: string; action: Action; changes: AttrChange[]; replaceReasons: string[]; sensitive: boolean };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const show = (v: unknown): string => (v === undefined ? "(none)" : v === null ? "null" : typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v));

function flatDiff(before: unknown, after: unknown, unknown_: unknown, sensB: unknown, sensA: unknown, path: string, out: AttrChange[]): void {
  if (unknown_ === true) { out.push({ path, before: sensB === true ? "(sensitive)" : show(before), after: "(known after apply)" }); return; }
  if (sensB === true || sensA === true) { if (JSON.stringify(before) !== JSON.stringify(after)) out.push({ path, before: "(sensitive)", after: "(sensitive)" }); return; }
  if (isObj(before) || isObj(after)) {
    const b = isObj(before) ? before : {}, a = isObj(after) ? after : {};
    if (!isObj(before) && before !== null && before !== undefined || !isObj(after) && after !== null && after !== undefined) { out.push({ path, before: show(before), after: show(after) }); return; }
    for (const k of new Set([...Object.keys(b), ...Object.keys(a), ...(isObj(unknown_) ? Object.keys(unknown_) : [])])) flatDiff(b[k], a[k], isObj(unknown_) ? unknown_[k] : undefined, isObj(sensB) ? sensB[k] : undefined, isObj(sensA) ? sensA[k] : undefined, path ? `${path}.${k}` : k, out);
    return;
  }
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length && before.some(isObj)) {
    before.forEach((x, i) => flatDiff(x, after[i], Array.isArray(unknown_) ? unknown_[i] : undefined, Array.isArray(sensB) ? sensB[i] : undefined, Array.isArray(sensA) ? sensA[i] : undefined, `${path}[${i}]`, out));
    return;
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) out.push({ path, before: show(before), after: show(after) });
}

export function summarizePlan(json: string): { changes: ResourceChange[]; counts: Record<Action, number>; outputs: number; terraformVersion: string } {
  const plan = JSON.parse(json) as Obj;
  if (!Array.isArray(plan.resource_changes) && !isObj(plan.planned_values)) throw new Error("not-plan");
  const counts: Record<Action, number> = { create: 0, update: 0, delete: 0, replace: 0, read: 0, "no-op": 0, forget: 0 };
  const changes: ResourceChange[] = [];
  for (const rc of (plan.resource_changes as Obj[]) ?? []) {
    const ch = (rc.change ?? {}) as Obj;
    const actions = (ch.actions as string[]) ?? [];
    const action: Action = actions.length === 2 ? "replace" : (actions[0] as Action) ?? "no-op";
    counts[action] = (counts[action] ?? 0) + 1;
    const attrs: AttrChange[] = [];
    if (action === "update" || action === "replace" || action === "create" || action === "delete") flatDiff(ch.before, ch.after, ch.after_unknown, ch.before_sensitive, ch.after_sensitive, "", attrs);
    const reasons = ((ch.replace_paths as unknown[][]) ?? []).map((p) => p.join("."));
    changes.push({ address: String(rc.address), type: String(rc.type), action, changes: attrs.filter((a) => a.path !== "" || action !== "update"), replaceReasons: reasons, sensitive: JSON.stringify(ch.after_sensitive ?? {}).includes("true") });
  }
  return { changes, counts, outputs: Object.keys((plan.output_changes as Obj) ?? {}).length, terraformVersion: String(plan.terraform_version ?? "") };
}

const ORDER: Action[] = ["delete", "replace", "update", "create", "read", "forget", "no-op"];
export const sortChanges = (c: ResourceChange[]) => [...c].sort((a, b) => ORDER.indexOf(a.action) - ORDER.indexOf(b.action) || a.address.localeCompare(b.address));
