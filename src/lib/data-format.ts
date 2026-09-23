/** JSON・YAML・TOMLの相互変換（エラー位置の特定を含む） */

import { locateJsonError } from "@/lib/json-error";

/** yaml・smol-toml は動的に読み込み、変換関数へ渡す */
export type FormatLibraries = {
  YAML: Pick<typeof import("yaml"), "parse" | "stringify" | "YAMLError">;
  toml: Pick<typeof import("smol-toml"), "parse" | "stringify">;
};

export async function loadFormatLibraries(): Promise<FormatLibraries> {
  const [yaml, toml] = await Promise.all([import("yaml"), import("smol-toml")]);
  return { YAML: yaml, toml };
}

export type DataFormat = "json" | "yaml" | "toml";

export type FormatErrorInfo = {
  /** 1始まりの行番号（特定できない場合はnull） */
  line: number | null;
  column: number | null;
  message: string;
};

export type ConvertWarning = "null-dropped" | "bigint-as-string";

export type ConvertResult =
  | { ok: true; output: string; warnings: ConvertWarning[] }
  | { ok: false; stage: "parse" | "stringify"; error: FormatErrorInfo };

export function detectFormatFromFileName(name: string): DataFormat | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "json") return "json";
  if (ext === "yaml" || ext === "yml") return "yaml";
  if (ext === "toml") return "toml";
  return null;
}

function firstLine(message: string): string {
  return message.split("\n")[0].replace(/^Invalid TOML document:\s*/, "").trim();
}

function parseInput(libs: FormatLibraries, input: string, format: DataFormat): unknown {
  if (format === "json") return JSON.parse(input);
  if (format === "yaml") return libs.YAML.parse(input, { intAsBigInt: false, uniqueKeys: true });
  return libs.toml.parse(input, { integersAsBigInt: "asNeeded" });
}

function toErrorInfo(
  libs: FormatLibraries,
  input: string,
  format: DataFormat,
  error: unknown
): FormatErrorInfo {
  if (format === "json") {
    const location = locateJsonError(input, error);
    return { line: location.line, column: location.column, message: location.message };
  }
  if (format === "yaml" && error instanceof libs.YAML.YAMLError) {
    const position = error.linePos?.[0];
    return {
      line: position?.line ?? null,
      column: position?.col ?? null,
      message: firstLine(error.message).replace(/ at line \d+, column \d+:?$/, ""),
    };
  }
  if (error && typeof error === "object" && "line" in error && "column" in error) {
    const { line, column } = error as { line: number; column: number };
    return {
      line,
      column,
      message: firstLine(error instanceof Error ? error.message : String(error)),
    };
  }
  return {
    line: null,
    column: null,
    message: firstLine(error instanceof Error ? error.message : String(error)),
  };
}

function containsNull(value: unknown): boolean {
  if (value === null) return true;
  if (Array.isArray(value)) return value.some(containsNull);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.values(value).some(containsNull);
  }
  return false;
}

/**
 * 出力形式に合わせて値を整える。
 * TOMLの日時はISO形式の文字列に、JSONで表現できない大きな整数は文字列にする。
 */
function normalize(value: unknown, target: DataFormat, warnings: Set<ConvertWarning>): unknown {
  if (value instanceof Date) {
    return target === "toml" ? value : value.toISOString();
  }
  if (typeof value === "bigint") {
    if (target === "json") {
      warnings.add("bigint-as-string");
      return value.toString();
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => normalize(item, target, warnings));
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = normalize(child, target, warnings);
    }
    return output;
  }
  return value;
}

export function convertData(
  libs: FormatLibraries,
  input: string,
  from: DataFormat,
  to: DataFormat,
  indent: number
): ConvertResult {
  let data: unknown;
  try {
    data = parseInput(libs, input, from);
  } catch (error) {
    return { ok: false, stage: "parse", error: toErrorInfo(libs, input, from, error) };
  }

  const warnings = new Set<ConvertWarning>();
  const normalized = normalize(data, to, warnings);

  try {
    let output: string;
    if (to === "json") {
      output = JSON.stringify(normalized, null, indent);
    } else if (to === "yaml") {
      output = libs.YAML.stringify(normalized, { indent, lineWidth: 0 });
    } else {
      if (normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) {
        return {
          ok: false,
          stage: "stringify",
          error: { line: null, column: null, message: "toml-root" },
        };
      }
      // TOMLにはnullがないため、null値の項目は出力から除外される
      if (containsNull(normalized)) warnings.add("null-dropped");
      output = libs.toml.stringify(normalized);
    }
    return { ok: true, output: output ?? "", warnings: Array.from(warnings) };
  } catch (error) {
    return {
      ok: false,
      stage: "stringify",
      error: {
        line: null,
        column: null,
        message: firstLine(error instanceof Error ? error.message : String(error)),
      },
    };
  }
}
