import { describe, expect, it } from "vitest";

import { decodeCbor, decodeMsgpack, encodeCbor, encodeMsgpack, type V } from "./binary-codecs";
import { hexToBytes } from "./util";

const hex = (h: string) => hexToBytes(h)!;
const sample: V = { a: 1, b: [1, 2, -5, 300, 70000, -200, 1.5], s: "héllo", ok: true, n: null, big: 4294967296 };

describe("MessagePack / CBOR", () => {
  it("MessagePackの既知データをデコードする", () => {
    expect(decodeMsgpack(hex("82 a1 61 01 a1 62 92 01 02"))).toEqual({ a: 1, b: [1, 2] });
    expect(decodeMsgpack(hex("cb 3ff199999999999a"))).toBe(1.1);
    expect(decodeMsgpack(hex("c4 02 dead"))).toEqual({ $binary: "dead" });
    expect(decodeMsgpack(hex("d6 ff 00000000"))).toBe("1970-01-01T00:00:00.000Z");
    expect(decodeMsgpack(hex("cf ffffffffffffffff"))).toBe("18446744073709551615");
  });

  it("CBORの既知データ（RFC 8949 付録A）をデコードする", () => {
    expect(decodeCbor(hex("a2 61 61 01 61 62 82 01 02"))).toEqual({ a: 1, b: [1, 2] });
    expect(decodeCbor(hex("fb 3ff199999999999a"))).toBe(1.1);
    expect(decodeCbor(hex("f9 3c00"))).toBe(1);
    expect(decodeCbor(hex("f9 c400"))).toBe(-4);
    expect(decodeCbor(hex("20"))).toBe(-1);
    expect(decodeCbor(hex("3903e7"))).toBe(-1000);
    expect(decodeCbor(hex("c1 1a514b67b0"))).toBe("2013-03-21T20:04:00.000Z");
    expect(decodeCbor(hex("9f 01 82 02 03 ff"))).toEqual([1, [2, 3]]);
    expect(decodeCbor(hex("1b 00000001 00000000"))).toBe(4294967296);
  });

  it("エンコードしてデコードすると元に戻る", () => {
    expect(decodeMsgpack(encodeMsgpack(sample))).toEqual(sample);
    expect(decodeCbor(encodeCbor(sample))).toEqual(sample);
    expect(encodeMsgpack({ a: 1, b: [1, 2] })).toEqual(hex("82 a1 61 01 a1 62 92 01 02"));
    expect(encodeCbor({ a: 1, b: [1, 2] })).toEqual(hex("a2 61 61 01 61 62 82 01 02"));
  });

  it("壊れたデータは例外にする", () => {
    expect(() => decodeMsgpack(hex("92 01"))).toThrow(/unexpected end/);
    expect(() => decodeCbor(hex("01 02"))).toThrow(/trailing/);
    expect(() => decodeMsgpack(hex("c1"))).toThrow(/invalid type/);
  });
});
