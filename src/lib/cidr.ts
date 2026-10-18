/** IPv4のCIDR表記からネットワーク範囲を計算する（IPv6は対象外） */

export type Ipv4Error = "format" | "octetRange" | "leadingZero";
export type CidrError = Ipv4Error | "missingPrefix" | "prefixRange";

/** 先頭ゼロ（例: 010）は8進数と解釈する実装があるため、曖昧な表記として拒否する */
export function parseIpv4(text: string): { value: number } | { error: Ipv4Error } {
  const parts = text.trim().split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return { error: "format" };
  if (parts.some((part) => part.length > 1 && part.startsWith("0"))) return { error: "leadingZero" };
  const octets = parts.map(Number);
  if (octets.some((octet) => octet > 255)) return { error: "octetRange" };
  return { value: ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0 };
}

export function formatIpv4(value: number): string {
  return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");
}

export type CidrInfo = {
  address: number;
  prefix: number;
  network: number;
  /** 範囲の最終アドレス（/31・/32ではブロードキャストではない） */
  last: number;
  mask: number;
  wildcard: number;
  /** 範囲に含まれる全アドレス数 */
  total: number;
  /** ホストに割り当て可能な数（/31は2、/32は1、それ以外はネットワーク・ブロードキャストを除く） */
  usable: number;
  firstHost: number;
  lastHost: number;
  /** 入力にホスト部が含まれていた（ネットワークアドレスと一致しない） */
  hasHostBits: boolean;
};

export function parseCidr(text: string): { info: CidrInfo } | { error: CidrError } {
  const [addressText, prefixText, ...rest] = text.trim().split("/");
  if (rest.length > 0) return { error: "format" };
  const address = parseIpv4(addressText);
  if ("error" in address) return address;
  if (prefixText === undefined) return { error: "missingPrefix" };
  if (!/^\d{1,2}$/.test(prefixText) || Number(prefixText) > 32) return { error: "prefixRange" };

  const prefix = Number(prefixText);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const wildcard = ~mask >>> 0;
  const network = (address.value & mask) >>> 0;
  const last = (network | wildcard) >>> 0;
  const total = 2 ** (32 - prefix);
  const pointToPoint = prefix >= 31;
  return {
    info: {
      address: address.value,
      prefix,
      network,
      last,
      mask,
      wildcard,
      total,
      usable: pointToPoint ? total : total - 2,
      firstHost: pointToPoint ? network : network + 1,
      lastHost: pointToPoint ? last : last - 1,
      hasHostBits: network !== address.value,
    },
  };
}

export function cidrContains(info: CidrInfo, address: number): boolean {
  return ((address & info.mask) >>> 0) === info.network;
}
