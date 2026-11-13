/**
 * jqの主要な部分を実装した小さなインタープリター（フィルター、パイプ、select/map、算術・比較、
 * オブジェクト・配列構築、文字列補間、as 変数、if、組み込み関数、@フォーマット）。
 * def・reduce・foreach・代入演算子・path系などは未対応。
 */
export type J = null | boolean | number | string | J[] | { [k: string]: J };

type Ast =
  | { t: "id" }
  | { t: "recurse" }
  | { t: "lit"; v: J }
  | { t: "str"; parts: (string | Ast)[]; fmt?: string }
  | { t: "field"; of: Ast; name: Ast; opt: boolean }
  | { t: "iter"; of: Ast; opt: boolean }
  | { t: "slice"; of: Ast; from: Ast | null; to: Ast | null; opt: boolean }
  | { t: "pipe"; l: Ast; r: Ast }
  | { t: "comma"; l: Ast; r: Ast }
  | { t: "bin"; op: string; l: Ast; r: Ast }
  | { t: "neg"; e: Ast }
  | { t: "arr"; e: Ast | null }
  | { t: "obj"; entries: [Ast, Ast][] }
  | { t: "if"; cond: Ast; then: Ast; else: Ast | null }
  | { t: "as"; src: Ast; name: string; body: Ast }
  | { t: "var"; name: string }
  | { t: "call"; name: string; args: Ast[] }
  | { t: "try"; e: Ast };

type Tok = { k: "p" | "id" | "num" | "str" | "field" | "var" | "fmt" | "end"; v: string; parts?: (string | Tok[])[] };

