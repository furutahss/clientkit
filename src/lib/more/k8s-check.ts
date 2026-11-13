import { parseAllDocuments } from "yaml";

import type { T } from "./types";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
export type K8sFinding = { level: "error" | "warn" | "info"; resource: string; message: string };
export type K8sResource = { kind: string; name: string; namespace: string; apiVersion: string };

const REMOVED: Record<string, string> = {
  "extensions/v1beta1": "apps/v1・networking.k8s.io/v1",
  "apps/v1beta1": "apps/v1", "apps/v1beta2": "apps/v1",
  "batch/v1beta1": "batch/v1（CronJob は1.25で削除）",
  "networking.k8s.io/v1beta1": "networking.k8s.io/v1",
  "policy/v1beta1": "policy/v1（PodSecurityPolicy は1.25で削除）",
  "rbac.authorization.k8s.io/v1beta1": "rbac.authorization.k8s.io/v1",
  "autoscaling/v2beta1": "autoscaling/v2", "autoscaling/v2beta2": "autoscaling/v2",
  "admissionregistration.k8s.io/v1beta1": "admissionregistration.k8s.io/v1",
  "apiextensions.k8s.io/v1beta1": "apiextensions.k8s.io/v1",
  "storage.k8s.io/v1beta1": "storage.k8s.io/v1",
  "certificates.k8s.io/v1beta1": "certificates.k8s.io/v1",
};

export function parseManifests(text: string): { resources: Obj[]; errors: string[] } {
  const resources: Obj[] = [], errors: string[] = [];
  for (const d of parseAllDocuments(text)) {
    if (d.errors.length) { errors.push(d.errors[0].message); continue; }
    const v = d.toJS();
    if (isObj(v)) { if (v.kind === "List" && Array.isArray(v.items)) resources.push(...v.items.filter(isObj)); else resources.push(v); }
  }
  return { resources, errors };
}

export const describeResource = (r: Obj): K8sResource => ({ kind: String(r.kind ?? "?"), name: String((r.metadata as Obj | undefined)?.name ?? "?"), namespace: String((r.metadata as Obj | undefined)?.namespace ?? ""), apiVersion: String(r.apiVersion ?? "?") });

const podSpecOf = (r: Obj): { spec: Obj; labels: Obj } | null => {
  const spec = r.spec as Obj | undefined;
  if (!isObj(spec)) return null;
  if (r.kind === "Pod") return { spec, labels: ((r.metadata as Obj)?.labels as Obj) ?? {} };
  const tpl = (r.kind === "CronJob" ? ((spec.jobTemplate as Obj)?.spec as Obj)?.template : spec.template) as Obj | undefined;
  return isObj(tpl) && isObj(tpl.spec) ? { spec: tpl.spec as Obj, labels: ((tpl.metadata as Obj)?.labels as Obj) ?? {} } : null;
};

