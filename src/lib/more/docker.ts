import { parse, stringify } from "yaml";

type Obj = Record<string, unknown>;

/** シェル風にトークン分割する（クォート・バックスラッシュ・行継続に対応。変数展開はしない） */
export function shellSplit(cmd: string): string[] {
  const out: string[] = [];
  let cur = "", has = false, quote = "";
  const s = cmd.replace(/\\\r?\n/g, " ");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === quote) quote = ""; else if (c === "\\" && quote === '"' && /["\\$`]/.test(s[i + 1] ?? "")) cur += s[++i]; else cur += c; continue; }
    if (c === "'" || c === '"') { quote = c; has = true; continue; }
    if (c === "\\" && i + 1 < s.length) { cur += s[++i]; has = true; continue; }
    if (/\s/.test(c)) { if (has || cur) { out.push(cur); cur = ""; has = false; } continue; }
    cur += c; has = true;
  }
  if (quote) throw new Error("unterminated quote");
  if (has || cur) out.push(cur);
  return out;
}

export type RunSpec = { image: string; command: string[]; name?: string; ports: string[]; volumes: string[]; env: string[]; envFile: string[]; restart?: string; network?: string; workdir?: string; user?: string; entrypoint?: string; hostname?: string; privileged?: boolean; capAdd: string[]; labels: string[]; memory?: string; cpus?: string; tty?: boolean; stdin?: boolean; healthCmd?: string; extraHosts: string[]; unsupported: string[] };

const WITH_VALUE: Record<string, keyof RunSpec | "ignore"> = { "-p": "ports", "--publish": "ports", "-v": "volumes", "--volume": "volumes", "-e": "env", "--env": "env", "--env-file": "envFile", "--name": "name", "--restart": "restart", "--network": "network", "--net": "network", "-w": "workdir", "--workdir": "workdir", "-u": "user", "--user": "user", "--entrypoint": "entrypoint", "-h": "hostname", "--hostname": "hostname", "--cap-add": "capAdd", "-l": "labels", "--label": "labels", "-m": "memory", "--memory": "memory", "--cpus": "cpus", "--health-cmd": "healthCmd", "--add-host": "extraHosts" };
const FLAGS = new Set(["-d", "--detach", "--rm", "-it", "-i", "-t", "--interactive", "--tty", "--privileged", "--init", "--read-only", "-P"]);

export function parseDockerRun(cmd: string): RunSpec {
  let tokens = shellSplit(cmd.trim());
  if (tokens[0] === "sudo") tokens = tokens.slice(1);
  if (tokens[0] === "docker") tokens = tokens.slice(1);
  if (tokens[0] === "container") tokens = tokens.slice(1);
  if (tokens[0] !== "run" && tokens[0] !== "create") throw new Error("not-docker-run");
  tokens = tokens.slice(1);
  const spec: RunSpec = { image: "", command: [], ports: [], volumes: [], env: [], envFile: [], capAdd: [], labels: [], extraHosts: [], unsupported: [] };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (spec.image) { spec.command.push(t); continue; }
    if (!t.startsWith("-")) { spec.image = t; continue; }
    let flag = t, value: string | undefined;
    const eq = /^(--[\w-]+)=([\s\S]*)$/.exec(t);
    if (eq) { flag = eq[1]; value = eq[2]; }
    else if (/^-[pvewuhlm][^-]/.test(t) && !t.startsWith("--")) { flag = t.slice(0, 2); value = t.slice(2); }
    if (flag in WITH_VALUE) {
      value ??= tokens[++i];
      if (value === undefined) throw new Error(`missing-value:${flag}`);
      const key = WITH_VALUE[flag] as keyof RunSpec;
      const cur = spec[key];
      if (Array.isArray(cur)) (cur as string[]).push(value); else (spec as unknown as Record<string, unknown>)[key] = value;
    } else if (FLAGS.has(flag)) {
      if (flag === "-it" || flag === "-t" || flag === "--tty") spec.tty = true;
      if (flag === "-it" || flag === "-i" || flag === "--interactive") spec.stdin = true;
      if (flag === "--privileged") spec.privileged = true;
      if (flag === "-P" || flag === "--read-only" || flag === "--init") spec.unsupported.push(flag);
    } else {
      spec.unsupported.push(value !== undefined && eq ? `${flag}=${value}` : flag);
      if (!eq && tokens[i + 1] && !tokens[i + 1].startsWith("-") && tokens[i + 1] !== undefined && /^(--(?:log-driver|log-opt|ulimit|device|dns|tmpfs|shm-size|memory-swap|pid|ipc|security-opt|cap-drop|gpus|platform|pull|runtime|stop-signal|stop-timeout|sysctl|group-add|mount|volumes-from|link|expose|health-\w+|cpu-\w+|oom-\w+|blkio-\w+|detach-keys|domainname|mac-address|isolation))$/.test(flag)) i++;
    }
  }
  if (!spec.image) throw new Error("no-image");
  return spec;
}

