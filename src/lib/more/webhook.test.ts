import { describe, expect, it } from "vitest";

import { checkWebhook } from "./webhook";

const msg = "The quick brown fox jumps over the lazy dog";
const sig = "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8";

describe("Webhook署名検証", () => {
  it("HMAC-SHA256の既知ベクトルと一致する", async () => {
    const r = await checkWebhook({ provider: "generic", secret: "key", payload: msg, signature: "sha256=" + sig });
    expect(r.computed).toBe(sig);
    expect(r.match).toBe(true);
    expect((await checkWebhook({ provider: "generic", secret: "key2", payload: msg, signature: sig })).match).toBe(false);
    expect((await checkWebhook({ provider: "generic", secret: "key", payload: msg, signature: "" })).match).toBeNull();
  });

  it("GitHub / Stripe / Slack の署名対象を組み立てる", async () => {
    const gh = await checkWebhook({ provider: "github", secret: "key", payload: msg, signature: "sha256=" + sig });
    expect(gh.match).toBe(true);
    const computed = (await checkWebhook({ provider: "stripe", secret: "s", payload: "{}", signature: "t=1700000000,v1=x", now: 1700000100_000 })).computed;
    const st = await checkWebhook({ provider: "stripe", secret: "s", payload: "{}", signature: `t=1700000000,v1=${computed}`, now: 1700000100_000 });
    expect(st).toMatchObject({ match: true, signedPayload: "1700000000.{}", notes: [] });
    const stale = await checkWebhook({ provider: "stripe", secret: "s", payload: "{}", signature: `t=1700000000,v1=${computed}`, now: 1700009999_000 });
    expect(stale.notes).toEqual(["stale-timestamp"]);
    const sl = await checkWebhook({ provider: "slack", secret: "s", payload: "a=b", signature: "v0=00", timestamp: "5", now: 5000 });
    expect(sl.signedPayload).toBe("v0:5:a=b");
  });
});
