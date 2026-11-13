import { describe, expect, it } from "vitest";

import { authResults, decodeMimeWords, domainOf, parseMailHeaders, parseReceived } from "./email-header";

const raw = `Received: from b.example (b.example [2.2.2.2]) by mx.example with ESMTPS; Tue, 3 Nov 2026 10:00:30 +0000
Received: from a.example by b.example with SMTP; Tue, 3 Nov 2026 10:00:00 +0000
Authentication-Results: mx.example; spf=pass smtp.mailfrom=a.example;
 dkim=fail header.d=a.example; dmarc=fail
Subject: =?UTF-8?B?44GT44KT44Gr44Gh44Gv?=
From: A <a@Example.com>

body`;

describe("メールヘッダー解析", () => {
  const h = parseMailHeaders(raw);
  it("Receivedを古い順に並べ、遅延を計算する", () => {
    const hops = parseReceived(h);
    expect(hops.map((x) => x.by)).toEqual(["b.example", "mx.example"]);
    expect(hops[1].delaySec).toBe(30);
  });
  it("認証結果・件名・ドメインを読み取る", () => {
    expect(authResults(h)).toEqual([{ method: "spf", result: "pass" }, { method: "dkim", result: "fail" }, { method: "dmarc", result: "fail" }]);
    expect(decodeMimeWords(h.find((x) => x.name === "Subject")!.value)).toBe("こんにちは");
    expect(decodeMimeWords("=?UTF-8?Q?caf=C3=A9_au_lait?=")).toBe("café au lait");
    expect(domainOf("A <a@Example.com>")).toBe("example.com");
  });
});
