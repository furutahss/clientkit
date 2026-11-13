import { describe, expect, it } from "vitest";

import { floatFromHex, inspectFloat } from "./ieee754";

describe("IEEE 754", () => {
  it("0.1 の正確な値と構造（binary64）", () => {
    const i = inspectFloat(0.1, 64);
    expect(i.hex).toBe("3fb999999999999a");
    expect(i.exact).toBe("0.1000000000000000055511151231257827021181583404541015625");
    expect(i.exponentUnbiased).toBe(-4);
    expect(i.sign).toBe(0);
    expect(inspectFloat(0.1 + 0.2, 64).exact).toBe("0.3000000000000000444089209850062616169452667236328125");
  });

  it("binary32 と特殊値", () => {
    expect(inspectFloat(0.1, 32).hex).toBe("3dcccccd");
    expect(inspectFloat(0.1, 32).exact).toBe("0.100000001490116119384765625");
    expect(inspectFloat(-0, 64)).toMatchObject({ kind: "negative zero", exact: "-0", sign: 1 });
    expect(inspectFloat(Infinity, 64).kind).toBe("Infinity");
    expect(inspectFloat(NaN, 32).kind).toBe("NaN");
    expect(inspectFloat(5e-324, 64)).toMatchObject({ kind: "subnormal" });
    expect(inspectFloat(2 ** 70, 64).exact).toBe("1180591620717411303424");
  });

  it("16進から数値に戻せる", () => {
    expect(floatFromHex("3ff0000000000000", 64)).toBe(1);
    expect(floatFromHex("0x40490fdb", 32)).toBeCloseTo(Math.PI, 6);
    expect(floatFromHex("xyz", 64)).toBeNull();
    expect(floatFromHex("3ff00000000000000", 64)).toBeNull();
  });
});
