/** globパターン（**, *, ?, [..], {a,b}）をパスに照合する。! で始まるパターンは除外 */
function expandBraces(p: string): string[] {
  const m = /\{([^{}]*)\}/.exec(p);
  if (!m) return [p];
  const range = /^(-?\d+)\.\.(-?\d+)$/.exec(m[1]);
  const alts = range ? Array.from({ length: Math.abs(+range[2] - +range[1]) + 1 }, (_, i) => String(+range[1] + (+range[2] >= +range[1] ? i : -i))) : m[1].split(",");
  return alts.flatMap((a) => expandBraces(p.slice(0, m.index) + a + p.slice(m.index + m[0].length)));
}

function toRegex(pattern: string, dot: boolean, nocase: boolean): RegExp {
  let re = "";
  const segs = pattern.split("/");
  segs.forEach((seg, si) => {
    const last = si === segs.length - 1;
    if (seg === "**") { re += last ? ".*" : "(?:[^/]+/)*"; return; }
    const startDot = dot ? "" : "(?!\\.)";
    let r = "";
    for (let i = 0; i < seg.length; i++) {
      const c = seg[i];
      if (c === "*") { while (seg[i + 1] === "*") i++; r += "[^/]*"; }
      else if (c === "?") r += "[^/]";
      else if (c === "[") {
        const end = seg.indexOf("]", i + 2);
        if (end < 0) r += "\\[";
        else { let body = seg.slice(i + 1, end); if (body[0] === "!" || body[0] === "^") body = "^" + body.slice(1); r += `[${body.replace(/\\/g, "\\\\")}]`; i = end; }
      } else if (c === "\\" && seg[i + 1]) { r += seg[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
      else r += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    re += (seg.startsWith("*") || seg.startsWith("?") || seg.startsWith("[") ? startDot : "") + r + (last ? "" : "/");
  });
  return new RegExp(`^${re}$`, nocase ? "i" : "");
}

export function matchGlob(pattern: string, path: string, opts: { dot?: boolean; nocase?: boolean } = {}): boolean {
  const p = pattern.replace(/^\.\//, "");
  const target = path.replace(/^\.?\//, "");
  return expandBraces(p).some((alt) => toRegex(alt, !!opts.dot, !!opts.nocase).test(target) || (!alt.includes("/") && toRegex(alt, !!opts.dot, !!opts.nocase).test(target.split("/").pop() ?? "") && opts.dot === undefined));
}

/** 複数パターンの評価: 最後に一致したパターンが結果を決める（! は除外）。一致なしは false */
export function evaluateGlobs(patterns: string[], path: string, opts: { dot?: boolean; nocase?: boolean } = {}): { included: boolean; by: string | null } {
  let included = false, by: string | null = null;
  for (const raw of patterns) {
    const neg = raw.startsWith("!");
    const p = neg ? raw.slice(1) : raw;
    if (matchGlob(p, path, opts)) { included = !neg; by = raw; }
  }
  return { included, by };
}
