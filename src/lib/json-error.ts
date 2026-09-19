export type JsonErrorLocation = {
  line: number;
  column: number;
  message: string;
};

class JsonScanError extends Error {
  index: number;

  constructor(message: string, index: number) {
    super(message);
    this.index = index;
  }
}

function indexToLineColumn(
  input: string,
  index: number
): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(index, input.length));
  const before = input.slice(0, clamped);
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/**
 * JSON.parseのエラーメッセージはJSエンジンによって形式が異なるため、
 * 独自の簡易パーサーでエラー位置を特定する。
 */
function findErrorIndex(input: string): { index: number; message: string } | null {
  let i = 0;
  const len = input.length;

  const isDigit = (ch: string | undefined) => !!ch && ch >= "0" && ch <= "9";
  const isWhitespace = (ch: string | undefined) =>
    ch === " " || ch === "\t" || ch === "\n" || ch === "\r";

  function skipWhitespace() {
    while (i < len && isWhitespace(input[i])) i++;
  }

  function fail(message: string, at: number = i): never {
    throw new JsonScanError(message, at);
  }

  function parseValue(): void {
    skipWhitespace();
    if (i >= len) fail("値が必要です");
    const ch = input[i];
    if (ch === "{") return parseObject();
    if (ch === "[") return parseArray();
    if (ch === '"') return parseString();
    if (ch === "-" || isDigit(ch)) return parseNumber();
    if (input.startsWith("true", i)) {
      i += 4;
      return;
    }
    if (input.startsWith("false", i)) {
      i += 5;
      return;
    }
    if (input.startsWith("null", i)) {
      i += 4;
      return;
    }
    fail(`予期しないトークンです: '${ch}'`);
  }

  function parseObject(): void {
    i++; // {
    skipWhitespace();
    if (input[i] === "}") {
      i++;
      return;
    }
    for (;;) {
      skipWhitespace();
      if (input[i] !== '"') fail("プロパティ名は文字列である必要があります");
      parseString();
      skipWhitespace();
      if (input[i] !== ":") fail("':' が必要です");
      i++;
      parseValue();
      skipWhitespace();
      if (input[i] === ",") {
        i++;
        continue;
      }
      if (input[i] === "}") {
        i++;
        return;
      }
      fail("',' または '}' が必要です");
    }
  }

  function parseArray(): void {
    i++; // [
    skipWhitespace();
    if (input[i] === "]") {
      i++;
      return;
    }
    for (;;) {
      parseValue();
      skipWhitespace();
      if (input[i] === ",") {
        i++;
        continue;
      }
      if (input[i] === "]") {
        i++;
        return;
      }
      fail("',' または ']' が必要です");
    }
  }

  function parseString(): void {
    const start = i;
    i++; // opening quote
    while (i < len) {
      const ch = input[i];
      if (ch === '"') {
        i++;
        return;
      }
      if (ch === "\\") {
        i++;
        if (i >= len) fail("文字列が閉じられていません", start);
        const esc = input[i];
        if (esc === "u") {
          const hex = input.slice(i + 1, i + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            fail("不正なユニコードエスケープです", i - 1);
          }
          i += 5;
        } else if ('"\\/bfnrt'.includes(esc)) {
          i++;
        } else {
          fail(`不正なエスケープシーケンスです: \\${esc}`, i - 1);
        }
        continue;
      }
      if (ch.charCodeAt(0) < 0x20) fail("制御文字を含む不正な文字列です");
      i++;
    }
    fail("文字列が閉じられていません", start);
  }

  function parseNumber(): void {
    const start = i;
    if (input[i] === "-") i++;
    if (input[i] === "0") {
      i++;
    } else if (isDigit(input[i])) {
      while (isDigit(input[i])) i++;
    } else {
      fail("不正な数値です", start);
    }
    if (input[i] === ".") {
      i++;
      if (!isDigit(input[i])) fail("不正な数値です", start);
      while (isDigit(input[i])) i++;
    }
    if (input[i] === "e" || input[i] === "E") {
      i++;
      if (input[i] === "+" || input[i] === "-") i++;
      if (!isDigit(input[i])) fail("不正な数値です", start);
      while (isDigit(input[i])) i++;
    }
  }

  try {
    parseValue();
    skipWhitespace();
    if (i < len) fail("末尾に余分な文字があります");
    return null;
  } catch (error) {
    if (error instanceof JsonScanError) {
      return { index: error.index, message: error.message };
    }
    return null;
  }
}

/** JSON.parseが投げたSyntaxErrorから、エラー位置（行・列）とメッセージを特定する */
export function locateJsonError(
  input: string,
  error: unknown
): JsonErrorLocation {
  const fallbackMessage = error instanceof Error ? error.message : String(error);

  const scanResult = findErrorIndex(input);
  if (scanResult) {
    const { line, column } = indexToLineColumn(input, scanResult.index);
    return { line, column, message: scanResult.message };
  }

  const positionMatch = fallbackMessage.match(/position (\d+)/);
  if (positionMatch) {
    const { line, column } = indexToLineColumn(
      input,
      Number(positionMatch[1])
    );
    return { line, column, message: fallbackMessage };
  }

  return { line: 1, column: 1, message: fallbackMessage };
}
