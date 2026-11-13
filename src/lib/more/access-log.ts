import { countBy } from "./util";

export type LogEntry = { ip: string; time: string; method: string; path: string; status: number; bytes: number; seconds: number | null; agent: string };

const COMBINED = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) (\d+|-)(?: "[^"]*" "([^"]*)")?(?: (\d+(?:\.\d+)?))?\s*$/;
const ALB = /^(?:https?|h2|grpcs?|wss?) (\S+) \S+ (\S+?):\d+ \S+ (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (\d{3}|-) \S+ (\d+) (\d+) "(\S+) (\S+) [^"]*"(?: "([^"]*)")?/;

export function parseLogLine(line: string): LogEntry | null {
  let m = COMBINED.exec(line);
  if (m) return { ip: m[1], time: m[2], method: m[3], path: m[4], status: Number(m[5]), bytes: m[6] === "-" ? 0 : Number(m[6]), seconds: m[8] === undefined ? null : Number(m[8]), agent: m[7] ?? "" };
  m = ALB.exec(line);
  if (m) {
    const times = [m[3], m[4], m[5]].map(Number);
    return { ip: m[2], time: m[1], method: m[9], path: m[10].replace(/^https?:\/\/[^/]+/, ""), status: m[6] === "-" ? 0 : Number(m[6]), bytes: Number(m[8]), seconds: times.every((x) => x >= 0) ? times.reduce((a, b) => a + b, 0) : null, agent: m[11] ?? "" };
  }
  return null;
}

export function analyzeAccessLog(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const entries: LogEntry[] = [];
  let failed = 0;
  for (const l of lines) { const e = parseLogLine(l); if (e) entries.push(e); else failed++; }
  const pathOf = (e: LogEntry) => e.path.split("?")[0];
  const klass = (s: number) => (s ? `${Math.floor(s / 100)}xx` : "-");
  return {
    total: lines.length,
    parsed: entries.length,
    failed,
    statuses: countBy(entries, (e) => klass(e.status)),
    topPaths: countBy(entries, pathOf).slice(0, 10),
    topIps: countBy(entries, (e) => e.ip).slice(0, 10),
    errorPaths: countBy(entries.filter((e) => e.status >= 500), (e) => `${e.status} ${pathOf(e)}`).slice(0, 10),
    notFound: countBy(entries.filter((e) => e.status === 404), pathOf).slice(0, 10),
    slowest: entries.filter((e) => e.seconds !== null).sort((a, b) => b.seconds! - a.seconds!).slice(0, 10),
    bytes: entries.reduce((n, e) => n + e.bytes, 0),
    first: entries[0]?.time ?? "",
    last: entries[entries.length - 1]?.time ?? "",
  };
}
