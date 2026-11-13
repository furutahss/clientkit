import { parse as parseYaml } from "yaml";
import semver from "semver";

export type LockMap = Map<string, Set<string>>;
export type LockFormat = "npm" | "yarn1" | "yarn-berry" | "pnpm";

const add = (m: LockMap, name: string, version: string) => { if (!name || !version) return; (m.get(name) ?? m.set(name, new Set()).get(name)!).add(version); };

/** ロックファイルを「パッケージ名 → バージョン集合」にまとめる（npm / yarn classic / yarn berry / pnpm） */
export function readLockfile(text: string): { format: LockFormat; map: LockMap } {
  const map: LockMap = new Map();
  const t = text.trim();
  if (t.startsWith("{")) {
    const j = JSON.parse(t) as { packages?: Record<string, { version?: string; name?: string; link?: boolean }>; dependencies?: Record<string, unknown> };
    if (j.packages) {
      for (const [path, p] of Object.entries(j.packages)) {
        if (!path || p.link) continue;
        const name = p.name ?? path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
        if (p.version) add(map, name, p.version);
      }
    } else if (j.dependencies) {
      const walk = (deps: Record<string, unknown>) => { for (const [n, d] of Object.entries(deps)) { const dep = d as { version?: string; dependencies?: Record<string, unknown> }; if (dep.version && !/^(file|git|http|link):/.test(dep.version)) add(map, n, dep.version); if (dep.dependencies) walk(dep.dependencies); } };
      walk(j.dependencies);
    } else throw new Error("unrecognized lockfile");
    return { format: "npm", map };
  }
  if (/^# yarn lockfile v1/m.test(t) || (!/^__metadata:/m.test(t) && /^\S.*:\n\s+version "/m.test(t))) {
    let names: string[] = [];
    for (const line of t.split(/\r?\n/)) {
      if (!line.trim() || line.startsWith("#")) continue;
      if (!line.startsWith(" ")) names = line.replace(/:$/, "").split(",").map((s) => s.trim().replace(/^"|"$/g, "")).map((s) => s.slice(0, s.lastIndexOf("@")));
      else { const m = /^\s+version "?([^"\s]+)"?/.exec(line); if (m) for (const n of new Set(names)) add(map, n, m[1]); }
    }
    return { format: "yarn1", map };
  }
  const y = parseYaml(t) as Record<string, unknown>;
  if (y && typeof y === "object" && "__metadata" in y) {
    for (const [key, v] of Object.entries(y)) {
      if (key === "__metadata") continue;
      const version = (v as { version?: string }).version;
      for (const d of key.split(",")) { const desc = d.trim(); const at = desc.indexOf("@", 1); const name = desc.slice(0, at); if (!/@workspace:/.test(desc)) add(map, name, String(version)); }
    }
    return { format: "yarn-berry", map };
  }
  if (y && typeof y === "object" && "lockfileVersion" in y && ("packages" in y || "importers" in y)) {
    for (const key of Object.keys((y.packages as Record<string, unknown>) ?? {})) {
      // v5: /name/1.0.0、v6: /name@1.0.0、v9: name@1.0.0（peer情報の括弧は除去）
      const k = key.replace(/^\//, "").replace(/\(.*$/, "").replace(/_.*$/, "");
      const at = k.lastIndexOf("@");
      if (at > 0) add(map, k.slice(0, at), k.slice(at + 1));
      else { const slash = k.lastIndexOf("/"); if (slash > 0) add(map, k.slice(0, slash), k.slice(slash + 1)); }
    }
    return { format: "pnpm", map };
  }
  throw new Error("unrecognized lockfile");
}

export type Change = { name: string; kind: "added" | "removed" | "changed"; from: string[]; to: string[]; bump: string };

function bumpOf(from: string[], to: string[]): string {
  const f = from.map((v) => semver.valid(v)).filter((v): v is string => !!v).sort(semver.rcompare)[0];
  const t = to.map((v) => semver.valid(v)).filter((v): v is string => !!v).sort(semver.rcompare)[0];
  if (!f || !t) return "?";
  const d = semver.diff(f, t);
  if (!d) return "none";
  return semver.lt(t, f) ? `downgrade (${d})` : d;
}

export function diffLockfiles(a: LockMap, b: LockMap): Change[] {
  const out: Change[] = [];
  for (const name of new Set([...a.keys(), ...b.keys()])) {
    const from = [...(a.get(name) ?? [])].sort(semver.compare), to = [...(b.get(name) ?? [])].sort(semver.compare);
    if (!from.length) out.push({ name, kind: "added", from, to, bump: "" });
    else if (!to.length) out.push({ name, kind: "removed", from, to, bump: "" });
    else if (from.join() !== to.join()) out.push({ name, kind: "changed", from, to, bump: bumpOf(from, to) });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name));
}