export class JqError extends Error {}

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const readString = (): (string | Tok[])[] => {
    i++; // opening quote
    const parts: (string | Tok[])[] = [];
    let cur = "";
    while (i < src.length && src[i] !== '"') {
      if (src[i] === "\\") {
        const n = src[++i];
        if (n === "(") {
          let depth = 1; const s = ++i;
          while (i < src.length && depth) { if (src[i] === "(") depth++; else if (src[i] === ")") depth--; i++; }
          if (depth) throw new JqError("unterminated string interpolation");
          parts.push(cur); cur = "";
          parts.push(lex(src.slice(s, i - 1)));
          continue;
        }
        if (n === "u") { cur += String.fromCharCode(parseInt(src.slice(i + 1, i + 5), 16)); i += 5; continue; }
        cur += ({ n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" } as Record<string, string>)[n] ?? n;
        i++;
      } else cur += src[i++];
    }
    if (src[i] !== '"') throw new JqError("unterminated string");
    i++;
    parts.push(cur);
    return parts;
  };
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === '"') { out.push({ k: "str", v: "", parts: readString() }); continue; }
    if (c === "." && src[i + 1] === ".") { out.push({ k: "p", v: ".." }); i += 2; continue; }
    if (c === ".") {
      const m = /^\.([A-Za-z_][A-Za-z0-9_]*)/.exec(src.slice(i));
      if (m) { out.push({ k: "field", v: m[1] }); i += m[0].length; continue; }
      if (src[i + 1] === '"') { i++; out.push({ k: "p", v: "." }); continue; }
      out.push({ k: "p", v: "." }); i++; continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
    if (num && /\d/.test(c)) { out.push({ k: "num", v: num[0] }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_]*(::[A-Za-z_][A-Za-z0-9_]*)*/.exec(src.slice(i));
    if (id) { out.push({ k: "id", v: id[0] }); i += id[0].length; continue; }
    if (c === "$") { const m = /^\$([A-Za-z_][A-Za-z0-9_]*)/.exec(src.slice(i)); if (!m) throw new JqError("bad variable"); out.push({ k: "var", v: m[1] }); i += m[0].length; continue; }
    if (c === "@") { const m = /^@[a-z0-9]+/.exec(src.slice(i)); if (!m) throw new JqError("bad format"); out.push({ k: "fmt", v: m[0] }); i += m[0].length; continue; }
    const two = src.slice(i, i + 2);
    if (["==", "!=", "<=", ">=", "//"].includes(two)) { out.push({ k: "p", v: two }); i += 2; continue; }
    if ("[](){}|,:;?+-*/%<>=".includes(c)) { out.push({ k: "p", v: c }); i++; continue; }
    throw new JqError(`unexpected character "${c}"`);
  }
  out.push({ k: "end", v: "" });
  return out;
}

function parse(toks: Tok[]): Ast {
  let p = 0;
  const peek = () => toks[p];
  const isP = (v: string) => peek().k === "p" && peek().v === v;
  const isId = (v: string) => peek().k === "id" && peek().v === v;
  const eat = (v: string) => { if (!isP(v)) throw new JqError(`expected "${v}" but found "${peek().v || "end of input"}"`); p++; };

  const pipe = (): Ast => {
    const l = comma();
    if (isP("|")) { p++; return { t: "pipe", l, r: pipe() }; }
    return l;
  };
  const comma = (): Ast => {
    let l = alt();
    while (isP(",")) { p++; l = { t: "comma", l, r: alt() }; }
    return l;
  };
  const alt = (): Ast => {
    const l = or();
    if (isP("//")) { p++; return { t: "bin", op: "//", l, r: alt() }; }
    return l;
  };
  const or = (): Ast => { let l = and(); while (isId("or")) { p++; l = { t: "bin", op: "or", l, r: and() }; } return l; };
  const and = (): Ast => { let l = cmp(); while (isId("and")) { p++; l = { t: "bin", op: "and", l, r: cmp() }; } return l; };
  const cmp = (): Ast => {
    const l = add();
    for (const op of ["==", "!=", "<=", ">=", "<", ">"]) if (isP(op)) { p++; return { t: "bin", op, l, r: add() }; }
    return l;
  };
  const add = (): Ast => { let l = mul(); while (isP("+") || isP("-")) { const op = peek().v; p++; l = { t: "bin", op, l, r: mul() }; } return l; };
  const mul = (): Ast => { let l = unary(); while (isP("*") || isP("/") || isP("%")) { const op = peek().v; p++; l = { t: "bin", op, l, r: unary() }; } return l; };
  const unary = (): Ast => {
    if (isP("-")) { p++; return { t: "neg", e: unary() }; }
    return postfix();
  };

  const postfix = (): Ast => {
    let e = primary();
    for (;;) {
      if (peek().k === "field") { const name = peek().v; p++; e = { t: "field", of: e, name: { t: "lit", v: name }, opt: false }; }
      else if (isP(".") && toks[p + 1]?.k === "str") { p++; const s = strAst(toks[p++]); e = { t: "field", of: e, name: s, opt: false }; }
      else if (isP("[")) {
        p++;
        if (isP("]")) { p++; e = { t: "iter", of: e, opt: false }; }
        else if (isP(":")) { p++; const to = pipe(); eat("]"); e = { t: "slice", of: e, from: null, to, opt: false }; }
        else {
          const a = pipe();
          if (isP(":")) { p++; const to = isP("]") ? null : pipe(); eat("]"); e = { t: "slice", of: e, from: a, to, opt: false }; }
          else { eat("]"); e = { t: "field", of: e, name: a, opt: false }; }
        }
      } else if (isP("?")) { p++; e = { t: "try", e }; }
      else if (isId("as")) { p++; if (peek().k !== "var") throw new JqError("expected $name after as"); const name = peek().v; p++; eat("|"); return { t: "as", src: e, name, body: pipe() }; }
      else break;
    }
    return e;
  };

  const strAst = (t: Tok, fmt?: string): Ast => ({ t: "str", fmt, parts: (t.parts ?? []).map((x) => (typeof x === "string" ? x : parse(x))) });

  const primary = (): Ast => {
    const t = peek();
    if (t.k === "num") { p++; return { t: "lit", v: Number(t.v) }; }
    if (t.k === "str") { p++; return strAst(t); }
    if (t.k === "fmt") { p++; if (peek().k === "str") { const s = peek(); p++; return strAst(s, t.v); } return { t: "call", name: t.v, args: [] }; }
    if (t.k === "field") { p++; return { t: "field", of: { t: "id" }, name: { t: "lit", v: t.v }, opt: false }; }
    if (t.k === "var") { p++; return { t: "var", name: t.v }; }
    if (t.k === "p") {
      if (t.v === ".") { p++; if (peek().k === "str") { const s = peek(); p++; return { t: "field", of: { t: "id" }, name: strAst(s), opt: false }; } return { t: "id" }; }
      if (t.v === "..") { p++; return { t: "recurse" }; }
      if (t.v === "(") { p++; const e = pipe(); eat(")"); return e; }
      if (t.v === "[") { p++; if (isP("]")) { p++; return { t: "arr", e: null }; } const e = pipe(); eat("]"); return { t: "arr", e }; }
      if (t.v === "{") return objectAst();
    }
    if (t.k === "id") {
      p++;
      if (t.v === "if") return ifAst();
      if (t.v === "try") { return { t: "try", e: postfixNoTry() }; }
      if (t.v === "true" || t.v === "false") return { t: "lit", v: t.v === "true" };
      if (t.v === "null") return { t: "lit", v: null };
      const args: Ast[] = [];
      if (isP("(")) { p++; args.push(pipe()); while (isP(";")) { p++; args.push(pipe()); } eat(")"); }
      return { t: "call", name: t.v, args };
    }
    throw new JqError(`unexpected "${t.v || "end of input"}"`);
  };
  const postfixNoTry = (): Ast => primary();

  const ifAst = (): Ast => {
    const cond = pipe();
    if (!isId("then")) throw new JqError('expected "then"');
    p++;
    const then = pipe();
    let els: Ast | null = null;
    if (isId("elif")) { p++; els = ifAst(); return { t: "if", cond, then, else: els }; }
    if (isId("else")) { p++; els = pipe(); }
    if (!isId("end")) throw new JqError('expected "end"');
    p++;
    return { t: "if", cond, then, else: els };
  };

  const objectAst = (): Ast => {
    eat("{");
    const entries: [Ast, Ast][] = [];
    while (!isP("}")) {
      const t = peek();
      let key: Ast;
      if (t.k === "id") { p++; key = { t: "lit", v: t.v }; }
      else if (t.k === "str") { p++; key = strAst(t); }
      else if (t.k === "var") { p++; entries.push([{ t: "lit", v: t.v }, { t: "var", name: t.v }]); if (isP(",")) p++; continue; }
      else if (t.k === "field") { p++; entries.push([{ t: "lit", v: t.v }, { t: "field", of: { t: "id" }, name: { t: "lit", v: t.v }, opt: false }]); if (isP(",")) p++; continue; }
      else if (isP("(")) { p++; key = pipe(); eat(")"); }
      else throw new JqError(`unexpected "${t.v}" in object`);
      if (isP(":")) {
        p++;
        // 値には | を含められない（カンマの前まで）。ただし括弧内は可
        const v = alt();
        entries.push([key, v]);
      } else entries.push([key, { t: "field", of: { t: "id" }, name: key, opt: false }]);
      if (isP(",")) p++; else if (!isP("}")) throw new JqError('expected "," or "}"');
    }
    eat("}");
    return { t: "obj", entries };
  };

  const ast = pipe();
  if (peek().k !== "end") throw new JqError(`unexpected "${peek().v}"`);
  return ast;
}

const typeOf = (v: J) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
const order = ["null", "boolean", "number", "string", "array", "object"];

export function compare(a: J, b: J): number {
  const ta = order.indexOf(typeOf(a)), tb = order.indexOf(typeOf(b));
  if (ta !== tb) return ta - tb;
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = compare(a[i], b[i]); if (c) return c; }
    return a.length - b.length;
  }
  if (a !== null && typeof a === "object" && b !== null && typeof b === "object") {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    const c = compare(ka, kb);
    if (c) return c;
    for (const k of ka) { const d = compare((a as Record<string, J>)[k], (b as Record<string, J>)[k]); if (d) return d; }
    return 0;
  }
  return a === b ? 0 : (a as number) < (b as number) ? -1 : 1;
}
const equal = (a: J, b: J) => compare(a, b) === 0;
const truthy = (v: J) => v !== null && v !== false;
const show = (v: J) => JSON.stringify(v);
const errType = (v: J) => `${typeOf(v)} (${(show(v) ?? "").slice(0, 30)})`;

