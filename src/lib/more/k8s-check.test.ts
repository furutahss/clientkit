import { describe, expect, it } from "vitest";

import { checkManifests, decodeSecrets, describeResource, parseManifests } from "./k8s-check";

const en = (_: string, e: string) => e;
const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata: { name: web, namespace: prod }
spec:
  selector: { matchLabels: { app: web } }
  template:
    metadata: { labels: { app: webapp } }
    spec:
      hostNetwork: true
      containers:
        - name: app
          image: nginx
          env: [{ name: DB_PASSWORD, value: hunter2 }]
          securityContext: { privileged: true }
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata: { name: old }
spec: {}
---
apiVersion: v1
kind: Secret
metadata: { name: creds }
data: { user: YWRtaW4= }
`;

describe("Kubernetesマニフェスト", () => {
  const { resources, errors } = parseManifests(yaml);
  it("複数ドキュメントを解析する", () => {
    expect(errors).toEqual([]);
    expect(resources.map((r) => describeResource(r))).toEqual([{ kind: "Deployment", name: "web", namespace: "prod", apiVersion: "apps/v1" }, { kind: "Ingress", name: "old", namespace: "", apiVersion: "extensions/v1beta1" }, { kind: "Secret", name: "creds", namespace: "", apiVersion: "v1" }]);
  });

  it("よくある問題を検出する", () => {
    const f = checkManifests(resources, en);
    const by = (k: string) => f.filter((x) => x.resource === k).map((x) => x.message).join("|");
    const web = by("Deployment/web");
    for (const k of ["does not match the Pod template labels", "hostNetwork", "uses :latest", "resources.limits", "privileged: true", "env DB_PASSWORD", "single point of failure"]) expect(web).toContain(k);
    expect(f.find((x) => x.resource === "Ingress/old" && x.level === "error")?.message).toContain("networking.k8s.io/v1");
    expect(by("Secret/creds")).toContain("Base64");
  });

  it("Secretをデコードし、不正なYAMLを報告する", () => {
    expect(decodeSecrets(resources)).toEqual([{ secret: "creds", key: "user", value: "admin" }]);
    expect(parseManifests("a: [").errors).toHaveLength(1);
    expect(checkManifests([{ apiVersion: "v1", kind: "ConfigMap", metadata: { name: "x" } }], en)[0].message).toBe("No obvious problems found.");
  });
});
