/**
 * 整形・Minify を行う Web Worker。重い処理でも画面が固まらないよう、メインスレッドから切り離して実行する。
 */
import { gzipSync } from "fflate";

import { toErrorLocation } from "@/lib/code-format";
import { formatCode, type CodeFormatInput } from "@/lib/code-format-runner";

export type CodeFormatResult = {
  output: string;
  inputBytes: number;
  outputBytes: number;
  inputGzip: number;
  outputGzip: number;
};

function post(message: unknown) {
  (self as unknown as Worker).postMessage(message);
}

self.onmessage = async (event: MessageEvent<CodeFormatInput & { id: number }>) => {
  const request = event.data;
  try {
    const output = await formatCode(request);
    const encoder = new TextEncoder();
    const input = encoder.encode(request.code);
    const out = encoder.encode(output);
    const result: CodeFormatResult = {
      output,
      inputBytes: input.length,
      outputBytes: out.length,
      inputGzip: gzipSync(input, { level: 9 }).length,
      outputGzip: gzipSync(out, { level: 9 }).length,
    };
    post({ id: request.id, ok: true, result });
  } catch (error) {
    post({ id: request.id, ok: false, error: JSON.stringify(toErrorLocation(error)) });
  }
};
