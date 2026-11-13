/** GraphQLクエリ・SDLの整形と、SDL→TypeScript型の生成（依存なしの簡易トークナイザー） */
type Tok = { t: "punct" | "name" | "string" | "block" | "num" | "var" | "comment" | "spread"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/[\s,﻿]/.test(c)) { i++; continue; }
    if (c === "#") { const e = src.indexOf("\n", i); const end = e < 0 ? src.length : e; out.push({ t: "comment", v: src.slice(i, end).trimEnd() }); i = end; continue; }
    if (src.startsWith('"""', i)) { const e = src.indexOf('"""', i + 3); if (e < 0) throw new Error("unterminated block string"); out.push({ t: "block", v: src.slice(i + 3, e) }); i = e + 3; continue; }
    if (c === '"') { let j = i + 1; while (j < src.length && src[j] !== '"') { if (src[j] === "\\") j++; j++; } if (j >= src.length) throw new Error("unterminated string"); out.push({ t: "string", v: src.slice(i, j + 1) }); i = j + 1; continue; }
    if (src.startsWith("...", i)) { out.push({ t: "spread", v: "..." }); i += 3; continue; }
    const m = /^(\$[A-Za-z_]\w*|[A-Za-z_]\w*|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(src.slice(i));
    if (m) { out.push({ t: m[0][0] === "$" ? "var" : /^[A-Za-z_]/.test(m[0]) ? "name" : "num", v: m[0] }); i += m[0].length; continue; }
    if ("{}()[]:=!@|&".includes(c)) { out.push({ t: "punct", v: c }); i++; continue; }
    throw new Error(`unexpected character "${c}"`);
  }
  return out;
}

const TOP = new Set(["query", "mutation", "subscription", "fragment", "type", "input", "enum", "interface", "union", "scalar", "directive", "schema", "extend"]);

export function formatGraphql(src: string, indent = "  "): string {
  const toks = tokenize(src);
  const lines: string[] = [];
  let cur = "";
  let depth = 0, paren = 0, bracket = 0, obj = 0;
  const flush = () => { if (cur.trim()) lines.push(cur.trimEnd()); cur = ""; };
  const pad = () => indent.repeat(depth);
  const inline = () => paren > 0 || bracket > 0;
  const complete = (t: Tok | null) => !!t && (["name", "string", "num", "var", "block"].includes(t.t) || (t.t === "punct" && ["!", "]", ")", "}"].includes(t.v)));
  let prev: Tok | null = null;
  let prev2: Tok | null = null;

  for (const tk of toks) {
    const isP = (v: string) => tk.t === "punct" && tk.v === v;
    if (tk.t === "comment") { if (cur.trim()) { cur += "  " + tk.v; flush(); } else { cur = pad() + tk.v; flush(); } }
    else if (tk.t === "block") {
      flush();
      const body = tk.v.replace(/^\n+|\s+$/g, "").split("\n").map((l) => l.replace(/^\s+/, ""));
      lines.push(`${pad()}"""`, ...body.map((l) => (l ? pad() + l : "")), `${pad()}"""`);
    } else if (isP("{") && inline()) { cur += (complete(prev) && prev?.t === "punct" && prev.v !== ")" ? ", " : prev?.t === "punct" && prev.v === ":" ? " " : "") + "{"; obj++; }
    else if (isP("}") && obj > 0) { cur += "}"; obj--; }
    else if (isP("{")) { cur += (cur.trim() ? " " : "") + "{"; flush(); depth++; }
    else if (isP("}")) { flush(); depth = Math.max(0, depth - 1); cur = pad() + "}"; flush(); }
    else if (isP("(")) { paren++; cur += "("; }
    else if (isP(")")) { paren = Math.max(0, paren - 1); cur += ")"; }
    else if (isP("[")) { if (!cur) cur = pad(); else if (prev?.t === "punct" && prev.v === ":") cur += " "; else if (inline() && complete(prev)) cur += ", "; bracket++; cur += "["; }
    else if (isP("]")) { bracket = Math.max(0, bracket - 1); cur += "]"; }
    else if (isP(":")) cur += ":";
    else if (isP("!")) cur += "!";
    else if (isP("=") || isP("|") || isP("&")) cur += ` ${tk.v} `;
    else if (isP("@")) cur += (cur && !cur.endsWith(" ") ? " " : cur ? "" : pad()) + "@";
    else {
      // name / string / num / var / spread
      const afterColon = prev?.t === "punct" && prev.v === ":";
      const afterAt = prev?.t === "punct" && prev.v === "@";
      const afterSpread = prev?.t === "spread";
      const onAfterSpread = prev?.t === "name" && prev.v === "on" && prev2?.t === "spread";
      const afterOperator = prev?.t === "punct" && ["=", "|", "&"].includes(prev.v);
      if (inline()) {
        if (afterColon) cur += " ";
        else if (complete(prev) && !afterOperator) cur += ", ";
      } else if (afterColon) cur += " ";
      else if (afterAt || afterOperator) { /* 直前の記号に続ける */ }
      else if (afterSpread) cur += tk.t === "name" && tk.v === "on" ? " " : "";
      else if (onAfterSpread) cur += " ";
      else if (depth > 0) { flush(); cur = pad(); }
      else if (TOP.has(tk.v) && !(prev?.t === "name" && prev.v === "extend")) { flush(); }
      else if (cur) cur += " ";
      if (!cur) cur = pad();
      cur += tk.v;
    }
    prev2 = prev;
    prev = tk;
  }
  flush();
  return lines.join("\n");
}

