/**
 * Excel・ODSファイルの解析と変換を行うWeb Worker。
 * 解析結果のブックはWorker内に保持し、メインスレッドには表示に必要な分だけを返す。
 */
import { convert, convertAll, load, type SpreadsheetRequest } from "@/lib/spreadsheet-reader";

type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: "password" | "parse" };

function post(message: WorkerResponse, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(message, transfer);
}

self.onmessage = (event: MessageEvent<SpreadsheetRequest>) => {
  const request = event.data;
  try {
    if (request.type === "load") {
      post({ id: request.id, ok: true, result: load(request.data) });
    } else if (request.type === "convert") {
      const result = convert(request.sheet, request.table, request.output, request.previewRows);
      post({ id: request.id, ok: true, result }, [result.bytes.buffer]);
    } else {
      const files = convertAll(request.table, request.output);
      post(
        { id: request.id, ok: true, result: files },
        files.map((file) => file.data.buffer)
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // 暗号化されたOfficeファイル（ECMA-376）とパスワード付きの旧形式（.xls）だけを判定する
    const isPassword = /password-protected|ECMA-376 Encrypted|EncryptedPackage|EncryptionInfo/i.test(message);
    post({ id: request.id, ok: false, error: isPassword ? "password" : "parse" });
  }
};