function contains(a: J, b: J): boolean {
  if (typeof a === "string" && typeof b === "string") return a.includes(b);
  if (Array.isArray(a) && Array.isArray(b)) return b.every((y) => a.some((x) => contains(x, y)));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) return Object.entries(b).every(([k, v]) => k in a && contains((a as Record<string, J>)[k], v));
  return equal(a, b);
}

function formatValue(fmt: string, v: J): string {
  const text = typeof v === "string" ? v : show(v);
  switch (fmt) {
    case "@text": return text;
    case "@json": return show(v);
    case "@uri": return encodeURIComponent(text).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
    case "@html": return text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&#39;", '"': "&quot;" })[c]!);
    case "@base64": return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
    case "@base64d": return new TextDecoder().decode(Uint8Array.from(atob(text), (c) => c.charCodeAt(0)));
    case "@sh": return `'${text.replace(/'/g, "'\\''")}'`;
    case "@csv": case "@tsv": {
      if (!Array.isArray(v)) throw new JqError(`${errType(v)} cannot be ${fmt.slice(1)}-formatted, only an array can be`);
      return v.map((x) => {
        if (typeof x === "number" || typeof x === "boolean") return String(x);
        if (x === null) return "";
        const s = String(x);
        return fmt === "@csv" ? `"${s.replace(/"/g, '""')}"` : s.replace(/[\t\n\r\\]/g, (c) => ({ "\t": "\\t", "\n": "\\n", "\r": "\\r", "\\": "\\\\" })[c]!);
      }).join(fmt === "@csv" ? "," : "\t");
    }
    default: throw new JqError(`${fmt} is not a valid format`);
  }
}

