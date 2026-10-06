import { describe, expect, it } from "vitest";

import { generators, maskRequest, parseCurl, type TargetLanguage } from "@/lib/curl";
import { rawStringLiteral } from "@/lib/curl/codegen-csharp";
import { shellQuote } from "@/lib/curl/codegen-curl";
import { toPythonLiteral } from "@/lib/curl/codegen-python";
import { encodeDataUrlencode, parseFormBody, splitUrl } from "@/lib/curl/parse";
import { isCmdSyntax, tokenizeBash, tokenizeCmd } from "@/lib/curl/tokenize";

const CHROME_BASH = String.raw`curl 'https://api.example.com/v1/items?page=2&api_key=abc123' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig' \
  -H 'content-type: application/json' \
  -b 'session=s3cr3t; theme=dark' \
  -H 'user-agent: Mozilla/5.0' \
  --data-raw $'{"name":"テスト","note":"it\'s ok","tags":["a","b"],"active":true,"count":null}' \
  --compressed`;

const CHROME_CMD = String.raw`curl ^"https://api.example.com/v1/search?q=a^%^20b^&lang=ja^" ^
  -H ^"accept: application/json^" ^
  -H ^"content-type: application/json^" ^
  --data-raw ^"^{^\^"query^\^":^\^"東京^\^",^\^"limit^\^":10^}^" ^
  --compressed`;

const FIREFOX = `curl 'https://example.com/login' -X POST -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0' -H 'Accept: */*' -H 'Content-Type: application/x-www-form-urlencoded' --data-raw 'user=taro&password=p%40ss&remember=1'`;

const POSTMAN = `curl --location 'https://api.example.com/upload' \\
--header 'X-API-Key: k-123' \\
--form 'file=@"/path/to/photo 1.png"' \\
--form 'title="hello world"'`;

describe("tokenize", () => {
  it("bash形式のクォート・エスケープ・行継続", () => {
    expect(tokenizeBash(`curl 'a b' "c \\"d\\" \\$e" f\\ g \\\n  -H x`)).toEqual(["curl", "a b", 'c "d" $e', "f g", "-H", "x"]);
    expect(tokenizeBash("curl $'line1\\nline2\\t\\'q\\' \\x41\\u3042'")).toEqual(["curl", "line1\nline2\t'q' Aあ"]);
    expect(tokenizeBash("curl 'it'\\''s'")).toEqual(["curl", "it's"]);
    expect(tokenizeBash('curl "" x')).toEqual(["curl", "", "x"]);
  });

  it("閉じていないクォートはエラー", () => {
    expect(() => tokenizeBash("curl 'abc")).toThrow();
    expect(() => tokenizeBash('curl "abc')).toThrow();
  });

  it("コマンドプロンプト形式（^ によるエスケープ）", () => {
    expect(isCmdSyntax(CHROME_CMD)).toBe(true);
    expect(isCmdSyntax(CHROME_BASH)).toBe(false);
    expect(tokenizeCmd('curl ^"a^&b^" ^\n -H "x: \\"y\\""')).toEqual(["curl", "a&b", "-H", 'x: "y"']);
  });
});

