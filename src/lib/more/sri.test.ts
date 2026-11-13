import { describe, expect, it } from "vitest";

import { sriHash, sriTags } from "./sri";
import { utf8 } from "./util";

describe("SRIハッシュ", () => {
  it("既知のSHA-256（空文字列）と一致する", async () => {
    expect(await sriHash(utf8(""), "sha256")).toBe("sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=");
    expect((await sriHash(utf8("a"), "sha384")).startsWith("sha384-")).toBe(true);
  });
  it("タグを出力する", () => {
    expect(sriTags("https://x/a.js", "sha256-abc", "script")).toBe('<script src="https://x/a.js" integrity="sha256-abc" crossorigin="anonymous"></script>');
    expect(sriTags("https://x/a.css", "sha256-abc", "style")).toContain('rel="stylesheet"');
  });
});
