import type { ParsedCurl } from "@/lib/curl/parse";
import { browserForbiddenHeaderNote, fileName, headersForCode, indent, quote } from "@/lib/curl/shared";

/** JavaScript（fetch API）のコードを生成する */
export function generateFetch(request: ParsedCurl): string {
  const lines: string[] = [];
  const options: string[] = [];
  const headers = headersForCode(request);
  const body = request.body;

  if (body?.kind === "multipart") {
    lines.push("const form = new FormData();");
    for (const part of body.parts) {
      lines.push(
        part.isFile
          ? `form.append(${quote(part.name)}, fileInput.files[0], ${quote(part.filename ?? fileName(part.value))}); // ${part.value}`
          : `form.append(${quote(part.name)}, ${quote(part.value)});`
      );
    }
    lines.push("");
  }

  if (request.method !== "GET") options.push(`method: ${quote(request.method)},`);
  const headerLines = headers.map(([name, value]) => `${quote(name)}: ${quote(value)},`);
  if (request.auth) {
    headerLines.push(`Authorization: "Basic " + btoa(${quote(`${request.auth.user}:${request.auth.password}`)}),`);
  }
  if (headerLines.length > 0) options.push(`headers: {\n    ${headerLines.join("\n    ")}\n  },`);

  if (body?.kind === "json") {
    options.push(`body: JSON.stringify(${indent(JSON.stringify(body.value, null, 2), "  ")}),`);
  } else if (body?.kind === "form") {
    const pairs = body.fields.map(([key, value]) => `[${quote(key)}, ${quote(value)}],`);
    options.push(`body: new URLSearchParams([\n    ${pairs.join("\n    ")}\n  ]),`);
  } else if (body?.kind === "multipart") {
    options.push("body: form,");
  } else if (body?.kind === "raw") {
    options.push(`body: ${quote(body.text)},`);
  }

  const forbiddenNote = browserForbiddenHeaderNote(request);
  if (forbiddenNote) lines.push(forbiddenNote);
  if (request.insecure) lines.push("// Note: fetch cannot disable TLS certificate verification (curl -k).");
  lines.push(
    options.length > 0
      ? `const response = await fetch(${quote(request.url)}, {\n  ${options.join("\n  ")}\n});`
      : `const response = await fetch(${quote(request.url)});`
  );
  lines.push("const data = await response.text();", "console.log(response.status, data);");
  return lines.join("\n");
}
