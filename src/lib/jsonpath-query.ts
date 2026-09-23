/** jsonpath-plus は動的に読み込み、実行関数へ渡す */
export type JsonPathLibrary = typeof import("jsonpath-plus").JSONPath;

export async function loadJsonPathLibrary(): Promise<JsonPathLibrary> {
  const { JSONPath } = await import("jsonpath-plus");
  return JSONPath;
}

export type JsonPathMatch = {
  /** JSONPath形式の正規化されたパス（例: $['store']['book'][0]） */
  path: string;
  /** JSON Pointer形式のパス（例: /store/book/0） */
  pointer: string;
  value: unknown;
};

export type JsonPathResult =
  | { ok: true; matches: JsonPathMatch[] }
  | { ok: false; message: string };

/**
 * JSONPathを実行する。フィルター式（?()）はjsonpath-plusの安全な評価器で
 * 実行し、任意のJavaScriptが実行されないようにする。
 */
export function runJsonPath(JSONPath: JsonPathLibrary, data: unknown, path: string): JsonPathResult {
  try {
    const results = JSONPath({
      path,
      json: data as object,
      eval: "safe",
      resultType: "all",
      wrap: true,
    }) as { path: string; pointer: string; value: unknown }[] | undefined;
    return {
      ok: true,
      matches: (results ?? []).map(({ path: matchPath, pointer, value }) => ({
        path: matchPath,
        pointer,
        value,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      message: (error instanceof Error ? error.message : String(error)).replace(/^jsonPath:\s*/, ""),
    };
  }
}
