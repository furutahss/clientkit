/** HTML（SVG含む）を JSX に変換する簡易コンバーター */
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const ATTR: Record<string, string> = { class: "className", for: "htmlFor", tabindex: "tabIndex", readonly: "readOnly", maxlength: "maxLength", minlength: "minLength", colspan: "colSpan", rowspan: "rowSpan", crossorigin: "crossOrigin", contenteditable: "contentEditable", autocomplete: "autoComplete", autofocus: "autoFocus", autoplay: "autoPlay", charset: "charSet", srcset: "srcSet", "accept-charset": "acceptCharset", "http-equiv": "httpEquiv", enctype: "encType", datetime: "dateTime", frameborder: "frameBorder", allowfullscreen: "allowFullScreen", spellcheck: "spellCheck", cellpadding: "cellPadding", cellspacing: "cellSpacing", usemap: "useMap", novalidate: "noValidate", playsinline: "playsInline", itemprop: "itemProp", viewbox: "viewBox", preserveaspectratio: "preserveAspectRatio", "xlink:href": "xlinkHref", "xmlns:xlink": "xmlnsXlink", "xml:space": "xmlSpace", srclang: "srcLang", hreflang: "hrefLang", inputmode: "inputMode", enterkeyhint: "enterKeyHint", formaction: "formAction", rowspan_: "rowSpan" };
const BOOLEAN = new Set(["disabled", "checked", "selected", "readonly", "required", "multiple", "autofocus", "hidden", "open", "controls", "loop", "muted", "autoplay", "defer", "async", "novalidate", "reversed", "playsinline"]);
const EVENT = /^on[a-z]+$/;

const camel = (s: string) => s.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());

function convertStyle(css: string): string {
  const entries = css.split(";").map((d) => d.trim()).filter(Boolean).map((d) => { const i = d.indexOf(":"); return [d.slice(0, i).trim(), d.slice(i + 1).trim()] as const; }).filter(([k]) => k);
  const body = entries.map(([k, v]) => `${k.startsWith("--") ? JSON.stringify(k) : /^-ms-/.test(k) ? "ms" + camel(k.slice(4)) : camel(k.replace(/^-(webkit|moz|o)-/, (m) => m.slice(1, 2).toUpperCase() + m.slice(2)))}: ${/^-?\d+(\.\d+)?$/.test(v) && !/^0\d/.test(v) ? v : JSON.stringify(v)}`).join(", ");
  return `{{ ${body} }}`;
}

export type JsxOptions = { component: boolean; name: string; indent: number };

