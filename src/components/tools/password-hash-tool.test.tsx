import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PasswordHashTool } from "./password-hash-tool";

describe("パスワードハッシュツール", () => {
  it("Argon2を初期選択し、OWASP推奨のパラメータを表示する", () => {
    const html = renderToStaticMarkup(createElement(PasswordHashTool));

    expect(html).toContain(">Argon2</button>");
    expect(html).toContain(">bcrypt</button>");
    expect(html).toContain(">scrypt</button>");
    expect(html).toContain(">PBKDF2</button>");
    expect(html).toMatch(/aria-pressed="true"[^>]*>Argon2id<\/button>/);
    expect(html).toContain('value="19456"');
  });
});
