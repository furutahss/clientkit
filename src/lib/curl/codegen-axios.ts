import type { ParsedCurl } from "@/lib/curl/parse";
import { browserForbiddenHeaderNote, fileName, headersForCode, indent, quote } from "@/lib/curl/shared";

/** JavaScript（axios）のコードを生成する */
export function generateAxios(request: ParsedCurl): string {
  const lines: string[] = ['import axios from "axios";'];
  if (request.insecure) lines.push('import https from "node:https";');
  lines.push("");
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

  const forbiddenNote = browserForbiddenHeaderNote(request);
  if (forbiddenNote) lines.push(forbiddenNote);
  const config: string[] = [`method: ${quote(request.method.toLowerCase())},`, `url: ${quote(request.url)},`];
  const headers = headersForCode(request);
  if (headers.length > 0) {
    config.push(`headers: {\n    ${headers.map(([name, value]) => `${quote(name)}: ${quote(value)},`).join("\n    ")}\n  },`);
  }
  if (request.auth) {
    config.push(`auth: {\n    username: ${quote(request.auth.user)},\n    password: ${quote(request.auth.password)},\n  },`);
  }
  if (body?.kind === "json") {
    config.push(`data: ${indent(JSON.stringify(body.value, null, 2), "  ")},`);
  } else if (body?.kind === "form") {
    const pairs = body.fields.map(([key, value]) => `[${quote(key)}, ${quote(value)}],`);
    config.push(`data: new URLSearchParams([\n    ${pairs.join("\n    ")}\n  ]),`);
  } else if (body?.kind === "multipart") {
    config.push("data: form,");
  } else if (body?.kind === "raw") {
    config.push(`data: ${quote(body.text)},`);
  }
  if (request.insecure) config.push("httpsAgent: new https.Agent({ rejectUnauthorized: false }), // curl -k (Node.js only)");

  lines.push(`const response = await axios({\n  ${config.join("\n  ")}\n});`, "console.log(response.status, response.data);");
  return lines.join("\n");
}
