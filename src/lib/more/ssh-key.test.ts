import { describe, expect, it } from "vitest";

import { inspectSshKey } from "./ssh-key";

const ed = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMN6DOy78vemTqvts6cXx90mAIrQ9efWuTimou5jXCmC test@example";
const rsa = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDdP63FMelitDurxZxVYvh3xVJLJprfPLJKc3uJ/jgqg60AN57npglgNmovvFMTzha6l2xeBBOQmJYOp5ityhjoiU+4q1a5ySSBKhfVdZCLUNLnuMOtXGgWcpknBn8W6O6BCzkAXTnIVQjhMbycLkgGKxgBG6glki6pSgfgjHymIOZk17GuV6MKZKFtsKklu/XoP10M+Khe9Pm6KbAf1bMS05ER3wRde/ztAJ9qO0PyvjflXB/jej2dV1ta4tQ2Z86trScARH+xR2xeFLw6TQ7YWEfZAUZNISk7rGX+3CkkxK7e8MEwBlTa++BnQiPPaOO0Ev6QEe3mxyTCFcuGxjNv rsa@example";

describe("SSH公開鍵の解析", () => {
  it("ssh-keygen -l と同じフィンガープリントを出す", async () => {
    const e = await inspectSshKey(ed);
    expect(e).toMatchObject({ type: "ssh-ed25519", bits: 256, comment: "test@example", sha256: "SHA256:DekeG5zf2U0aZ1D0lY2jahbhI+/ynXNPTx57DZCOJPs", md5: "MD5:b5:ab:91:83:b1:89:11:13:c7:b2:05:b3:8f:e1:fb:da" });
    const r = await inspectSshKey(rsa);
    expect(r).toMatchObject({ type: "ssh-rsa", bits: 2048, sha256: "SHA256:aWF/3xtXm8O7di9J3tAPWHHSjlEburF0Lph3L1F0LFI" });
    expect(r.details).toEqual([["exponent", "65537"]]);
  });

  it("オプション付きの行を受け付け、不正な行を拒否する", async () => {
    expect((await inspectSshKey(`command="x",no-pty ${ed}`)).type).toBe("ssh-ed25519");
    await expect(inspectSshKey("hello")).rejects.toThrow("not-ssh-key");
    await expect(inspectSshKey("ssh-rsa AAAAC3NzaC1lZDI1NTE5AAAAIMN6DOy78vemTqvts6cXx90mAIrQ9efWuTimou5jXCmC")).rejects.toThrow("type-mismatch");
  });
});
