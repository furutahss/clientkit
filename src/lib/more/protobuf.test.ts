import { describe, expect, it } from "vitest";

import { decodeProtobuf, formatProtobuf } from "./protobuf";
import { hexToBytes } from "./util";

const hex = (h: string) => hexToBytes(h)!;

describe("Protobufワイヤー形式", () => {
  it("公式ドキュメントの例（field 1 = 150）", () => {
    const [f] = decodeProtobuf(hex("08 96 01"));
    expect(f).toMatchObject({ num: 1, wire: 0 });
    expect(f.interp[0]).toBe("uint: 150");
  });

  it("文字列・埋め込みメッセージ・固定長を解釈する", () => {
    const f = decodeProtobuf(hex("12 07 74 65 73 74 69 6e 67 1a 03 08 96 01 25 00 00 80 3f"));
    expect(f[0].interp[0]).toBe('string: "testing"');
    expect(f[1].nested?.[0].interp[0]).toBe("uint: 150");
    expect(f[2].interp).toContain("float: 1");
    expect(formatProtobuf(f)).toContain("  1: [varint] uint: 150");
  });

  it("zigzagと壊れたデータ", () => {
    expect(decodeProtobuf(hex("08 03"))[0].interp[1]).toBe("sint (zigzag): -2");
    expect(() => decodeProtobuf(hex("12 05 61"))).toThrow(/truncated/);
    expect(() => decodeProtobuf(hex("00 01"))).toThrow(/field number 0/);
    expect(() => decodeProtobuf(hex("0b"))).toThrow(/unsupported wire type/);
  });
});
