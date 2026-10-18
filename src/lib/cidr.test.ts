import { describe, expect, it } from "vitest";

import { cidrContains, formatIpv4, parseCidr, parseIpv4 } from "./cidr";

function info(text: string) {
  const result = parseCidr(text);
  if ("error" in result) throw new Error(result.error);
  return result.info;
}

describe("CIDR計算", () => {
  it("/24 のネットワーク範囲と包含判定", () => {
    const cidr = info("192.168.10.0/24");
    expect(formatIpv4(cidr.network)).toBe("192.168.10.0");
    expect(formatIpv4(cidr.last)).toBe("192.168.10.255");
    expect(formatIpv4(cidr.mask)).toBe("255.255.255.0");
    expect(cidr.total).toBe(256);
    expect(cidr.usable).toBe(254);
    expect(cidr.hasHostBits).toBe(false);
    expect(cidrContains(cidr, (parseIpv4("192.168.10.42") as { value: number }).value)).toBe(true);
    expect(cidrContains(cidr, (parseIpv4("192.168.11.1") as { value: number }).value)).toBe(false);
  });

  it("ホスト部を含む入力はネットワークアドレスに正規化する", () => {
    const cidr = info("10.1.2.3/8");
    expect(cidr.hasHostBits).toBe(true);
    expect(formatIpv4(cidr.network)).toBe("10.0.0.0");
    expect(formatIpv4(cidr.last)).toBe("10.255.255.255");
  });

  it("/0・/31・/32 の境界", () => {
    const all = info("1.2.3.4/0");
    expect(all.total).toBe(2 ** 32);
    expect(formatIpv4(all.network)).toBe("0.0.0.0");
    expect(formatIpv4(all.last)).toBe("255.255.255.255");
    expect(cidrContains(all, 0xffffffff)).toBe(true);

    const p2p = info("10.0.0.1/31");
    expect([p2p.total, p2p.usable, formatIpv4(p2p.firstHost), formatIpv4(p2p.lastHost)]).toEqual([2, 2, "10.0.0.0", "10.0.0.1"]);

    const host = info("10.0.0.1/32");
    expect([host.total, host.usable, formatIpv4(host.network)]).toEqual([1, 1, "10.0.0.1"]);
  });

  it.each([
    ["256.0.0.1/24", "octetRange"],
    ["10.0.0/24", "format"],
    ["10.0.0.01/24", "leadingZero"],
    ["10.0.0.1", "missingPrefix"],
    ["10.0.0.1/33", "prefixRange"],
    ["10.0.0.1/-1", "prefixRange"],
    ["10.0.0.1/24/1", "format"],
    ["::1/128", "format"],
  ])("%s は %s エラー", (text, error) => {
    expect(parseCidr(text)).toEqual({ error });
  });
});
