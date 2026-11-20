import { describe, expect, it } from "vitest";
import { createUploadTestFile, MAX_UPLOAD_TEST_FILE_BYTES } from "./upload-test-file";

describe("upload test file", () => {
  it("generates zero-filled blobs at the boundaries", async () => {
    for (const size of [0, 1, MAX_UPLOAD_TEST_FILE_BYTES]) {
      const { blob, size: actual } = createUploadTestFile(String(size));
      expect(actual).toBe(size);
      expect(blob.size).toBe(size);
      expect(blob.type).toBe("application/octet-stream");
      if (size === 1) expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0]);
    }
  });
  it("accepts surrounding whitespace and normalizes leading zeros", () => {
    expect(createUploadTestFile(" \t\n　0001　 ").size).toBe(1);
  });
  it("rejects empty, invalid, and out-of-range input", () => {
    for (const input of ["", " \t　\n", "１", "1 0", "1.0", "-1", "+1", "1e2", "1,000", "1B", String(MAX_UPLOAD_TEST_FILE_BYTES + 1)]) {
      expect(() => createUploadTestFile(input)).toThrow();
    }
  });
});
