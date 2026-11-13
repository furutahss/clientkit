import { describe, expect, it } from "vitest";

import { classifyIPv6, compressIPv6, expandIPv6, parseIPv6, parseIPv6Cidr, reverseDnsIPv6 } from "./ipv6";

describe("IPv6", () => {
  it("短縮・展開が相互に変換できる", () => {
    const v = parseIPv6("2001:0db8:0000:0000:0001:0000:0000:0001")!;
    expect(compressIPv6(v)).toBe("2001:db8::1:0:0:1");
    expect(expandIPv6(parseIPv6("::1")!)).toBe("0000:0000:0000:0000:0000:0000:0000:0001");
    expect(compressIPv6(parseIPv6("2001:db8:0:1:1:1:1:1")!)).toBe("2001:db8:0:1:1:1:1:1");
    expect(compressIPv6(parseIPv6("::ffff:192.0.2.1")!)).toBe("::ffff:c000:201");
  });

  it("不正な表記を拒否する", () => {
    for (const bad of ["1::2::3", "12345::", "1:2:3:4:5:6:7", "g::1", ""]) expect(parseIPv6(bad)).toBeNull();
  });

  it("CIDRの範囲と分類を計算する", () => {
    const c = parseIPv6Cidr("2001:db8:abcd:12::1/48")!;
    expect(compressIPv6(c.network)).toBe("2001:db8:abcd::");
    expect(compressIPv6(c.last)).toBe("2001:db8:abcd:ffff:ffff:ffff:ffff:ffff");
    expect(c.slash64s).toBe(65536n);
    expect(classifyIPv6(c.network)).toContain("documentation");
    expect(reverseDnsIPv6(parseIPv6("2001:db8::1")!).startsWith("1.0.0.0.")).toBe(true);
  });
});