type Env = Map<string, J>;
const MAX_OUTPUTS = 10000;

function* ev(a: Ast, input: J, env: Env): Generator<J> {
  switch (a.t) {
    case "id": yield input; return;
    case "recurse": { yield* walk(input); return; }
    case "lit": yield a.v; return;
    case "var": { if (!env.has(a.name)) throw new JqError(`$${a.name} is not defined`); yield env.get(a.name)!; return; }
    case "str": {
      const { parts, fmt } = a;
      function* build(i: number, acc: string): Generator<string> {
        if (i >= parts.length) { yield acc; return; }
        const part = parts[i];
        if (typeof part === "string") { yield* build(i + 1, acc + part); return; }
        for (const v of ev(part, input, env)) yield* build(i + 1, acc + (fmt ? formatValue(fmt, v) : typeof v === "string" ? v : show(v)));
      }
      yield* build(0, "");
      return;
    }
    case "field": {
      for (const base of ev(a.of, input, env)) for (const k of ev(a.name, input, env)) yield index(base, k);
      return;
    }
    case "iter": {
      for (const base of ev(a.of, input, env)) {
        if (Array.isArray(base)) yield* base;
        else if (base !== null && typeof base === "object") yield* Object.values(base);
        else throw new JqError(`Cannot iterate over ${errType(base)}`);
      }
      return;
    }
    case "slice": {
      for (const base of ev(a.of, input, env)) for (const f of a.from ? ev(a.from, input, env) : [null]) for (const t of a.to ? ev(a.to, input, env) : [null]) {
        if (base === null) { yield null; continue; }
        if (typeof base !== "string" && !Array.isArray(base)) throw new JqError(`Cannot index ${typeOf(base)} with object`);
        const len = base.length;
        const norm = (x: J, d: number) => { if (x === null) return d; const n = Math.floor(x as number); return Math.max(0, Math.min(len, n < 0 ? len + n : n)); };
        yield base.slice(norm(f, 0), norm(t, len)) as J;
      }
      return;
    }
    case "pipe": for (const x of ev(a.l, input, env)) yield* ev(a.r, x, env); return;
    case "comma": yield* ev(a.l, input, env); yield* ev(a.r, input, env); return;
    case "neg": for (const x of ev(a.e, input, env)) { if (typeof x !== "number") throw new JqError(`${errType(x)} cannot be negated`); yield -x; } return;
    case "arr": { yield a.e ? [...ev(a.e, input, env)] : []; return; }
    case "obj": {
      const entries = a.entries;
      function* build(i: number, acc: Record<string, J>): Generator<J> {
        if (i >= entries.length) { yield acc; return; }
        const [kA, vA] = entries[i];
        for (const k of ev(kA, input, env)) {
          if (typeof k !== "string") throw new JqError(`Object keys must be strings, not ${typeOf(k)}`);
          for (const v of ev(vA, input, env)) yield* build(i + 1, { ...acc, [k]: v });
        }
      }
      yield* build(0, {});
      return;
    }
    case "if": {
      for (const c of ev(a.cond, input, env)) {
        if (truthy(c)) yield* ev(a.then, input, env);
        else if (a.else) yield* ev(a.else, input, env);
        else yield input;
      }
      return;
    }
    case "as": for (const v of ev(a.src, input, env)) { const e2 = new Map(env); e2.set(a.name, v); yield* ev(a.body, input, e2); } return;
    case "try": { try { yield* [...ev(a.e, input, env)]; } catch (e) { if (!(e instanceof JqError)) throw e; } return; }
    case "bin": {
      if (a.op === "//") { const vals = [...ev(a.l, input, env)].filter(truthy); if (vals.length) yield* vals; else yield* ev(a.r, input, env); return; }
      if (a.op === "and" || a.op === "or") {
        for (const l of ev(a.l, input, env)) {
          if (a.op === "and" && !truthy(l)) { yield false; continue; }
          if (a.op === "or" && truthy(l)) { yield true; continue; }
          for (const r of ev(a.r, input, env)) yield truthy(r);
        }
        return;
      }
      for (const r of ev(a.r, input, env)) for (const l of ev(a.l, input, env)) yield binop(a.op, l, r);
      return;
    }
    case "call": yield* call(a.name, a.args, input, env); return;
  }
}

