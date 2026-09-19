const UNITS = ["B", "KB", "MB", "GB"] as const;

/** バイト数を人が読みやすい単位（B/KB/MB/GB）の文字列に変換する */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${UNITS[unitIndex]}`;
}
