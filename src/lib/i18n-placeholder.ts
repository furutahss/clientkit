/**
 * 翻訳JSONのキーと {name} 形式のプレースホルダーの整合性を確認する。
 * エスケープはICU MessageFormatと同じく、'{' や '{name}' のようにアポストロフィで囲んだ部分は文字として扱い、
 * '' は1つのアポストロフィとして扱う。それ以外のアポストロフィ（don't など）は通常の文字。
 * {count, plural, ...} などのICU構文は対象外として判定しない。
 */
import { childPath } from "@/lib/json-structure-diff";

export type PlaceholderScan =
  | { status: "ok"; names: string[] }
  | { status: "icu" }
  | { status: "syntax" };

export function scanPlaceholders(text: string): PlaceholderScan {
  const names: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "'") {
      if (text[i + 1] === "'") {
        i++;
      } else if (text[i + 1] === "{" || text[i + 1] === "}") {
        const close = text.indexOf("'", i + 1);
        // 閉じていない場合は残りすべてが文字として扱われる
        i = close === -1 ? text.length : close;
      }
    } else if (char === "{") {
      const rest = text.slice(i);
      const simple = rest.match(/^\{\s*([A-Za-z0-9_]+)\s*\}/);
      if (simple) {
        names.push(simple[1]);
        i += simple[0].length - 1;
      } else if (/^\{\s*[A-Za-z0-9_]+\s*,/.test(rest)) {
        return { status: "icu" };
      } else {
        return { status: "syntax" };
      }
    } else if (char === "}") {
      return { status: "syntax" };
    }
  }
  return { status: "ok", names };
}

function kindOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export type PlaceholderIssue =
  | { kind: "missingKey" | "extraKey"; path: string }
  | { kind: "typeMismatch"; path: string; baseType: string; targetType: string }
  | { kind: "nonString"; path: string; type: string }
  | { kind: "unsupported" | "syntax"; path: string; side: "base" | "target" }
  | { kind: "placeholders"; path: string; missing: string[]; extra: string[] };

export type PlaceholderReport = { issues: PlaceholderIssue[]; checkedStrings: number };

function walk(base: unknown, target: unknown, path: string, report: PlaceholderReport) {
  const baseType = kindOf(base);
  const targetType = kindOf(target);
  if (baseType !== targetType) {
    report.issues.push({ kind: "typeMismatch", path, baseType, targetType });
    return;
  }
  if (baseType === "object" || baseType === "array") {
    const a = base as Record<string, unknown>;
    const b = target as Record<string, unknown>;
    const key = (k: string) => (baseType === "array" ? Number(k) : k);
    for (const k of Object.keys(a)) {
      if (Object.hasOwn(b, k)) walk(a[k], b[k], childPath(path, key(k)), report);
      else report.issues.push({ kind: "missingKey", path: childPath(path, key(k)) });
    }
    for (const k of Object.keys(b)) {
      if (!Object.hasOwn(a, k)) report.issues.push({ kind: "extraKey", path: childPath(path, key(k)) });
    }
    return;
  }
  if (baseType !== "string") {
    report.issues.push({ kind: "nonString", path, type: baseType });
    return;
  }

  report.checkedStrings++;
  const scans = { base: scanPlaceholders(base as string), target: scanPlaceholders(target as string) };
  for (const side of ["base", "target"] as const) {
    const scan = scans[side];
    if (scan.status !== "ok") {
      report.issues.push({ kind: scan.status === "icu" ? "unsupported" : "syntax", path, side });
      return;
    }
  }
  // 出現順序や回数は問わず、名前の集合で比較する
  const baseNames = new Set((scans.base as { names: string[] }).names);
  const targetNames = new Set((scans.target as { names: string[] }).names);
  const missing = [...baseNames].filter((name) => !targetNames.has(name));
  const extra = [...targetNames].filter((name) => !baseNames.has(name));
  if (missing.length > 0 || extra.length > 0) report.issues.push({ kind: "placeholders", path, missing, extra });
}

export function checkTranslations(base: unknown, target: unknown): PlaceholderReport {
  const report: PlaceholderReport = { issues: [], checkedStrings: 0 };
  walk(base, target, "$", report);
  return report;
}
