import { base64ToBytes } from "./util";

export type Hop = { index: number; from: string; by: string; with: string; date: Date | null; delaySec: number | null };

/** 折り返しを解除してヘッダー（名前・値）の一覧にする。本文は無視する */
export function parseMailHeaders(raw: string): { name: string; value: string }[] {
  const head = raw.split(/\r?\n\r?\n/)[0];
  const out: { name: string; value: string }[] = [];
  for (const line of head.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1].value += " " + line.trim();
    else { const i = line.indexOf(":"); if (i > 0) out.push({ name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() }); }
  }
  return out;
}

/** RFC 2047（=?UTF-8?B?...?= / =?UTF-8?Q?...?=）のデコード */
export function decodeMimeWords(s: string): string {
  return s.replace(/=\?([\w-]+)\?([BbQq])\?([^?]*)\?=(\s+(?==\?))?/g, (_m, cs: string, enc: string, body: string) => {
    try {
      let bytes: Uint8Array | null;
      if (enc.toLowerCase() === "b") bytes = base64ToBytes(body);
      else bytes = Uint8Array.from(body.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_x, h: string) => String.fromCharCode(parseInt(h, 16))), (c) => c.charCodeAt(0));
      return bytes ? new TextDecoder(cs).decode(bytes) : _m;
    } catch { return _m; }
  });
}

export function parseReceived(headers: { name: string; value: string }[]): Hop[] {
  const rec = headers.filter((h) => h.name.toLowerCase() === "received").reverse(); // 古い順
  let prev: Date | null = null;
  return rec.map((h, i) => {
    const semi = h.value.lastIndexOf(";");
    const d = semi >= 0 ? new Date(h.value.slice(semi + 1).trim().replace(/\s*\(.*\)$/, "")) : null;
    const date = d && !Number.isNaN(d.getTime()) ? d : null;
    const delaySec = date && prev ? Math.round((date.getTime() - prev.getTime()) / 1000) : null;
    if (date) prev = date;
    const pick = (re: RegExp) => re.exec(h.value)?.[1] ?? "";
    return { index: i + 1, from: pick(/\bfrom\s+(\S+(?:\s+\([^)]*\))?)/i), by: pick(/\bby\s+(\S+)/i), with: pick(/\bwith\s+(\S+)/i), date, delaySec };
  });
}

export function authResults(headers: { name: string; value: string }[]): { method: string; result: string }[] {
  const v = headers.filter((h) => h.name.toLowerCase() === "authentication-results").map((h) => h.value).join(" ");
  return [...v.matchAll(/\b(spf|dkim|dmarc|arc|compauth)=(\w+)/gi)].map((m) => ({ method: m[1].toLowerCase(), result: m[2].toLowerCase() }));
}

export const domainOf = (addr: string) => /@([^\s>;]+)/.exec(addr)?.[1]?.toLowerCase() ?? "";