// ---- SDL → TypeScript ----
type TypeNode = { kind: "list"; of: TypeNode; nonNull: boolean } | { kind: "named"; name: string; nonNull: boolean };
const SCALARS: Record<string, string> = { ID: "string", String: "string", Int: "number", Float: "number", Boolean: "boolean" };

function tsType(r: TypeNode, refs: Set<string>): string {
  const base = r.kind === "list" ? `Array<${tsType(r.of, refs)}>` : SCALARS[r.name] ?? (refs.add(r.name), r.name);
  return r.nonNull ? base : `${base} | null`;
}

export function sdlToTypeScript(sdl: string): string {
  const toks = tokenize(sdl);
  let p = 0;
  const peek = () => toks[p];
  const name = () => { const t = toks[p++]; if (!t || t.t !== "name") throw new Error(`expected a name near "${t?.v ?? "end of input"}"`); return t.v; };
  const isP = (v: string) => peek()?.t === "punct" && peek().v === v;
  const out: string[] = [];
  const scalars = new Set<string>();
  const known = new Set<string>();
  const typeRef = (): TypeNode => {
    let r: TypeNode;
    if (isP("[")) { p++; const of = typeRef(); if (!isP("]")) throw new Error("expected ]"); p++; r = { kind: "list", of, nonNull: false }; }
    else r = { kind: "named", name: name(), nonNull: false };
    if (isP("!")) { p++; r.nonNull = true; }
    return r;
  };
  const skipDirectives = () => { while (isP("@")) { p++; name(); if (isP("(")) { let d = 0; do { if (isP("(")) d++; if (isP(")")) d--; p++; } while (d > 0 && p < toks.length); } } };
  const desc = (): string | null => { const t = peek(); if (t && (t.t === "block" || t.t === "string")) { p++; return t.t === "block" ? t.v.trim() : JSON.parse(t.v); } return null; };
  const doc = (d: string | null, pad = "") => (d ? `${pad}/** ${d.replace(/\*\//g, "*\\/").split("\n").join(`\n${pad} * `)} */\n` : "");
  const skipArgs = () => { if (isP("(")) { let d = 0; do { if (isP("(")) d++; if (isP(")")) d--; p++; } while (d > 0 && p < toks.length); } };
  const refs = new Set<string>();

  const fields = (isInput: boolean): string => {
    if (!isP("{")) return "";
    p++;
    const lines: string[] = [];
    while (!isP("}")) {
      if (p >= toks.length) throw new Error("unterminated type body");
      if (peek().t === "comment") { p++; continue; }
      const d = desc();
      const fname = name();
      skipArgs();
      if (!isP(":")) throw new Error(`expected ":" after ${fname}`);
      p++;
      const ty = typeRef();
      if (isInput && isP("=")) { p++; p++; while (isP("[") || isP("{")) p++; }
      skipDirectives();
      const opt = isInput && !ty.nonNull;
      lines.push(`${doc(d, "  ")}  ${fname}${opt ? "?" : ""}: ${tsType(ty, refs)};`);
    }
    p++;
    return lines.join("\n");
  };

  while (p < toks.length) {
    if (peek().t === "comment") { p++; continue; }
    const d = desc();
    let kw = name();
    if (kw === "extend") kw = name();
    if (kw === "schema" || kw === "directive") { // 使わない定義は読み飛ばす
      while (p < toks.length && !(isP("{") )) { if (peek().t === "name" && TOP.has(peek().v) && kw === "directive" && peek().v !== "on" && p > 0 && peek().v !== "directive") break; p++; if (kw === "directive" && (peek()?.t === "block" || (peek()?.t === "name" && TOP.has(peek().v) && peek().v !== "on" && toks[p - 1].t !== "punct"))) break; }
      if (isP("{")) { let dp = 0; do { if (isP("{")) dp++; if (isP("}")) dp--; p++; } while (dp > 0 && p < toks.length); }
      continue;
    }
    if (!["scalar", "enum", "union", "type", "interface", "input"].includes(kw)) throw new Error(`unsupported definition "${kw}"`);
    const n = name();
    known.add(n);
    if (kw === "scalar") { scalars.add(n); continue; }
    if (kw === "enum") {
      if (!isP("{")) throw new Error("expected {");
      p++;
      const values: string[] = [];
      while (!isP("}")) { if (p >= toks.length) throw new Error("unterminated enum"); if (peek().t === "comment") { p++; continue; } desc(); values.push(JSON.stringify(name())); skipDirectives(); }
      p++;
      out.push(`${doc(d)}export type ${n} = ${values.join(" | ") || "never"};`);
      continue;
    }
    if (kw === "union") {
      skipDirectives();
      const members: string[] = [];
      if (isP("=")) { p++; if (isP("|")) p++; members.push(name()); while (isP("|")) { p++; members.push(name()); } }
      members.forEach((m) => refs.add(m));
      out.push(`${doc(d)}export type ${n} = ${members.join(" | ") || "never"};`);
      continue;
    }
    if (kw === "type" || kw === "interface" || kw === "input") {
      let ext = "";
      if (peek()?.t === "name" && peek().v === "implements") { p++; const names = [name()]; while (isP("&") || (peek()?.t === "name" && !isP("{"))) { if (isP("&")) p++; names.push(name()); } ext = ` extends ${names.join(", ")}`; names.forEach((m) => refs.add(m)); }
      skipDirectives();
      const body = fields(kw === "input");
      const typename = kw === "type" ? `\n  __typename?: "${n}";` : "";
      out.push(`${doc(d)}export interface ${n}${ext} {${typename}${body ? "\n" + body : ""}\n}`);
      continue;
    }
    throw new Error(`unsupported definition "${kw}"`);
  }
  const header = [...scalars].map((s) => `/** custom scalar */\nexport type ${s} = ${/^(DateTime|Date|Time|UUID|URL|Email|JSON)$/i.test(s) && !/JSON/i.test(s) ? "string" : "unknown"};`);
  const missing = [...refs].filter((r) => !known.has(r) && !SCALARS[r]);
  const note = missing.length ? [`// Not defined in this SDL (add them or treat as unknown): ${missing.join(", ")}`] : [];
  return [...note, ...header, ...out].join("\n\n") + "\n";
}