export function checkManifests(resources: Obj[], t: T): K8sFinding[] {
  const f: K8sFinding[] = [];
  for (const r of resources) {
    const d = describeResource(r);
    const id = `${d.kind}/${d.name}`;
    const add = (level: K8sFinding["level"], ja: string, en: string) => f.push({ level, resource: id, message: t(ja, en) });
    if (REMOVED[d.apiVersion]) add("error", `apiVersion ${d.apiVersion} は新しいクラスターでは削除されています。${REMOVED[d.apiVersion]} を使ってください。`, `apiVersion ${d.apiVersion} has been removed in newer clusters. Use ${REMOVED[d.apiVersion]}.`);
    const pod = podSpecOf(r);
    if (pod) {
      const { spec } = pod;
      if (spec.hostNetwork === true) add("warn", "hostNetwork: true はホストのネットワークを共有します。", "hostNetwork: true shares the host network.");
      if (spec.hostPID === true || spec.hostIPC === true) add("warn", "hostPID / hostIPC はホストのプロセス・IPCを共有します。", "hostPID / hostIPC share the host's processes or IPC.");
      const podSec = (spec.securityContext as Obj) ?? {};
      for (const c of [...((spec.containers as Obj[]) ?? []), ...((spec.initContainers as Obj[]) ?? [])]) {
        const cn = String(c.name ?? "?");
        const image = String(c.image ?? "");
        const tag = image.includes("@sha256:") ? "digest" : /:([^/:]+)$/.exec(image)?.[1];
        if (!image) add("error", `コンテナ ${cn}: image がありません。`, `Container ${cn}: image is missing.`);
        else if (!tag || tag === "latest") add("warn", `コンテナ ${cn}: イメージ ${image} が :latest（またはタグなし）です。バージョンを固定してください。`, `Container ${cn}: image ${image} uses :latest (or no tag). Pin a version.`);
        const res = (c.resources as Obj) ?? {};
        if (!isObj(res.limits)) add("warn", `コンテナ ${cn}: resources.limits がありません。`, `Container ${cn}: resources.limits is not set.`);
        if (!isObj(res.requests)) add("info", `コンテナ ${cn}: resources.requests がありません（スケジューリングの目安になります）。`, `Container ${cn}: resources.requests is not set (used for scheduling).`);
        const sc = (c.securityContext as Obj) ?? {};
        if (sc.privileged === true) add("error", `コンテナ ${cn}: privileged: true はホストの全権限を与えます。`, `Container ${cn}: privileged: true grants full host privileges.`);
        if (sc.allowPrivilegeEscalation !== false) add("info", `コンテナ ${cn}: allowPrivilegeEscalation: false を推奨します。`, `Container ${cn}: allowPrivilegeEscalation: false is recommended.`);
        if (sc.runAsNonRoot !== true && podSec.runAsNonRoot !== true && sc.runAsUser === undefined) add("info", `コンテナ ${cn}: runAsNonRoot: true を推奨します（rootで動く可能性があります）。`, `Container ${cn}: runAsNonRoot: true is recommended (it may run as root).`);
        if (sc.readOnlyRootFilesystem !== true) add("info", `コンテナ ${cn}: readOnlyRootFilesystem: true を検討してください。`, `Container ${cn}: consider readOnlyRootFilesystem: true.`);
        if (r.kind !== "Job" && r.kind !== "CronJob" && !c.livenessProbe && !c.readinessProbe) add("info", `コンテナ ${cn}: livenessProbe / readinessProbe がありません。`, `Container ${cn}: no livenessProbe / readinessProbe.`);
        for (const e of (c.env as Obj[]) ?? []) if (typeof e.value === "string" && /(password|secret|token|api[_-]?key)/i.test(String(e.name)) && e.value) add("warn", `コンテナ ${cn}: 環境変数 ${e.name} に機密値が直接書かれています。Secretを参照してください。`, `Container ${cn}: env ${e.name} holds a secret value inline. Reference a Secret instead.`);
      }
    }
    const spec = (r.spec as Obj) ?? {};
    if (["Deployment", "StatefulSet", "DaemonSet"].includes(d.kind) && isObj(spec.selector)) {
      const match = ((spec.selector as Obj).matchLabels as Obj) ?? {};
      const labels = pod?.labels ?? {};
      const bad = Object.entries(match).filter(([k, v]) => labels[k] !== v);
      if (bad.length) add("error", `selector.matchLabels（${bad.map(([k, v]) => `${k}=${v}`).join(", ")}）が Pod テンプレートのラベルと一致しません。`, `selector.matchLabels (${bad.map(([k, v]) => `${k}=${v}`).join(", ")}) does not match the Pod template labels.`);
    }
    if (d.kind === "Deployment" && (spec.replicas === 1 || spec.replicas === undefined)) add("info", "replicas が1（または未指定）です。単一障害点になります。", "replicas is 1 (or unset), which is a single point of failure.");
    if (d.kind === "Service" && spec.type === "LoadBalancer") add("info", "type: LoadBalancer は外部公開します。クラウドのロードバランサー費用がかかります。", "type: LoadBalancer exposes the service externally and incurs cloud load balancer costs.");
    if (d.kind === "Ingress" && !Array.isArray(spec.tls)) add("info", "Ingress に tls がありません（HTTPSなし）。", "The Ingress has no tls section (no HTTPS).");
    if (d.kind === "Secret" && isObj(r.data)) add("info", "Secret の data は暗号化ではなく Base64 です。リポジトリにコミットしないでください。", "Secret data is Base64, not encryption. Do not commit it to a repository.");
    if (!(r.metadata as Obj | undefined)?.name && d.kind !== "List") add("error", "metadata.name がありません。", "metadata.name is missing.");
  }
  if (!f.length) f.push({ level: "info", resource: "-", message: t("目立った問題は見つかりませんでした。", "No obvious problems found.") });
  return f;
}

export function decodeSecrets(resources: Obj[]): { secret: string; key: string; value: string }[] {
  const out: { secret: string; key: string; value: string }[] = [];
  for (const r of resources) {
    if (r.kind !== "Secret") continue;
    const name = describeResource(r).name;
    for (const [k, v] of Object.entries(isObj(r.data) ? r.data : {})) { try { out.push({ secret: name, key: k, value: new TextDecoder().decode(Uint8Array.from(atob(String(v)), (c) => c.charCodeAt(0))) }); } catch { out.push({ secret: name, key: k, value: "(invalid base64)" }); } }
    for (const [k, v] of Object.entries(isObj(r.stringData) ? r.stringData : {})) out.push({ secret: name, key: k, value: String(v) });
  }
  return out;
}
