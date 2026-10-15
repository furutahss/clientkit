import { describe, expect, it } from "vitest";

import { computeAllHashes, HASH_ALGORITHMS } from "./hash";

describe("ハッシュ値の一括計算", () => {
  it("\"abc\" が各アルゴリズムの既知のハッシュ値と一致する", async () => {
    const hashes = await computeAllHashes(new TextEncoder().encode("abc"));

    expect(Object.keys(hashes).sort()).toEqual([...HASH_ALGORITHMS].sort());
    expect(hashes).toMatchObject({
      MD5: "900150983cd24fb0d6963f7d28e17f72",
      "SHA-1": "a9993e364706816aba3e25717850c26c9cd0d89d",
      "SHA-224": "23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7",
      "SHA-256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      "SHA3-256": "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532",
      "Keccak-256": "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45",
      "BLAKE2b-512":
        "ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923",
      "BLAKE2s-256": "508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982",
      BLAKE3: "6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85",
      "RIPEMD-160": "8eb208f7e05d987a9b044a8e98c6b087f15a0bfc",
      CRC32: "352441c2",
    });
  });
});
