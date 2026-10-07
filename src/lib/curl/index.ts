import { generateAxios } from "@/lib/curl/codegen-axios";
import { generateCSharp } from "@/lib/curl/codegen-csharp";
import { generateCurl } from "@/lib/curl/codegen-curl";
import { generateFetch } from "@/lib/curl/codegen-fetch";
import { generateGo } from "@/lib/curl/codegen-go";
import { generatePython } from "@/lib/curl/codegen-python";
import type { ParsedCurl } from "@/lib/curl/parse";

export type TargetLanguage = "fetch" | "axios" | "python" | "csharp" | "go" | "curl";

export const generators: Record<TargetLanguage, (request: ParsedCurl) => string> = {
  fetch: generateFetch,
  axios: generateAxios,
  python: generatePython,
  csharp: generateCSharp,
  go: generateGo,
  curl: generateCurl,
};

export { CurlParseError, parseCurl, splitUrl, type ParsedCurl } from "@/lib/curl/parse";
export { maskRequest } from "@/lib/curl/mask";