export function htmlToJsx(html: string, opts: JsxOptions): { jsx: string; notes: string[] } {
  const notes = new Set<string>();
  const re = /<!--([\s\S]*?)-->|<(\/?)([a-zA-Z][\w:.-]*)((?:\s+(?:[^\s"'<>\/=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>|([^<]+)/g;
  const out: string[] = [];
  const stack: string[] = [];
  const tagAttrs = (raw: string, tag: string): string => {
    const parts: string[] = [];
    for (const m of raw.matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const name = m[1], lower = name.toLowerCase();
      const value = m[2] ?? m[3] ?? m[4];
      if (EVENT.test(lower)) { notes.add("event"); parts.push(`${lower.replace(/^on(.)/, (_x, c: string) => "on" + c.toUpperCase())}={() => { /* ${(value ?? "").replace(/\*\//g, "* /")} */ }}`); continue; }
      if (lower === "style" && value !== undefined) { parts.push(`style=${convertStyle(value)}`); continue; }
      let jsxName = ATTR[lower] ?? (/^(data|aria)-/.test(lower) ? lower : /^[a-z]+(-[a-z]+)+$/.test(lower) && !lower.startsWith("data-") ? camel(lower) : name);
      if (lower === "value" && tag === "input") jsxName = "defaultValue";
      if (lower === "checked" && tag === "input") jsxName = "defaultChecked";
      if (value === undefined) { parts.push(BOOLEAN.has(lower) ? jsxName : `${jsxName}`); continue; }
      if (lower === "value" && ["textarea", "select"].includes(tag)) jsxName = "defaultValue";
      parts.push(`${jsxName}=${value.includes('"') ? `{${JSON.stringify(value)}}` : `"${value}"`}`);
    }
    return parts.length ? " " + parts.join(" ") : "";
  };
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1] !== undefined) { out.push(`{/*${m[1].replace(/\*\//g, "* /")}*/}`); continue; }
    if (m[6] !== undefined) { out.push(m[6].replace(/[{}]/g, (c) => `{'${c}'}`)); continue; }
    const close = m[2] === "/", tag = m[3], selfClose = m[5] === "/" || VOID.has(tag.toLowerCase());
    if (close) { if (!VOID.has(tag.toLowerCase())) { out.push(`</${tag}>`); stack.pop(); } continue; }
    out.push(`<${tag}${tagAttrs(m[4], tag.toLowerCase())}${selfClose ? " />" : ">"}`);
    if (!selfClose) stack.push(tag);
  }
  for (const t of stack.reverse()) { notes.add("unclosed"); out.push(`</${t}>`); }
  let body = out.join("");
  // 複数のルート要素はフラグメントで包む
  const topLevel = topLevelCount(body);
  if (topLevel > 1) { body = `<>${body}</>`; notes.add("fragment"); }
  const pretty = prettyJsx(body, opts.indent);
  const jsx = opts.component ? `export default function ${opts.name || "Component"}() {\n  return (\n${pretty.split("\n").map((l) => "    " + l).join("\n")}\n  );\n}\n` : pretty;
  return { jsx, notes: [...notes] };
}

// 属性値の { ... }（アロー関数の > を含む）や文字列を壊さずにタグ1つを取り出す
const TAG = String.raw`<\/?>|<\/[A-Za-z][\w:.-]*\s*>|<[A-Za-z][\w:.-]*(?:\s+[^\s=>\/]+(?:=(?:"[^"]*"|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}))?)*\s*\/?>`;

function topLevelCount(s: string): number {
  let depth = 0, count = 0;
  for (const m of s.matchAll(new RegExp(String.raw`\{\/\*[\s\S]*?\*\/\}|(?:${TAG})|[^<]+`, "g"))) {
    const t = m[0];
    if (t.startsWith("<")) {
      if (t.startsWith("</")) depth--;
      else { if (depth === 0) count++; if (!t.endsWith("/>")) depth++; }
    }
    else if (depth === 0 && t.trim()) count++;
    else if (depth === 0 && t.startsWith("{/*")) count++;
  }
  return count;
}

function prettyJsx(src: string, indent: number): string {
  const pad = (n: number) => " ".repeat(indent * n);
  const out: string[] = [];
  let depth = 0;
  const tokens = [...src.matchAll(new RegExp(String.raw`\{\/\*[\s\S]*?\*\/\}|(?:${TAG})|[^<]+`, "g"))].map((m) => m[0]);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith("</")) { depth = Math.max(0, depth - 1); out.push(pad(depth) + t); }
    else if (t.startsWith("<")) {
      const next = tokens[i + 1], after = tokens[i + 2];
      const selfClosed = t.endsWith("/>");
      // <p>短いテキスト</p> は1行にまとめる
      if (!selfClosed && next && !next.startsWith("<") && !next.startsWith("{/*") && after === `</${/^<([\w:.-]*)/.exec(t)?.[1] ?? ""}>` && next.length < 60 && !next.includes("\n")) { out.push(pad(depth) + t + next.trim() + after); i += 2; continue; }
      out.push(pad(depth) + t);
      if (!selfClosed && !t.startsWith("<>")) depth++; else if (t === "<>") depth++;
    } else if (t.startsWith("{/*")) out.push(pad(depth) + t);
    else if (t.trim()) out.push(pad(depth) + t.trim().replace(/\s*\n\s*/g, " "));
  }
  return out.join("\n");
}
