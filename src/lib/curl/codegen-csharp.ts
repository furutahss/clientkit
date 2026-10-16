import type { ParsedCurl } from "@/lib/curl/parse";
import { contentType, fileName, headersForCode, quote } from "@/lib/curl/shared";

/** HttpContent 側に設定する必要があるヘッダー（HttpRequestMessage.Headers には追加できない） */
const CONTENT_HEADERS = new Set([
  "content-type",
  "content-encoding",
  "content-language",
  "content-disposition",
  "content-md5",
  "content-range",
  "expires",
  "last-modified",
  "allow",
]);

const STANDARD_METHODS: Record<string, string> = {
  GET: "HttpMethod.Get",
  POST: "HttpMethod.Post",
  PUT: "HttpMethod.Put",
  PATCH: "HttpMethod.Patch",
  DELETE: "HttpMethod.Delete",
  HEAD: "HttpMethod.Head",
  OPTIONS: "HttpMethod.Options",
};

/** C# 11 の生文字列リテラル（"""）。本文中の連続した " より長い区切りを使う */
export function rawStringLiteral(text: string, indent: string): string {
  const longest = Math.max(0, ...(text.match(/"+/g) ?? []).map((m) => m.length));
  const delimiter = '"'.repeat(Math.max(3, longest + 1));
  const body = text
    .split("\n")
    .map((line) => (line ? indent + line : line))
    .join("\n");
  return `${indent}${delimiter}\n${body}\n${indent}${delimiter}`;
}

/** C#（HttpClient）のコードを生成する */
export function generateCSharp(request: ParsedCurl): string {
  const usings = new Set(["System.Net", "System.Net.Http.Headers"]);
  const lines: string[] = [];
  const body = request.body;

  const handler = ["    AutomaticDecompression = DecompressionMethods.All,"];
  if (request.insecure) {
    handler.push("    // curl -k: certificate validation is disabled. Do not use in production.");
    handler.push("    ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator,");
  }
  lines.push("using var handler = new HttpClientHandler", "{", ...handler, "};", "using var client = new HttpClient(handler);", "");

  const method = STANDARD_METHODS[request.method] ?? `new HttpMethod(${quote(request.method)})`;
  lines.push(`using var request = new HttpRequestMessage(${method}, ${quote(request.url)});`);

  const headers = headersForCode(request);
  const contentHeaders = headers.filter(([name]) => CONTENT_HEADERS.has(name.toLowerCase()));
  for (const [name, value] of headers) {
    if (CONTENT_HEADERS.has(name.toLowerCase())) continue;
    lines.push(`request.Headers.TryAddWithoutValidation(${quote(name)}, ${quote(value)});`);
  }
  if (request.auth) {
    usings.add("System.Text");
    lines.push(
      `request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes(${quote(`${request.auth.user}:${request.auth.password}`)})));`
    );
  }

  if (body) {
    lines.push("");
    if (body.kind === "json") {
      lines.push(`request.Content = new StringContent(\n${rawStringLiteral(JSON.stringify(body.value, null, 2), "    ")});`);
      if (!contentHeaders.some(([name]) => name.toLowerCase() === "content-type")) {
        contentHeaders.push(["Content-Type", contentType(request, "application/json")]);
      }
    } else if (body.kind === "form") {
      const pairs = body.fields.map(([key, value]) => `    new KeyValuePair<string, string>(${quote(key)}, ${quote(value)}),`);
      lines.push(`request.Content = new FormUrlEncodedContent(new[]\n{\n${pairs.join("\n")}\n});`);
    } else if (body.kind === "multipart") {
      lines.push("var form = new MultipartFormDataContent();");
      for (const part of body.parts) {
        if (part.isFile) {
          lines.push(
            `form.Add(new StreamContent(File.OpenRead(${quote(part.value)})), ${quote(part.name)}, ${quote(part.filename ?? fileName(part.value))});`
          );
        } else {
          lines.push(`form.Add(new StringContent(${quote(part.value)}), ${quote(part.name)});`);
        }
      }
      lines.push("request.Content = form;");
    } else {
      lines.push(`request.Content = new StringContent(${quote(body.text)});`);
    }
    for (const [name, value] of contentHeaders) {
      lines.push(
        name.toLowerCase() === "content-type"
          ? `request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(${quote(value)});`
          : `request.Content.Headers.TryAddWithoutValidation(${quote(name)}, ${quote(value)});`
      );
    }
  }

  lines.push(
    "",
    "using var response = await client.SendAsync(request);",
    "var responseBody = await response.Content.ReadAsStringAsync();",
    "Console.WriteLine((int)response.StatusCode);",
    "Console.WriteLine(responseBody);"
  );
  return [...[...usings].sort().map((u) => `using ${u};`), "", ...lines].join("\n");
}
