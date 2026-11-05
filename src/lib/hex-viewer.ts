export const HEX_PAGE_SIZE = 1024;

export async function readHexPage(file: Blob, page: number): Promise<Uint8Array> {
  const start = page * HEX_PAGE_SIZE;
  return new Uint8Array(await file.slice(start, start + HEX_PAGE_SIZE).arrayBuffer());
}

export function formatHexDump(bytes: Uint8Array, offset = 0): string {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const row = bytes.subarray(i, i + 16);
    const hex = Array.from(row, (byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");
    const ascii = Array.from(row, (byte) => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".").join("");
    lines.push(`${(offset + i).toString(16).toUpperCase().padStart(8, "0")}  ${hex.padEnd(47, " ")}  |${ascii}|`);
  }
  return lines.join("\n");
}