export function runToCompose(spec: RunSpec, serviceName?: string): string {
  const name = serviceName || spec.name || spec.image.split("/").pop()!.split(":")[0].replace(/[^a-zA-Z0-9_.-]/g, "-");
  const svc: Obj = { image: spec.image };
  if (spec.name) svc.container_name = spec.name;
  if (spec.command.length) svc.command = spec.command;
  if (spec.entrypoint) svc.entrypoint = spec.entrypoint;
  if (spec.ports.length) svc.ports = spec.ports;
  if (spec.volumes.length) svc.volumes = spec.volumes;
  if (spec.env.length) svc.environment = spec.env;
  if (spec.envFile.length) svc.env_file = spec.envFile;
  if (spec.restart) svc.restart = spec.restart;
  if (spec.network) svc.network_mode = ["host", "none", "bridge"].includes(spec.network) ? spec.network : undefined;
  if (spec.network && !svc.network_mode) svc.networks = [spec.network];
  if (spec.workdir) svc.working_dir = spec.workdir;
  if (spec.user) svc.user = spec.user;
  if (spec.hostname) svc.hostname = spec.hostname;
  if (spec.privileged) svc.privileged = true;
  if (spec.capAdd.length) svc.cap_add = spec.capAdd;
  if (spec.labels.length) svc.labels = spec.labels;
  if (spec.memory) svc.mem_limit = spec.memory;
  if (spec.cpus) svc.cpus = Number(spec.cpus);
  if (spec.tty) svc.tty = true;
  if (spec.stdin) svc.stdin_open = true;
  if (spec.extraHosts.length) svc.extra_hosts = spec.extraHosts;
  if (spec.healthCmd) svc.healthcheck = { test: ["CMD-SHELL", spec.healthCmd] };
  const doc: Obj = { services: { [name]: svc } };
  const named = spec.volumes.map((v) => v.split(":")[0]).filter((v) => v && !/^[./~$]/.test(v) && !v.includes("/"));
  if (named.length) doc.volumes = Object.fromEntries([...new Set(named)].map((n) => [n, {}]));
  if (spec.network && !svc.network_mode) doc.networks = { [spec.network]: { external: true } };
  return stringify(doc, { lineWidth: 0 });
}

const q = (s: string) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

export function composeToRun(text: string): { service: string; command: string; notes: string[] }[] {
  const doc = parse(text) as Obj;
  if (!doc || typeof doc !== "object" || typeof doc.services !== "object" || !doc.services) throw new Error("not-compose");
  return Object.entries(doc.services as Record<string, Obj>).map(([service, s]) => {
    const notes: string[] = [];
    const lines = ["docker run -d"];
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v && typeof v === "object" ? Object.entries(v as Obj).map(([k, x]) => `${k}=${x ?? ""}`) : v === undefined ? [] : [String(v)]);
    lines.push(`  --name ${q(String(s.container_name ?? service))}`);
    for (const p of arr(s.ports)) lines.push(`  -p ${q(p)}`);
    for (const v of arr(s.volumes)) lines.push(`  -v ${q(v)}`);
    for (const e of arr(s.environment)) lines.push(`  -e ${q(e)}`);
    for (const e of arr(s.env_file)) lines.push(`  --env-file ${q(e)}`);
    if (s.restart) lines.push(`  --restart ${q(String(s.restart))}`);
    if (s.network_mode) lines.push(`  --network ${q(String(s.network_mode))}`);
    else if (Array.isArray(s.networks) || (s.networks && typeof s.networks === "object")) { const n = Array.isArray(s.networks) ? s.networks : Object.keys(s.networks as Obj); if (n[0]) lines.push(`  --network ${q(String(n[0]))}`); if (n.length > 1) notes.push("複数のネットワークは docker network connect で追加します。 / Connect extra networks with docker network connect.");}
    if (s.working_dir) lines.push(`  -w ${q(String(s.working_dir))}`);
    if (s.user) lines.push(`  -u ${q(String(s.user))}`);
    if (s.hostname) lines.push(`  -h ${q(String(s.hostname))}`);
    if (s.privileged) lines.push("  --privileged");
    for (const c of arr(s.cap_add)) lines.push(`  --cap-add ${q(c)}`);
    for (const l of arr(s.labels)) lines.push(`  -l ${q(l)}`);
    if (s.mem_limit) lines.push(`  -m ${q(String(s.mem_limit))}`);
    if (s.cpus) lines.push(`  --cpus ${q(String(s.cpus))}`);
    if (s.tty) lines.push("  -t");
    if (s.stdin_open) lines.push("  -i");
    for (const h of arr(s.extra_hosts)) lines.push(`  --add-host ${q(h)}`);
    if (s.entrypoint) lines.push(`  --entrypoint ${q(Array.isArray(s.entrypoint) ? s.entrypoint.join(" ") : String(s.entrypoint))}`);
    if (s.build) { notes.push("build は docker build で別にイメージを作る必要があります。 / build needs a separate docker build."); lines.push(`  ${q(String(s.image ?? `${service}:latest`))}`); } else lines.push(`  ${q(String(s.image ?? "<image>"))}`);
    if (s.command) lines.push(`  ${Array.isArray(s.command) ? s.command.map(String).map(q).join(" ") : String(s.command)}`);
    if (s.depends_on) notes.push("depends_on（起動順）は docker run では表現できません。 / depends_on (startup order) cannot be expressed with docker run.");
    return { service, command: lines.join(" \\\n"), notes };
  });
}
