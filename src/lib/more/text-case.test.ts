import { describe, expect, it } from "vitest";

import { CASES, singularize, splitWords } from "./text-case";

describe("ケース変換", () => {
  it("さまざまな表記を単語に分割する", () => {
    expect(splitWords("userId")).toEqual(["user", "Id"]);
    expect(splitWords("HTTPServerError")).toEqual(["HTTP", "Server", "Error"]);
    expect(splitWords("snake_case-and kebab")).toEqual(["snake", "case", "and", "kebab"]);
    expect(splitWords("version2Api")).toEqual(["version", "2", "Api"]);
  });
  it("各ケースに変換する", () => {
    const s = "get HTTP response_code";
    expect(CASES.camel(s)).toBe("getHttpResponseCode");
    expect(CASES.pascal(s)).toBe("GetHttpResponseCode");
    expect(CASES.snake(s)).toBe("get_http_response_code");
    expect(CASES.kebab(s)).toBe("get-http-response-code");
    expect(CASES.constant(s)).toBe("GET_HTTP_RESPONSE_CODE");
    expect(CASES.title(s)).toBe("Get Http Response Code");
    expect(CASES.sentence(s)).toBe("Get http response code");
  });
  it("単数形にする", () => {
    expect(["users", "categories", "boxes", "status", "data"].map(singularize)).toEqual(["user", "category", "box", "status", "data"]);
  });
});
