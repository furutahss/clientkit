export type CheckType = "luhn" | "ean13" | "ean8" | "isbn10" | "isbn13" | "houjin" | "mynumber" | "imei";

const digits = (s: string) => s.replace(/[\s-]/g, "");
const isNum = (s: string) => /^\d+$/.test(s);

function luhnSum(body: string): number {
  // 末尾にチェックディジットが付く前提で、body の右端が「奇数位置（2倍する側）」
  let sum = 0;
  for (let i = body.length - 1, double = true; i >= 0; i--, double = !double) {
    let n = Number(body[i]);
    if (double) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum;
}

/** チェックディジットを除いた本体から、正しいチェックディジットを計算する。本体が不正ならnull */
export function computeCheckDigit(type: CheckType, body: string): string | null {
  const b = digits(body).toUpperCase();
  switch (type) {
    case "luhn": case "imei":
      return isNum(b) ? String((10 - (luhnSum(b) % 10)) % 10) : null;
    case "ean13": case "isbn13": case "ean8": {
      const len = type === "ean8" ? 7 : 12;
      if (!isNum(b) || b.length !== len) return null;
      let sum = 0;
      for (let i = 0; i < len; i++) sum += Number(b[i]) * ((len - i) % 2 === 1 ? 3 : 1);
      return String((10 - (sum % 10)) % 10);
    }
    case "isbn10": {
      if (!/^\d{9}$/.test(b)) return null;
      let sum = 0;
      for (let i = 0; i < 9; i++) sum += Number(b[i]) * (10 - i);
      const c = (11 - (sum % 11)) % 11;
      return c === 10 ? "X" : String(c);
    }
    case "houjin": {
      // 法人番号: 先頭1桁がチェックディジット。残り12桁に右から 1,2,1,2... を掛けて合計し 9 - (合計 mod 9)
      if (!/^\d{12}$/.test(b)) return null;
      let sum = 0;
      for (let n = 1; n <= 12; n++) sum += Number(b[12 - n]) * (n % 2 === 1 ? 1 : 2);
      return String(9 - (sum % 9));
    }
    case "mynumber": {
      // 個人番号: 末尾1桁がチェックディジット。上位11桁の右から n 番目に Qn（n<=6: n+1、n>=7: n-5）を掛ける
      if (!/^\d{11}$/.test(b)) return null;
      let sum = 0;
      for (let n = 1; n <= 11; n++) sum += Number(b[11 - n]) * (n <= 6 ? n + 1 : n - 5);
      const r = sum % 11;
      return String(r <= 1 ? 0 : 11 - r);
    }
  }
}

const LENGTH: Record<CheckType, number> = { luhn: 0, ean13: 13, ean8: 8, isbn10: 10, isbn13: 13, houjin: 13, mynumber: 12, imei: 15 };

export type CheckResult = { valid: boolean; reason?: "length" | "format" | "digit"; expected?: string; brand?: string };

export function validateCheckDigit(type: CheckType, input: string): CheckResult {
  const s = digits(input).toUpperCase();
  if (LENGTH[type] && s.length !== LENGTH[type]) return { valid: false, reason: "length" };
  if (type === "luhn" && (s.length < 2 || !isNum(s))) return { valid: false, reason: "format" };
  if (type !== "isbn10" && !isNum(s)) return { valid: false, reason: "format" };
  if (type === "isbn10" && !/^\d{9}[\dX]$/.test(s)) return { valid: false, reason: "format" };
  const [body, given] = type === "houjin" ? [s.slice(1), s[0]] : [s.slice(0, -1), s[s.length - 1]];
  const expected = computeCheckDigit(type, body)!;
  return { valid: expected === given, reason: expected === given ? undefined : "digit", expected, brand: type === "luhn" ? cardBrand(s) : undefined };
}

export function cardBrand(n: string): string | undefined {
  if (/^4\d{12}(\d{3}(\d{3})?)?$/.test(n)) return "Visa";
  if (/^(5[1-5]\d{14}|2(2[2-9]\d|[3-6]\d\d|7[01]\d|720)\d{12})$/.test(n)) return "Mastercard";
  if (/^3[47]\d{13}$/.test(n)) return "American Express";
  if (/^35(2[89]|[3-8]\d)\d{12,15}$/.test(n)) return "JCB";
  if (/^3(0[0-5]|[68]\d)\d{11,16}$/.test(n)) return "Diners Club";
  if (/^(6011|65\d\d|64[4-9]\d)\d{12,15}$/.test(n)) return "Discover";
  return undefined;
}
