import { describe, expect, it } from "vitest";

import { fluidClamp, pxToRem, remToPx, sizeAt } from "./css-units";

describe("CSS単位・clamp", () => {
  it("px と rem の変換", () => {
    expect(pxToRem(24)).toBe(1.5);
    expect(remToPx(0.875, 16)).toBe(14);
    expect(pxToRem(10, 10)).toBe(1);
  });

  it("フルードタイポグラフィの clamp() を作る", () => {
    expect(fluidClamp(16, 24, 320, 1280).css).toBe("clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)");
    expect(fluidClamp(16, 24, 320, 1280, 16, "px").css).toBe("clamp(16px, 13.3333px + 0.8333vw, 24px)");
    expect(fluidClamp(32, 16, 400, 1200).css).toBe("clamp(1rem, 2.5rem - 2vw, 2rem)");
    expect(() => fluidClamp(1, 2, 100, 100)).toThrow("same-viewport");
  });

  it("指定した幅でのサイズが、範囲内に収まる", () => {
    expect(sizeAt(16, 24, 320, 1280, 800)).toBe(20);
    expect(sizeAt(16, 24, 320, 1280, 100)).toBe(16);
    expect(sizeAt(16, 24, 320, 1280, 3000)).toBe(24);
  });
});
