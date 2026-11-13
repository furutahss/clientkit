import { decodeEntities, escapeAttr } from "./xml";

export type EscapeKind = "js" | "json" | "html" | "xml" | "sql" | "shell" | "regex" | "csv" | "url-component";
export const ESCAPE_KINDS: EscapeKind[] = ["js", "json", "html", "xml", "sql", "shell", "regex", "csv", "url-component"];

const js = (s: string) => s.replace(/[\\'"`\n\r\t\b\f\v\u2028\u2029]|[\u0000-\u001f]/g, (c) => ({ "\\": "\\\\", "'": "\\'", '"': '\\"', "`": "\\`", "\n": "\\n", "\r": "\\r", "\t": "\\t", "\b": "\\b", "\f": "\\f", "\v": "\\v", "\u2028": "\\u2028", "\u2029": "\\u2029" })[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

export function escapeText(kind: EscapeKind, s: string): string {
  switch (kind) {
    case "js": return js(s);
    case "json": return JSON.stringify(s).slice(1, -1);
    case "html": return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
    case "xml": return escapeAttr(s).replace(/'/g, "&apos;");
    case "sql": return s.replace(/'/g, "''");
    case "shell": return `'${s.replace(/'/g, `'\\''`)}'`;
    case "regex": return s.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&");
    case "csv": return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    case "url-component": return encodeURIComponent(s);
  }
}

const NAMED: Record<string, string> = { nbsp: "\u00a0", copy: "©", reg: "®", trade: "™", hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»", yen: "¥", euro: "€", pound: "£", times: "×", divide: "÷", deg: "°", plusmn: "±" };

export function unescapeText(kind: EscapeKind, s: string): string {
  switch (kind) {
    case "js":
      return s.replace(/\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([\s\S]))/g, (_m, cp: string, u: string, x: string, c: string) => {
        if (cp) return String.fromCodePoint(parseInt(cp, 16));
        if (u) return String.fromCharCode(parseInt(u, 16));
        if (x) return String.fromCharCode(parseInt(x, 16));
        return ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0" } as Record<string, string>)[c] ?? c;
      });
    case "json": return JSON.parse(`"${s.replace(/(?<!\\)"/g, '\\"')}"`);
    case "html": case "xml": return decodeEntities(s).replace(/&([a-z]+);/gi, (m, n: string) => NAMED[n] ?? m);
    case "sql": return s.replace(/''/g, "'");
    case "shell": return s.replace(/^'|'$/g, "").replace(/'\\''/g, "'");
    case "regex": return s.replace(/\\([\s\S])/g, "$1");
    case "csv": return /^"[\s\S]*"$/.test(s) ? s.slice(1, -1).replace(/""/g, '"') : s;
    case "url-component": return decodeURIComponent(s);
  }
}