function* walk(v: J): Generator<J> {
  yield v;
  if (Array.isArray(v)) for (const x of v) yield* walk(x);
  else if (v !== null && typeof v === "object") for (const x of Object.values(v)) yield* walk(x);
}

function index(base: J, k: J): J {
  if (base === null) return null;
  if (typeof k === "string") { if (typeof base === "object" && !Array.isArray(base)) return (base as Record<string, J>)[k] ?? null; throw new JqError(`Cannot index ${typeOf(base)} with "${k}"`); }
  if (typeof k === "number") { if (Array.isArray(base)) { const i = Math.floor(k); return base[i < 0 ? base.length + i : i] ?? null; } throw new JqError(`Cannot index ${typeOf(base)} with number`); }
  throw new JqError(`Cannot index ${typeOf(base)} with ${typeOf(k)}`);
}

function binop(op: string, l: J, r: J): J {
  switch (op) {
    case "==": return equal(l, r);
    case "!=": return !equal(l, r);
    case "<": return compare(l, r) < 0;
    case "<=": return compare(l, r) <= 0;
    case ">": return compare(l, r) > 0;
    case ">=": return compare(l, r) >= 0;
    case "+":
      if (l === null) return r;
      if (r === null) return l;
      if (typeof l === "number" && typeof r === "number") return l + r;
      if (typeof l === "string" && typeof r === "string") return l + r;
      if (Array.isArray(l) && Array.isArray(r)) return [...l, ...r];
      if (typeof l === "object" && typeof r === "object" && !Array.isArray(l) && !Array.isArray(r)) return { ...l, ...r };
      throw new JqError(`${errType(l)} and ${errType(r)} cannot be added`);
    case "-":
      if (typeof l === "number" && typeof r === "number") return l - r;
      if (Array.isArray(l) && Array.isArray(r)) return l.filter((x) => !r.some((y) => equal(x, y)));
      throw new JqError(`${errType(l)} and ${errType(r)} cannot be subtracted`);
    case "*":
      if (typeof l === "number" && typeof r === "number") return l * r;
      if (typeof l === "string" && typeof r === "number") return r > 0 ? l.repeat(Math.ceil(r)) : null;
      if (typeof l === "number" && typeof r === "string") return l > 0 ? r.repeat(Math.ceil(l)) : null;
      throw new JqError(`${errType(l)} and ${errType(r)} cannot be multiplied`);
    case "/":
      if (typeof l === "number" && typeof r === "number") { if (r === 0) throw new JqError(`${errType(l)} and ${errType(r)} cannot be divided because the divisor is zero`); return l / r; }
      if (typeof l === "string" && typeof r === "string") return l.split(r);
      throw new JqError(`${errType(l)} and ${errType(r)} cannot be divided`);
    case "%":
      if (typeof l === "number" && typeof r === "number") { if (Math.trunc(r) === 0) throw new JqError("cannot be divided because the divisor is zero"); return Math.trunc(l) % Math.trunc(r); }
      throw new JqError(`${errType(l)} and ${errType(r)} cannot be divided`);
  }
  throw new JqError(`unknown operator ${op}`);
}

