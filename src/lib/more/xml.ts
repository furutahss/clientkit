/** 依存なしの小さなXMLパーサー・整形・JSON相互変換・XPath（部分）。DOMParserを使わないためWorker・テストでも動く */

export type XEl = { type: "el"; name: string; attrs: [string, string][]; children: XNode[] };
export type XNode = XEl | { type: "text" | "cdata" | "comment" | "pi" | "doctype"; value: string };

export class XmlError extends Error {}

const ENT: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENT[e] ?? m;
  });
}
export const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const escapeAttr = (s: string) => escapeText(s).replace(/"/g, "&quot;");

export function parseXml(src: string): XNode[] {
  const root: XEl = { type: "el", name: "#root", attrs: [], children: [] };
  const stack: XEl[] = [root];
  let i = 0;
  const lineAt = (p: number) => src.slice(0, p).split("\n").length;
  const fail = (msg: string, p = i) => { throw new XmlError(`${msg} (line ${lineAt(p)})`); };
  while (i < src.length) {
    const top = stack[stack.length - 1];
    if (src[i] !== "<") {
      const end = src.indexOf("<", i);
      const raw = src.slice(i, end < 0 ? src.length : end);
      top.children.push({ type: "text", value: decodeEntities(raw) });
      i = end < 0 ? src.length : end;
    } else if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i + 4);
      if (end < 0) fail("Unterminated comment");
      top.children.push({ type: "comment", value: src.slice(i + 4, end) });
      i = end + 3;
    } else if (src.startsWith("<![CDATA[", i)) {
      const end = src.indexOf("]]>", i);
      if (end < 0) fail("Unterminated CDATA");
      top.children.push({ type: "cdata", value: src.slice(i + 9, end) });
      i = end + 3;
    } else if (src.startsWith("<?", i)) {
      const end = src.indexOf("?>", i);
      if (end < 0) fail("Unterminated processing instruction");
      top.children.push({ type: "pi", value: src.slice(i + 2, end) });
      i = end + 2;
    } else if (src.startsWith("<!", i)) {
      let depth = 0, j = i;
      for (; j < src.length; j++) { if (src[j] === "<") depth++; else if (src[j] === ">" && --depth === 0) break; }
      top.children.push({ type: "doctype", value: src.slice(i + 2, j) });
      i = j + 1;
    } else if (src[i + 1] === "/") {
      const end = src.indexOf(">", i);
      if (end < 0) fail("Unterminated end tag");
      const name = src.slice(i + 2, end).trim();
      if (stack.length === 1 || top.name !== name) fail(`Unexpected </${name}>${stack.length > 1 ? `, expected </${top.name}>` : ""}`);
      stack.pop();
      i = end + 1;
    } else {
      const m = /^<([^\s/>]+)/.exec(src.slice(i, i + 256));
      if (!m) fail("Invalid tag");
      const el: XEl = { type: "el", name: m![1], attrs: [], children: [] };
      let j = i + m![0].length;
      for (;;) {
        while (/\s/.test(src[j] ?? "")) j++;
        if (j >= src.length) fail("Unterminated start tag", i);
        if (src[j] === ">") { j++; stack.push(el); top.children.push(el); break; }
        if (src.startsWith("/>", j)) { j += 2; top.children.push(el); break; }
        const am = /^([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/.exec(src.slice(j));
        if (!am) fail(`Invalid attribute in <${el.name}>`, j);
        el.attrs.push([am![1], decodeEntities(am![3] ?? am![4] ?? "")]);
        j += am![0].length;
      }
      i = j;
    }
  }
  if (stack.length > 1) fail(`Missing </${stack[stack.length - 1].name}>`, src.length);
  return root.children;
}

const attrStr = (el: XEl) => el.attrs.map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join("");

function serialize(nodes: XNode[], indent: string | null, depth: number): string {
  const pad = indent === null ? "" : indent.repeat(depth);
  const nl = indent === null ? "" : "\n";
  const out: string[] = [];
  for (const n of nodes) {
    if (n.type !== "el") {
      if (n.type === "text") {
        const v = indent === null ? n.value : n.value.trim();
        if (v) out.push(pad + escapeText(v));
      } else if (n.type === "cdata") out.push(`${pad}<![CDATA[${n.value}]]>`);
      else if (n.type === "comment") out.push(`${pad}<!--${n.value}-->`);
      else if (n.type === "pi") out.push(`${pad}<?${n.value}?>`);
      else out.push(`${pad}<!${n.value}>`);
      continue;
    }
    const kids = indent === null ? n.children : n.children.filter((c) => c.type !== "text" || c.value.trim());
    if (!kids.length) out.push(`${pad}<${n.name}${attrStr(n)}/>`);
    else if (indent !== null && kids.length === 1 && (kids[0].type === "text" || kids[0].type === "cdata")) out.push(`${pad}<${n.name}${attrStr(n)}>${kids[0].type === "text" ? escapeText(kids[0].value.trim()) : `<![CDATA[${kids[0].value}]]>`}</${n.name}>`);
    else out.push(`${pad}<${n.name}${attrStr(n)}>${nl}${serialize(kids, indent, depth + 1)}${nl}${pad}</${n.name}>`);
  }
  return out.join(nl);
}

export const formatXml = (src: string, indent = "  ") => serialize(parseXml(src), indent, 0);
const stripComments = (nodes: XNode[]): XNode[] =>
  nodes.filter((n) => n.type !== "comment").map((n) => (n.type === "el" ? { ...n, children: stripComments(n.children) } : n));
export const minifyXml = (src: string) => serialize(stripComments(parseXml(src)), null, 0).replace(/>\s+</g, "><");
export const serializeNode = (n: XNode, indent: string | null = "  ") => serialize([n], indent, 0);

const textOf = (el: XEl): string => el.children.map((c) => (c.type === "text" || c.type === "cdata" ? c.value : c.type === "el" ? textOf(c) : "")).join("");

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** XML → JSON。属性は "@名前"、混在テキストは "#text"、同名の子要素は配列にする */
export function xmlToJson(src: string): Json {
  const toVal = (el: XEl): Json => {
    const elements = el.children.filter((c): c is XEl => c.type === "el");
    const text = el.children.filter((c) => c.type === "text" || c.type === "cdata").map((c) => (c as { value: string }).value).join("").trim();
    if (!el.attrs.length && !elements.length) return text;
    const obj: { [k: string]: Json } = {};
    for (const [k, v] of el.attrs) obj[`@${k}`] = v;
    for (const c of elements) {
      const v = toVal(c);
      const cur = obj[c.name];
      if (cur === undefined) obj[c.name] = v;
      else if (Array.isArray(cur)) cur.push(v);
      else obj[c.name] = [cur, v];
    }
    if (text) obj["#text"] = text;
    return obj;
  };
  const roots = parseXml(src).filter((n): n is XEl => n.type === "el");
  if (roots.length !== 1) throw new XmlError("XML must have exactly one root element");
  return { [roots[0].name]: toVal(roots[0]) };
}

export function jsonToXml(value: Json, rootName = "root"): string {
  const build = (name: string, v: Json): XNode[] => {
    if (Array.isArray(v)) return v.flatMap((x) => build(name, x));
    const el: XEl = { type: "el", name, attrs: [], children: [] };
    if (v !== null && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (k.startsWith("@")) el.attrs.push([k.slice(1), String(x)]);
        else if (k === "#text") el.children.push({ type: "text", value: String(x) });
        else el.children.push(...build(k, x));
      }
    } else if (v !== null && v !== "") el.children.push({ type: "text", value: String(v) });
    return [el];
  };
  const keys = v0(value);
  const nodes = keys ? build(keys[0], (value as { [k: string]: Json })[keys[0]]) : build(rootName, value);
  return serialize(nodes, "  ", 0);
}
function v0(value: Json): string[] | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 1 && !Object.keys(value)[0].startsWith("@") && Object.keys(value)[0] !== "#text" ? Object.keys(value) : null;
}

