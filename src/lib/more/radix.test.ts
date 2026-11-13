import { describe, expect, it } from "vitest";

import { bitOp, bitsString, fitsWidth, parseInteger, toBase, toSigned, toUnsigned } from "./radix";

describe("基数変換・ビット演算", () => {
  it("接頭辞・区切り・負数・桁あふれなしの大きな数を解析する", () => {
    expect(parseInteger("0xFF", 10)).toBe(255n);
    expect(parseInteger("0b1010_1010", 10)).toBe(170n);
    expect(parseInteger("-0o17", 10)).toBe(-15n);
    expect(parseInteger("zz", 36)).toBe(1295n);
    expect(parseInteger("18446744073709551615", 10)).toBe(2n ** 64n - 1n);
    expect(parseInteger("12", 2)).toBeNull();
    expect(parseInteger("", 10)).toBeNull();
  });

  it("基数変換と2の補数", () => {
    expect(toBase(255n, 2)).toBe("11111111");
    expect(toBase(-255n, 16)).toBe("-ff");
    expect(toSigned(255n, 8)).toBe(-1n);
    expect(toUnsigned(-1n, 16)).toBe(65535n);
    expect(bitsString(-2n, 8)).toBe("1111 1110");
    expect(fitsWidth(200n, 8)).toEqual({ unsigned: true, signed: false });
    expect(fitsWidth(-129n, 8)).toEqual({ unsigned: false, signed: false });
  });

  it("ビット演算", () => {
    expect(bitOp("and", 0b1100n, 0b1010n, 8)).toBe(0b1000n);
    expect(bitOp("or", 0b1100n, 0b1010n, 8)).toBe(0b1110n);
    expect(bitOp("xor", 0b1100n, 0b1010n, 8)).toBe(0b0110n);
    expect(bitOp("not", 0n, 0n, 8)).toBe(255n);
    expect(bitOp("shl", 0b1000_0001n, 1n, 8)).toBe(0b0000_0010n);
    expect(bitOp("shr", 0b1000_0000n, 7n, 8)).toBe(1n);
    expect(bitOp("sar", 0b1000_0000n, 7n, 8)).toBe(255n);
  });
});
