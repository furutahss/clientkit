export const MAX_UPLOAD_TEST_FILE_BYTES = 16 * 1024 * 1024;

export function createUploadTestFile(input: string): { size: number; blob: Blob } {
  const value = input.trim();
  if (!value) throw new Error("required");
  if (!/^[0-9]+$/.test(value)) throw new Error("format");
  const size = Number(value);
  if (size > MAX_UPLOAD_TEST_FILE_BYTES) throw new Error("range");
  return { size, blob: new Blob([new Uint8Array(size)], { type: "application/octet-stream" }) };
}