const arr = (v: J, fn: string): J[] => { if (!Array.isArray(v)) throw new JqError(`${errType(v)} cannot be used with ${fn} (an array is required)`); return v; };
const str = (v: J, fn: string): string => { if (typeof v !== "string") throw new JqError(`${errType(v)} cannot be used with ${fn} (a string is required)`); return v; };
const num = (v: J, fn: string): number => { if (typeof v !== "number") throw new JqError(`${errType(v)} cannot be used with ${fn} (a number is required)`); return v; };
const first = (a: Ast, input: J, env: Env): J[] => { const out = [...ev(a, input, env)]; return out.slice(0, 1); };

function* call(name: string, args: Ast[], input: J, env: Env): Generator<J> {
  const sub = (i: number) => [...ev(args[i], input, env)];
  const keyed = (f: Ast, xs: J[]) => xs.map((x) => ({ x, k: [...ev(f, x, env)] as J }));
  switch (name) {
    case "empty": return;
    case "not": yield !truthy(input); return;
    case "length": {
      if (input === null) yield 0;
      else if (typeof input === "string") yield Array.from(input).length;
      else if (Array.isArray(input)) yield input.length;
      else if (typeof input === "object") yield Object.keys(input).length;
      else if (typeof input === "number") yield Math.abs(input);
      else throw new JqError(`${errType(input)} has no length`);
      return;
    }
    case "keys": case "keys_unsorted": {
      if (Array.isArray(input)) yield input.map((_, i) => i);
      else if (input !== null && typeof input === "object") yield name === "keys" ? Object.keys(input).sort() : Object.keys(input);
      else throw new JqError(`${errType(input)} has no keys`);
      return;
    }
    case "values": if (input !== null) yield input; return;
    case "type": yield typeOf(input); return;
    case "add": { const xs = args.length ? [...ev(args[0], input, env)] : input !== null && typeof input === "object" ? Object.values(input) : arr(input, "add"); yield xs.reduce<J>((a, b) => binop("+", a, b), null); return; }
    case "any": case "all": {
      const xs = arr(input, name);
      const f = args.length ? (x: J) => [...ev(args[0], x, env)].some(truthy) : truthy;
      yield name === "any" ? xs.some(f) : xs.every(f);
      return;
    }
    case "map": for (const x of [arr(input, "map").flatMap((v) => [...ev(args[0], v, env)])]) yield x; return;
    case "map_values": { if (Array.isArray(input)) yield input.flatMap((v) => first(args[0], v, env)); else if (input && typeof input === "object") yield Object.fromEntries(Object.entries(input).flatMap(([k, v]) => first(args[0], v, env).map((r) => [k, r] as [string, J]))); else throw new JqError(`${errType(input)} has no values`); return; }
    case "select": for (const c of ev(args[0], input, env)) if (truthy(c)) yield input; return;
    case "recurse": yield* walk(input); return;
    case "first": if (args.length) { const r = first(args[0], input, env); yield* r; } else yield arr(input, name)[0] ?? null; return;
    case "last": if (args.length) { const o = [...ev(args[0], input, env)]; if (o.length) yield o[o.length - 1]; } else { const a = arr(input, name); yield a[a.length - 1] ?? null; } return;
    case "limit": for (const n of ev(args[0], input, env)) yield* [...ev(args[1], input, env)].slice(0, num(n, "limit")); return;
    case "range": {
      const [a, b] = args.length === 1 ? [0, num(sub(0)[0], "range")] : [num(sub(0)[0], "range"), num(sub(1)[0], "range")];
      for (let i = a; i < b && i - a < MAX_OUTPUTS; i++) yield i;
      return;
    }
    case "to_entries": { if (input === null || typeof input !== "object" || Array.isArray(input)) throw new JqError(`${errType(input)} has no keys`); yield Object.entries(input).map(([key, value]) => ({ key, value })); return; }
    case "from_entries": yield Object.fromEntries(arr(input, name).map((e) => { const o = e as Record<string, J>; const k = o.key ?? o.k ?? o.name ?? o.Name ?? o.Key ?? o.K; return [String(k), (o.value ?? o.v ?? o.Value ?? o.V ?? null) as J]; })); return;
    case "with_entries": { const entries = Object.entries(input as object).map(([key, value]) => ({ key, value })); const mapped = entries.flatMap((e) => [...ev(args[0], e as J, env)]); yield Object.fromEntries(mapped.map((e) => { const o = e as Record<string, J>; return [String(o.key ?? o.k ?? o.name), (o.value ?? o.v ?? null) as J]; })); return; }
    case "has": for (const k of ev(args[0], input, env)) { if (Array.isArray(input) && typeof k === "number") yield k >= 0 && k < input.length; else if (input && typeof input === "object" && typeof k === "string") yield k in input; else throw new JqError(`Cannot check whether ${typeOf(input)} has a ${typeOf(k)} key`); } return;
    case "contains": for (const b of ev(args[0], input, env)) yield contains(input, b); return;
    case "inside": for (const b of ev(args[0], input, env)) yield contains(b, input); return;
    case "flatten": { const depth = args.length ? num(sub(0)[0], name) : 1e9; const flat = (xs: J[], d: number): J[] => xs.flatMap((x) => (Array.isArray(x) && d >= 0 ? flat(x, d - 1) : [x])); yield flat(arr(input, name), depth - 1); return; }
    case "reverse": yield typeof input === "string" ? Array.from(input).reverse().join("") : [...arr(input, name)].reverse(); return;
    case "sort": yield [...arr(input, name)].sort(compare); return;
    case "sort_by": yield keyed(args[0], arr(input, name)).sort((a, b) => compare(a.k, b.k)).map((e) => e.x); return;
    case "group_by": { const groups: { k: J; xs: J[] }[] = []; for (const e of keyed(args[0], arr(input, name)).sort((a, b) => compare(a.k, b.k))) { const g = groups[groups.length - 1]; if (g && equal(g.k, e.k)) g.xs.push(e.x); else groups.push({ k: e.k, xs: [e.x] }); } yield groups.map((g) => g.xs); return; }
    case "unique": { const out: J[] = []; for (const x of [...arr(input, name)].sort(compare)) if (!out.length || !equal(out[out.length - 1], x)) out.push(x); yield out; return; }
    case "unique_by": { const out: { x: J; k: J }[] = []; for (const e of keyed(args[0], arr(input, name)).sort((a, b) => compare(a.k, b.k))) if (!out.length || !equal(out[out.length - 1].k, e.k)) out.push(e); yield out.map((e) => e.x); return; }
    case "min": case "max": { const xs = arr(input, name); yield xs.length ? xs.reduce((a, b) => ((name === "min" ? compare(b, a) < 0 : compare(b, a) >= 0) ? b : a)) : null; return; }
    case "min_by": case "max_by": { const ks = keyed(args[0], arr(input, name)); yield ks.length ? ks.reduce((a, b) => ((name === "min_by" ? compare(b.k, a.k) < 0 : compare(b.k, a.k) >= 0) ? b : a)).x : null; return; }
    case "floor": yield Math.floor(num(input, name)); return;
    case "ceil": yield Math.ceil(num(input, name)); return;
    case "round": yield Math.round(num(input, name)); return;
    case "sqrt": yield Math.sqrt(num(input, name)); return;
    case "abs": yield Math.abs(num(input, name)); return;
    case "tostring": yield typeof input === "string" ? input : show(input); return;
    case "tonumber": { if (typeof input === "number") yield input; else { const n = Number(str(input, name)); if (Number.isNaN(n) || !String(input).trim()) throw new JqError(`Cannot parse "${input}" as a number`); yield n; } return; }
    case "tojson": yield show(input); return;
    case "fromjson": try { yield JSON.parse(str(input, name)); } catch { throw new JqError(`${show(input)} is not valid JSON`); } return;
    case "ascii_downcase": yield str(input, name).toLowerCase(); return;
    case "ascii_upcase": yield str(input, name).toUpperCase(); return;
    case "startswith": for (const s of ev(args[0], input, env)) yield str(input, name).startsWith(str(s, name)); return;
    case "endswith": for (const s of ev(args[0], input, env)) yield str(input, name).endsWith(str(s, name)); return;
    case "ltrimstr": for (const s of ev(args[0], input, env)) yield typeof input === "string" && typeof s === "string" && input.startsWith(s) ? input.slice(s.length) : input; return;
    case "rtrimstr": for (const s of ev(args[0], input, env)) yield typeof input === "string" && typeof s === "string" && s && input.endsWith(s) ? input.slice(0, -s.length) : input; return;
    case "split": for (const s of ev(args[0], input, env)) yield str(input, name).split(str(s, name)); return;
    case "join": for (const s of ev(args[0], input, env)) yield arr(input, name).map((x) => (x === null ? "" : typeof x === "string" ? x : show(x))).join(str(s, name)); return;
    case "test": for (const re of ev(args[0], input, env)) yield new RegExp(str(re, name), args[1] ? str(sub(1)[0], name).replace(/[^gimsuy]/g, "") : "").test(str(input, name)); return;
    case "trim": yield str(input, name).trim(); return;
    case "env": case "input": case "debug": yield input; return;
    case "error": throw new JqError(typeof input === "string" ? input : show(input));
    default:
      if (name.startsWith("@")) { yield formatValue(name, input); return; }
      throw new JqError(`${name}/${args.length} is not defined`);
  }
}

export function runJq(program: string, input: J): J[] {
  const ast = parse(lex(program));
  const out: J[] = [];
  for (const v of ev(ast, input, new Map())) { out.push(v); if (out.length >= MAX_OUTPUTS) break; }
  return out;
}
