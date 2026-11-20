"use client";

import * as React from "react";
import { SafetyNote } from "@/components/tools/text-input-panel";
import { TextField, useT } from "@/components/tools/more/kit";
import { Button } from "@/components/ui/button";
import { downloadBytes } from "@/lib/download";
import { createUploadTestFile, MAX_UPLOAD_TEST_FILE_BYTES } from "@/lib/more/upload-test-file";

export function UploadTestFileGeneratorTool() {
  const { t } = useT();
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState("");
  const max = MAX_UPLOAD_TEST_FILE_BYTES.toLocaleString("en-US");

  function generate() {
    try {
      const { size, blob } = createUploadTestFile(input);
      downloadBytes(blob, `test-${size}-bytes.bin`, "application/octet-stream");
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message === "required" ? t("バイト数を入力してください。", "Enter a byte size.") : message === "format" ? t("半角数字のみを入力してください。", "Enter ASCII digits only.") : message === "range" ? t(`0〜${max} バイトを入力してください。`, `Enter a size from 0 to ${max} bytes.`) : t(`生成またはダウンロードを開始できませんでした: ${message}`, `Could not generate or start the download: ${message}`));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{t("ファイルはブラウザ内で生成され、送信されません。", "The file is generated in your browser and is not sent anywhere.")}</SafetyNote>
      <p className="text-sm text-muted-foreground">{t(`サイズはファイル単体のバイト数です。multipart の境界やヘッダーなどのオーバーヘッドは含みません。0〜${max} バイト（16 MiB）を指定できます。`, `The size is the file's own bytes only; it excludes multipart boundaries, headers, and other overhead. Enter 0 to ${max} bytes (16 MiB).`)}</p>
      <p className="text-sm text-muted-foreground">{t("ゼロ埋めのため圧縮後は小さくなります。圧縮後のサイズや特定の MIME タイプ・ファイルシグネチャの検証には別のデータを使用してください。", "Zero-filled files compress well. Use other data to test compressed size or behavior that depends on a specific MIME type or file signature.")}</p>
      <TextField id="upload-test-size" label={t("バイト数", "Size in bytes")} value={input} onChange={setInput} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div><Button type="button" onClick={generate}>{t("生成してダウンロード", "Generate and download")}</Button></div>
    </div>
  );
}