/** XPathの部分実装: / と //、名前・*・@属性・text()、述語 [n] [last()] [@a] [@a='v'] [子='v'] */
export function xpath(nodes: XNode[], expr: string): string[] {
  const steps: { deep: boolean; test: string; preds: string[] }[] = [];
  const re = /(\/\/|\/)?([^/[\]]+)((?:\[[^\]]*\])*)/g;
  const trimmed = expr.trim();
  let consumed = 0;
  for (let m = re.exec(trimmed); m; m = re.exec(trimmed)) {
    if (m.index !== consumed) throw new XmlError(`Unsupported XPath near "${trimmed.slice(consumed)}"`);
    consumed = m.index + m[0].length;
    if (!/^(\*|@\*|@?[\w.:-]+|text\(\))$/.test(m[2])) throw new XmlError(`Unsupported XPath step "${m[2]}"`);
    steps.push({ deep: m[1] === "//", test: m[2], preds: [...m[3].matchAll(/\[([^\]]*)\]/g)].map((p) => p[1]) });
  }
  if (!steps.length || consumed !== trimmed.length) throw new XmlError("Unsupported XPath expression");
  let ctx: XEl[] = [{ type: "el", name: "#root", attrs: [], children: nodes }];
  const descendants = (el: XEl): XEl[] => el.children.filter((c): c is XEl => c.type === "el").flatMap((c) => [c, ...descendants(c)]);
  for (let si = 0; si < steps.length; si++) {
    const s = steps[si];
    const last = si === steps.length - 1;
    if (s.test.startsWith("@") || s.test === "text()") {
      if (!last) throw new XmlError("@attr and text() must be the last step");
      const pool = s.deep ? ctx.flatMap((c) => [c, ...descendants(c)]) : ctx;
      return pool.flatMap((el) => s.test === "text()" ? el.children.filter((c) => c.type === "text" && c.value.trim()).map((c) => (c as { value: string }).value.trim()) : el.attrs.filter(([k]) => s.test === "@*" || k === s.test.slice(1)).map(([, v]) => v));
    }
    let next: XEl[] = [];
    for (const c of ctx) {
      const cand = s.deep ? descendants(c) : c.children.filter((x): x is XEl => x.type === "el");
      let list = cand.filter((e) => s.test === "*" || e.name === s.test);
      for (const p of s.preds) {
        if (/^\d+$/.test(p)) list = list.slice(Number(p) - 1, Number(p));
        else if (p === "last()") list = list.slice(-1);
        else {
          const am = /^@([^=\s]+)(?:\s*=\s*(?:'([^']*)'|"([^"]*)"))?$/.exec(p);
          const cm = /^([^=\s@]+)\s*=\s*(?:'([^']*)'|"([^"]*)")$/.exec(p);
          if (am) list = list.filter((e) => e.attrs.some(([k, v]) => k === am[1] && (am[2] === undefined && am[3] === undefined || v === (am[2] ?? am[3]))));
          else if (cm) list = list.filter((e) => e.children.some((k) => k.type === "el" && k.name === cm[1] && textOf(k).trim() === (cm[2] ?? cm[3])));
          else throw new XmlError(`Unsupported predicate [${p}]`);
        }
      }
      next = next.concat(list);
    }
    ctx = [...new Set(next)];
  }
  return ctx.map((e) => serializeNode(e));
}
