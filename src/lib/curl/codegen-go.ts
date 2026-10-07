import type { ParsedCurl } from "@/lib/curl/parse";
import { fileName, headersForCode, quote } from "@/lib/curl/shared";

/**
 * JSONボディ用の文字列リテラル。読みやすさのためバッククォートの生文字列を使う
 * （関数内の字下げが各行に付くが、JSONの空白なので意味は変わらない）
 */
function goJsonString(value: string): string {
  return value.includes("`") ? quote(value) : `\`${value}\``;
}

/** Go（net/http）のコードを生成する */
export function generateGo(request: ParsedCurl): string {
  const imports = new Set(["fmt", "io", "log", "net/http"]);
  const body: string[] = [];
  const req = request.body;
  let bodyVar = "nil";

  if (req?.kind === "json") {
    imports.add("strings");
    body.push(`body := strings.NewReader(${goJsonString(JSON.stringify(req.value, null, 2))})`);
    bodyVar = "body";
  } else if (req?.kind === "form") {
    imports.add("net/url").add("strings");
    body.push("form := url.Values{}");
    for (const [key, value] of req.fields) body.push(`form.Add(${quote(key)}, ${quote(value)})`);
    body.push("body := strings.NewReader(form.Encode())");
    bodyVar = "body";
  } else if (req?.kind === "multipart") {
    imports.add("bytes").add("mime/multipart");
    body.push("body := &bytes.Buffer{}", "writer := multipart.NewWriter(body)");
    for (const part of req.parts) {
      if (part.isFile) {
        imports.add("os");
        body.push(
          "{",
          `\tfile, err := os.Open(${quote(part.value)})`,
          "\tif err != nil {\n\t\tlog.Fatal(err)\n\t}",
          "\tdefer file.Close()",
          `\tpart, err := writer.CreateFormFile(${quote(part.name)}, ${quote(part.filename ?? fileName(part.value))})`,
          "\tif err != nil {\n\t\tlog.Fatal(err)\n\t}",
          "\tif _, err := io.Copy(part, file); err != nil {\n\t\tlog.Fatal(err)\n\t}",
          "}"
        );
      } else {
        body.push(`if err := writer.WriteField(${quote(part.name)}, ${quote(part.value)}); err != nil {\n\tlog.Fatal(err)\n}`);
      }
    }
    body.push("if err := writer.Close(); err != nil {\n\tlog.Fatal(err)\n}");
    bodyVar = "body";
  } else if (req?.kind === "raw") {
    imports.add("strings");
    body.push(`body := strings.NewReader(${quote(req.text)})`);
    bodyVar = "body";
  }

  const lines: string[] = [];
  if (request.insecure) {
    imports.add("crypto/tls");
    lines.push(
      "// curl -k: certificate verification is disabled. Do not use in production.",
      "client := &http.Client{",
      "\tTransport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},",
      "}"
    );
  } else {
    lines.push("client := &http.Client{}");
  }
  lines.push(...body);
  lines.push(`req, err := http.NewRequest(${quote(request.method)}, ${quote(request.url)}, ${bodyVar})`, "if err != nil {\n\tlog.Fatal(err)\n}");

  const headers = headersForCode(request);
  const seen = new Set<string>();
  for (const [name, value] of headers) {
    const lower = name.toLowerCase();
    // Accept-Encoding を指定すると Go は自動で展開しなくなるため、--compressed 相当は Transport に任せる
    if (lower === "accept-encoding") continue;
    lines.push(`req.Header.${seen.has(lower) ? "Add" : "Set"}(${quote(name)}, ${quote(value)})`);
    seen.add(lower);
  }
  if (req?.kind === "multipart") lines.push('req.Header.Set("Content-Type", writer.FormDataContentType())');
  if (req?.kind === "json" && !seen.has("content-type")) lines.push('req.Header.Set("Content-Type", "application/json")');
  if (request.auth) lines.push(`req.SetBasicAuth(${quote(request.auth.user)}, ${quote(request.auth.password)})`);

  lines.push(
    "",
    "resp, err := client.Do(req)",
    "if err != nil {\n\tlog.Fatal(err)\n}",
    "defer resp.Body.Close()",
    "respBody, err := io.ReadAll(resp.Body)",
    "if err != nil {\n\tlog.Fatal(err)\n}",
    "fmt.Println(resp.StatusCode)",
    "fmt.Println(string(respBody))"
  );

  const sortedImports = [...imports].sort();
  const indented = lines
    .join("\n")
    .split("\n")
    .map((line) => (line ? `\t${line}` : line))
    .join("\n");
  return `package main\n\nimport (\n${sortedImports.map((i) => `\t"${i}"`).join("\n")}\n)\n\nfunc main() {\n${indented}\n}`;
}
