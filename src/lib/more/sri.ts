import { bytesToBase64 } from "./util";

export type SriAlgo = "sha256" | "sha384" | "sha512";

export async function sriHash(data: Uint8Array, algo: SriAlgo): Promise<string> {
  const name = `SHA-${algo.slice(3)}`;
  return `${algo}-${bytesToBase64(new Uint8Array(await crypto.subtle.digest(name, data as BufferSource)))}`;
}

/** integrity属性（複数アルゴリズムはスペース区切り）とscript/linkタグの例を作る */
export function sriTags(url: string, integrity: string, kind: "script" | "style"): string {
  const safe = url.replace(/"/g, "&quot;");
  return kind === "script"
    ? `<script src="${safe}" integrity="${integrity}" crossorigin="anonymous"></script>`
    : `<link rel="stylesheet" href="${safe}" integrity="${integrity}" crossorigin="anonymous">`;
}