describe("parseCurl", () => {
  it("Chrome（bash）の cURL を解析する", () => {
    const result = parseCurl(CHROME_BASH);
    expect(result.method).toBe("POST");
    expect(result.url).toBe("https://api.example.com/v1/items?page=2&api_key=abc123");
    expect(result.headers).toContainEqual(["Cookie", "session=s3cr3t; theme=dark"]);
    expect(result.body).toMatchObject({ kind: "json", value: { name: "テスト", note: "it's ok", active: true, count: null } });
    expect(result.compressed).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("Chrome（cmd）の cURL を解析する", () => {
    const result = parseCurl(CHROME_CMD);
    expect(result.url).toBe("https://api.example.com/v1/search?q=a%20b&lang=ja");
    expect(result.body).toMatchObject({ kind: "json", value: { query: "東京", limit: 10 } });
    expect(result.headers).toEqual([
      ["accept", "application/json"],
      ["content-type", "application/json"],
    ]);
  });

  it("Firefox の cURL（フォーム送信）を解析する", () => {
    const result = parseCurl(FIREFOX);
    expect(result.method).toBe("POST");
    expect(result.body).toEqual({
      kind: "form",
      text: "user=taro&password=p%40ss&remember=1",
      fields: [
        ["user", "taro"],
        ["password", "p@ss"],
        ["remember", "1"],
      ],
    });
  });

  it("Postman の cURL（multipart）を解析する", () => {
    const result = parseCurl(POSTMAN);
    expect(result.followRedirects).toBe(true);
    expect(result.body).toEqual({
      kind: "multipart",
      parts: [
        { name: "file", value: "/path/to/photo 1.png", isFile: true },
        { name: "title", value: "hello world", isFile: false },
      ],
    });
    expect(result.method).toBe("POST");
  });

  it("各オプションに対応する", () => {
    const result = parseCurl(
      `curl -sSLk -XPUT --url example.com/api -u admin:p:w -A 'MyAgent/1.0' -e https://ref.example -H 'X-Empty;' -F 'avatar=@me.jpg;type=image/jpeg;filename=a.jpg'`
    );
    expect(result.method).toBe("PUT");
    expect(result.url).toBe("http://example.com/api");
    expect(result.auth).toEqual({ user: "admin", password: "p:w" });
    expect(result.followRedirects).toBe(true);
    expect(result.insecure).toBe(true);
    expect(result.headers).toEqual([
      ["User-Agent", "MyAgent/1.0"],
      ["Referer", "https://ref.example"],
      ["X-Empty", ""],
    ]);
    expect(result.body).toEqual({
      kind: "multipart",
      parts: [{ name: "avatar", value: "me.jpg", isFile: true, contentType: "image/jpeg", filename: "a.jpg" }],
    });
    expect(result.warnings).toEqual([
      { option: "-s", reason: "unsupported" },
      { option: "-S", reason: "unsupported" },
    ]);
  });

  it("-G はデータをクエリに付け、--data-urlencode をエンコードする", () => {
    const result = parseCurl(`curl -G https://example.com/search -d q=1 --data-urlencode 'name=山田 太郎' --data-urlencode 'a&b'`);
    expect(result.method).toBe("GET");
    expect(result.body).toBeNull();
    expect(result.url).toBe("https://example.com/search?q=1&name=%E5%B1%B1%E7%94%B0%20%E5%A4%AA%E9%83%8E&a%26b");
  });

  it("-d は改行を除き、複数指定は & でつなぐ", () => {
    const result = parseCurl("curl https://e.com -d $'a=1\\n' -d b=2");
    expect(result.body).toMatchObject({ kind: "form", text: "a=1&b=2" });
    expect(parseCurl("curl https://e.com --data-binary $'line1\\nline2'").body).toEqual({ kind: "raw", text: "line1\nline2" });
  });

  it("未対応のオプション・ファイル参照は警告にする", () => {
    const result = parseCurl("curl -o out.json --max-time 10 -v https://e.com -d @body.json -b cookies.txt");
    expect(result.warnings).toEqual([
      { option: "-o out.json", reason: "unsupported" },
      { option: "--max-time 10", reason: "unsupported" },
      { option: "-v", reason: "unsupported" },
      { option: "-d @body.json", reason: "file" },
      { option: "-b cookies.txt", reason: "file" },
    ]);
  });

  it("エラー", () => {
    expect(() => parseCurl("")).toThrow("empty");
    expect(() => parseCurl("wget https://e.com")).toThrow("notCurl");
    expect(() => parseCurl("curl -H 'a: b'")).toThrow("noUrl");
    expect(() => parseCurl("curl 'https://e.com")).toThrow("unterminatedQuote");
  });

  it("先頭の $ プロンプトと curl.exe を許容する", () => {
    expect(parseCurl("$ curl https://e.com").url).toBe("https://e.com");
    expect(parseCurl("curl.exe https://e.com").url).toBe("https://e.com");
  });
});

describe("補助関数", () => {
  it("フォーム・クエリ・URLエンコード", () => {
    expect(parseFormBody("a=1&b=x+y&c=%E3%81%82")).toEqual([
      ["a", "1"],
      ["b", "x y"],
      ["c", "あ"],
    ]);
    expect(parseFormBody("not form")).toBeNull();
    expect(splitUrl("https://e.com/p?a=1&b=%20x#frag")).toEqual({ base: "https://e.com/p", query: [["a", "1"], ["b", " x"]] });
    expect(encodeDataUrlencode("=a b")).toBe("a%20b");
    expect(encodeDataUrlencode("x=(1)")).toBe("x=%281%29");
  });

  it("言語ごとのリテラル", () => {
    expect(toPythonLiteral({ a: [true, null, 1.5], b: {} })).toBe('{\n    "a": [\n        True,\n        None,\n        1.5,\n    ],\n    "b": {},\n}');
    expect(rawStringLiteral('{"a": """x"""}', "  ")).toBe('  """"\n  {"a": """x"""}\n  """"');
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
    expect(shellQuote("https://e.com/a")).toBe("https://e.com/a");
  });
});

describe("maskRequest", () => {
  it("認証ヘッダー・Cookie・APIキーをプレースホルダにする", () => {
    const masked = maskRequest({ ...parseCurl(CHROME_BASH), auth: { user: "u", password: "p" } });
    expect(masked.url).toBe("https://api.example.com/v1/items?page=2&api_key=<TOKEN>");
    expect(masked.headers).toContainEqual(["authorization", "Bearer <TOKEN>"]);
    expect(masked.headers).toContainEqual(["Cookie", "session=<COOKIE>; theme=<COOKIE>"]);
    expect(masked.headers).toContainEqual(["accept", "application/json"]);
    expect(masked.auth).toEqual({ user: "<USER>", password: "<PASSWORD>" });
    expect(maskRequest(parseCurl(POSTMAN)).headers).toEqual([["X-API-Key", "<TOKEN>"]]);
  });
});

describe("cURL の再生成", () => {
  it.each([CHROME_BASH, CHROME_CMD, FIREFOX, POSTMAN])("再生成した cURL を解析すると同じ内容になる (%#)", (input) => {
    const parsed = parseCurl(input);
    const reparsed = parseCurl(generators.curl(parsed));
    expect({ ...reparsed, warnings: [] }).toEqual({ ...parsed, warnings: [] });
  });
});

describe("コード生成（スナップショット）", () => {
  const languages: TargetLanguage[] = ["fetch", "axios", "python", "csharp", "go", "curl"];
  const samples = {
    chromeBash: CHROME_BASH,
    chromeCmd: CHROME_CMD,
    firefoxForm: FIREFOX,
    postmanMultipart: POSTMAN,
    basicAuthInsecure: "curl -k -u admin:secret -X DELETE 'https://e.com/items/1'",
    rawText: "curl https://e.com/log -H 'Content-Type: text/plain' --data-binary $'line1\\nline2'",
  };
  for (const [name, input] of Object.entries(samples)) {
    for (const language of languages) {
      it(`${name} → ${language}`, () => {
        expect(generators[language](parseCurl(input))).toMatchSnapshot();
      });
    }
  }
  it("マスキング後のコード", () => {
    expect(generators.python(maskRequest(parseCurl(CHROME_BASH)))).toMatchSnapshot();
  });
});
