/** ブラウザ内で生成したデータをダウンロードさせるためのユーティリティ */

/** 複数のファイルをZIPにまとめる（fflateを動的に読み込む） */
export async function createZip(
  entries: { name: string; data: Uint8Array }[]
): Promise<Uint8Array> {
  const { zipSync } = await import("fflate");
  const record: Record<string, Uint8Array> = {};
  for (const entry of entries) {
    let name = entry.name;
    let suffix = 2;
    while (record[name]) {
      const dot = entry.name.lastIndexOf(".");
      name =
        dot > 0
          ? `${entry.name.slice(0, dot)} (${suffix})${entry.name.slice(dot)}`
          : `${entry.name} (${suffix})`;
      suffix += 1;
    }
    record[name] = entry.data;
  }
  return zipSync(record, { level: 6 });
}

/** バイト列をファイルとしてダウンロードさせる */
export function downloadBytes(
  data: Uint8Array | Blob,
  fileName: string,
  mimeType: string
): void {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data as Uint8Array<ArrayBuffer>], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
