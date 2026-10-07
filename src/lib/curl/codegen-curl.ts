import type { ParsedCurl } from "@/lib/curl/parse";

/** シングルクォートで囲んだシェルの引数（' は '\'' に置き換える） */
export function shellQuote(value: string): string {
  return /^[A-Za-z0-9_\-.,/:=@%+]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

/** 解析結果から、整形した cURL コマンド（bash 形式）を再生成する */
export function generateCurl(request: ParsedCurl): string {
  const args: string[] = [];
  const body = request.body;
  const defaultMethod = body ? "POST" : "GET";
  if (request.method !== defaultMethod) args.push(`-X ${request.method}`);
  args.push(shellQuote(request.url));
  for (const [name, value] of request.headers) args.push(`-H ${shellQuote(`${name}: ${value}`)}`);
  if (request.auth) args.push(`-u ${shellQuote(`${request.auth.user}:${request.auth.password}`)}`);
  if (body?.kind === "json") args.push(`--data-raw ${shellQuote(JSON.stringify(body.value))}`);
  else if (body?.kind === "form" || body?.kind === "raw") args.push(`--data-raw ${shellQuote(body.text)}`);
  else if (body?.kind === "multipart") {
    for (const part of body.parts) {
      const value = part.isFile
        ? `@${part.value}${part.contentType ? `;type=${part.contentType}` : ""}${part.filename ? `;filename=${part.filename}` : ""}`
        : part.value;
      args.push(`${part.isFile ? "-F" : "--form-string"} ${shellQuote(`${part.name}=${value}`)}`);
    }
  }
  if (request.followRedirects) args.push("-L");
  if (request.insecure) args.push("-k");
  if (request.compressed) args.push("--compressed");
  return `curl ${args.join(" \\\n  ")}`;
}
