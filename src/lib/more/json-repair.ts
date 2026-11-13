/** 壊れたJSON（LLM出力・JS風の記法・途中で切れたもの）を許容して解析し、正しいJSONにする */

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
export type RepairNote = "fence" | "comments" | "single-quotes" | "unquoted-keys" | "trailing-comma" | "missing-comma" | "literals" | "closed" | "extra-text" | "special-numbers";

export function repairJson(input: string): { value: Json; notes: RepairNote[] } {
  const notes = new Set<RepairNote>();
  let src = input.replace(/^﻿/, "").trim();
  const fence = /```(?:json5?|jsonc|javascript|js)?\s*([\s\S]*?)(?:```|$)/i.exec(src);
  if (fence) { src = fence[1].trim(); notes.add("fence"); }
  const start = src.search(/[[{"]/);
  if (start > 0 && !/^[\d\-.tfnNIu]/.test(src)) src = src.slice(start);
  let i = 0;

  const ws = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith("//", i) || (src[i] === "#" )) { while (i < src.length && src[i] !== "\n") i++; notes.add("comments"); }
      else if (src.startsWith("/*", i)) { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; notes.add("comments"); }
      else break;
    }
  };

  const str = (): string => {
    const q = src[i++];
    if (q !== '"') notes.add("single-quotes");
    let out = "";
    while (i < src.length && src[i] !== q) {
      if (src[i] === "\\") {
        const n = src[++i];
        if (n === "u" && /^[0-9a-fA-F]{4}$/.test(src.slice(i + 1, i + 5))) { out += String.fromCharCode(parseInt(src.slice(i + 1, i + 5), 16)); i += 5; continue; }
        out += ({ n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" } as Record<string, string>)[n] ?? n ?? "";
        i++;
      } else if (src[i] === "\n" && q !== '`') { // 閉じ忘れの文字列は行末で閉じない（途中切れとして扱う）
        out += src[i++];
      } else out += src[i++];
    }
    if (i >= src.length) notes.add("closed"); else i++;
    return out;
  };

  const value = (): Json => {
    ws();
    const c = src[i];
    if (c === "{") return obj();
    if (c === "[") return arr();
    if (c === '"' || c === "'" || c === "`") return str();
    const m = /^(?:[+-]?(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)|[+-]?Infinity|NaN)/.exec(src.slice(i));
    if (m) {
      i += m[0].length;
      if (/Infinity|NaN/.test(m[0])) { notes.add("special-numbers"); return null; }
      if (/^[+-]?0[xX]/.test(m[0])) { notes.add("special-numbers"); return Number(m[0].replace("+", "")); }
      return Number(m[0]);
    }
    const w = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
    if (w) {
      i += w[0].length;
      const lit: Record<string, Json> = { true: true, false: false, null: null, True: true, False: false, None: null, undefined: null, TRUE: true, FALSE: false, NULL: null };
      if (w[0] in lit) { if (!["true", "false", "null"].includes(w[0])) notes.add("literals"); return lit[w[0]]; }
      notes.add("literals");
      return w[0];
    }
    if (i >= src.length) { notes.add("closed"); return null; }
    throw new SyntaxError(`Unexpected character "${c}" at position ${i}`);
  };

  const key = (): string => {
    ws();
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") return str();
    const m = /^[^\s:,{}[\]"'`]+/.exec(src.slice(i));
    if (!m) throw new SyntaxError(`Expected a key at position ${i}`);
    i += m[0].length;
    notes.add("unquoted-keys");
    return m[0];
  };

  const obj = (): Json => {
    i++;
    const out: { [k: string]: Json } = {};
    for (;;) {
      ws();
      if (i >= src.length) { notes.add("closed"); return out; }
      if (src[i] === "}") { i++; return out; }
      if (src[i] === ",") { i++; continue; }
      const k = key();
      ws();
      if (src[i] === ":" || src[i] === "=") i++; else if (i >= src.length) { notes.add("closed"); out[k] = null; return out; } else throw new SyntaxError(`Expected ":" at position ${i}`);
      out[k] = value();
      ws();
      if (src[i] === ",") { i++; ws(); if (src[i] === "}") notes.add("trailing-comma"); }
      else if (i < src.length && src[i] !== "}") notes.add("missing-comma");
    }
  };

  const arr = (): Json => {
    i++;
    const out: Json[] = [];
    for (;;) {
      ws();
      if (i >= src.length) { notes.add("closed"); return out; }
      if (src[i] === "]") { i++; return out; }
      if (src[i] === ",") { i++; continue; }
      out.push(value());
      ws();
      if (src[i] === ",") { i++; ws(); if (src[i] === "]") notes.add("trailing-comma"); }
      else if (i < src.length && src[i] !== "]") notes.add("missing-comma");
    }
  };

  const result = value();
  ws();
  if (i < src.length) notes.add("extra-text");
  return { value: result, notes: [...notes] };
}
