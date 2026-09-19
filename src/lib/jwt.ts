export type JwtDecodeResult =
  | {
      ok: true;
      header: unknown;
      payload: unknown;
      signature: string;
      headerRaw: string;
      payloadRaw: string;
    }
  | { ok: false; error: string };

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(paddingLength);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** JWT文字列を Header / Payload / Signature に分解し、Header・Payloadをパースする（署名検証は行わない） */
export function decodeJwt(token: string): JwtDecodeResult {
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return {
      ok: false,
      error:
        "JWTは「ヘッダー.ペイロード.署名」の3つの部分（ドット区切り）で構成されている必要があります。",
    };
  }

  const [headerRaw, payloadRaw, signature] = parts;

  try {
    const header = JSON.parse(base64UrlDecode(headerRaw));
    const payload = JSON.parse(base64UrlDecode(payloadRaw));
    return { ok: true, header, payload, signature, headerRaw, payloadRaw };
  } catch {
    return {
      ok: false,
      error:
        "JWTのデコードに失敗しました。Base64URLとして不正、またはJSONとして解釈できない値が含まれています。",
    };
  }
}

export const TIME_CLAIMS = ["exp", "nbf", "iat"] as const;
export type TimeClaim = (typeof TIME_CLAIMS)[number];

export function formatClaimDate(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

export type ExpiryStatus = "expired" | "not-yet-valid" | "valid" | "unknown";

export function getExpiryStatus(payload: unknown): ExpiryStatus {
  if (payload === null || typeof payload !== "object") return "unknown";
  const record = payload as Record<string, unknown>;
  const now = Date.now() / 1000;

  if (typeof record.exp === "number" && record.exp < now) return "expired";
  if (typeof record.nbf === "number" && record.nbf > now) return "not-yet-valid";
  if (typeof record.exp === "number" || typeof record.nbf === "number") {
    return "valid";
  }
  return "unknown";
}
