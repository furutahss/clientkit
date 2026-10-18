import { describe, expect, it } from "vitest";

import { parseOctal, parseSymbolic, toOctal, toSymbolic } from "./chmod";

describe("chmod変換", () => {
  it.each([
    ["000", "---------"],
    ["644", "rw-r--r--"],
    ["755", "rwxr-xr-x"],
    ["777", "rwxrwxrwx"],
    ["640", "rw-r-----"],
  ])("%s ⇔ %s", (octal, symbolic) => {
    const fromOctal = parseOctal(octal) as { bits: number };
    expect(toSymbolic(fromOctal.bits)).toBe(symbolic);
    const fromSymbolic = parseSymbolic(symbolic) as { bits: number };
    expect(toOctal(fromSymbolic.bits)).toBe(octal);
  });

  it("ls -l の10文字表記と先頭0の4桁を受け付ける", () => {
    expect(parseSymbolic("drwxr-x---")).toEqual({ bits: 0o750 });
    expect(parseOctal("0755")).toEqual({ bits: 0o755 });
  });

  it.each([
    ["789", "invalidChar"],
    ["75", "invalidLength"],
    ["7555", "specialBits"],
    ["abc", "invalidChar"],
  ])("8進数 %s は %s", (text, error) => {
    expect(parseOctal(text)).toEqual({ error });
  });

  it.each([
    ["rwxr-xr-", "invalidLength"],
    ["rxwr-xr-x", "invalidChar"],
    ["rwsr-xr-x", "specialBits"],
    ["rwxr-xr-T", "specialBits"],
  ])("rwx表記 %s は %s", (text, error) => {
    expect(parseSymbolic(text)).toEqual({ error });
  });
});
