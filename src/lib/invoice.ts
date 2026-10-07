/**
 * 請求書・見積書などの帳票の金額計算と入力チェック（適格請求書の記載事項に対応）。
 * 浮動小数点の誤差を避けるため、金額はすべて BigInt の整数で計算する。
 */

export type DocumentType = "invoice" | "estimate" | "delivery" | "receipt";
/** 10: 標準税率, 8: 軽減税率, exempt: 非課税, outside: 不課税 */
export type TaxCategory = "10" | "8" | "exempt" | "outside";
export type Rounding = "floor" | "round" | "ceil";
export type TaxMode = "exclusive" | "inclusive";
export type Honorific = "御中" | "様";

export type InvoiceItem = {
  id: string;
  name: string;
  /** 数量（小数第2位まで） */
  quantity: string;
  unit: string;
  /** 単価（円、小数第2位まで。値引きはマイナス） */
  unitPrice: string;
  tax: TaxCategory;
};

export type InvoiceData = {
  docType: DocumentType;
  issuer: {
    name: string;
    postalCode: string;
    address: string;
    tel: string;
    email: string;
    registrationNumber: string;
    bankName: string;
    branchName: string;
    accountType: string;
    accountNumber: string;
    accountHolder: string;
    /** ロゴ・社印の画像（data URL） */
    logo: string;
    seal: string;
  };
  recipient: { name: string; honorific: Honorific; address: string };
  number: string;
  issueDate: string;
  /** 支払期限（請求書）・有効期限（見積書）・納品日（納品書） */
  dueDate: string;
  subject: string;
  notes: string;
  taxMode: TaxMode;
  rounding: Rounding;
  withholding: boolean;
  items: InvoiceItem[];
};

export type TaxGroup = {
  category: TaxCategory;
  /** 税抜の対価の額 */
  base: number;
  tax: number;
  /** 税込の額 */
  total: number;
};

export type InvoiceTotals = {
  /** 各明細の金額（入力モードに応じて税抜または税込）。入力が不正な行は null */
  lineAmounts: (number | null)[];
  groups: TaxGroup[];
  subtotal: number;
  taxTotal: number;
  total: number;
  withholding: number;
  /** 請求金額（合計 − 源泉徴収税額） */
  amountDue: number;
};

export const TAX_CATEGORIES: TaxCategory[] = ["10", "8", "exempt", "outside"];
const RATE: Record<TaxCategory, bigint> = { "10": 10n, "8": 8n, exempt: 0n, outside: 0n };

/** 全角数字・カンマ・空白を取り除き、小数を scale 倍した整数にする。不正な値は null */
export function parseDecimal(value: string, decimals: number): bigint | null {
  const normalized = value
    .replace(/[０-９．－ー−]/g, (c) => ({ "．": ".", "－": "-", "ー": "-", "−": "-" })[c] ?? String(c.charCodeAt(0) - 0xff10))
    .replace(/[,\s，]/g, "");
  const match = normalized.match(/^(-)?(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  const [, sign, int, frac = ""] = match;
  if (frac.length > decimals) return null;
  const scaled = BigInt(int + frac.padEnd(decimals, "0"));
  return sign ? -scaled : scaled;
}

/** n / d を指定の方法で整数に丸める（符号に関係なく絶対値で切り捨て・四捨五入・切り上げ） */
export function divideRound(n: bigint, d: bigint, mode: Rounding): bigint {
  const negative = n < 0n !== d < 0n;
  const an = n < 0n ? -n : n;
  const ad = d < 0n ? -d : d;
  let q = an / ad;
  const r = an % ad;
  if (r !== 0n && (mode === "ceil" || (mode === "round" && r * 2n >= ad))) q += 1n;
  return negative ? -q : q;
}

/** 報酬に対する源泉徴収税額（100万円以下は10.21%、超える部分は20.42%。1円未満切り捨て） */
export function withholdingTax(base: number): number {
  if (base <= 0) return 0;
  const b = BigInt(base);
  const limit = 1_000_000n;
  const tax = b <= limit ? (b * 1021n) / 10000n : (limit * 1021n + (b - limit) * 2042n) / 10000n;
  return Number(tax);
}

/**
 * 明細から税率ごとの合計・消費税額・請求金額を計算する。
 * 各明細の金額（数量×単価）の1円未満は指定の方法で丸め、消費税の端数処理は税率ごとに1回だけ行う。
 */
export function calculateInvoice(
  data: Pick<InvoiceData, "items" | "taxMode" | "rounding" | "withholding">
): InvoiceTotals {
  const sums = new Map<TaxCategory, bigint>();
  const lineAmounts = data.items.map((item) => {
    const quantity = parseDecimal(item.quantity, 2);
    const price = parseDecimal(item.unitPrice, 2);
    if (quantity === null || price === null) return null;
    const amount = divideRound(quantity * price, 10000n, data.rounding);
    sums.set(item.tax, (sums.get(item.tax) ?? 0n) + amount);
    return Number(amount);
  });

  const groups: TaxGroup[] = TAX_CATEGORIES.filter((category) => sums.has(category)).map((category) => {
    const sum = sums.get(category)!;
    const rate = RATE[category];
    if (data.taxMode === "exclusive") {
      const tax = divideRound(sum * rate, 100n, data.rounding);
      return { category, base: Number(sum), tax: Number(tax), total: Number(sum + tax) };
    }
    const tax = divideRound(sum * rate, 100n + rate, data.rounding);
    return { category, base: Number(sum - tax), tax: Number(tax), total: Number(sum) };
  });

  const subtotal = groups.reduce((sum, g) => sum + g.base, 0);
  const taxTotal = groups.reduce((sum, g) => sum + g.tax, 0);
  const total = subtotal + taxTotal;
  const withholding = data.withholding ? withholdingTax(subtotal) : 0;
  return { lineAmounts, groups, subtotal, taxTotal, total, withholding, amountDue: total - withholding };
}

/** 全角英数字・空白・ハイフンを除いた登録番号を返す */
export function normalizeRegistrationNumber(value: string): string {
  return value
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s\-‐－ー]/g, "")
    .toUpperCase();
}

/** 適格請求書発行事業者の登録番号の形式（T + 13桁の数字）か */
export function isValidRegistrationNumber(value: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(value));
}

export type InvoiceWarning =
  | "missingIssuerName"
  | "missingRegistrationNumber"
  | "invalidRegistrationNumber"
  | "missingRecipient"
  | "missingIssueDate"
  | "noItems"
  | "invalidItems"
  | "missingItemName"
  | "negativeTotal";

/** 適格請求書の記載事項を中心に、入力漏れ・誤りの警告を返す */
export function validateInvoice(data: InvoiceData, totals: InvoiceTotals): InvoiceWarning[] {
  const warnings: InvoiceWarning[] = [];
  // 見積書は適格請求書ではないため登録番号のチェックは行わない
  const qualified = data.docType !== "estimate";
  if (!data.issuer.name.trim()) warnings.push("missingIssuerName");
  if (qualified && !data.issuer.registrationNumber.trim()) warnings.push("missingRegistrationNumber");
  if (data.issuer.registrationNumber.trim() && !isValidRegistrationNumber(data.issuer.registrationNumber)) {
    warnings.push("invalidRegistrationNumber");
  }
  if (!data.recipient.name.trim()) warnings.push("missingRecipient");
  if (!data.issueDate) warnings.push("missingIssueDate");
  if (data.items.length === 0) warnings.push("noItems");
  if (totals.lineAmounts.some((amount) => amount === null)) warnings.push("invalidItems");
  if (data.items.some((item) => !item.name.trim())) warnings.push("missingItemName");
  if (totals.amountDue < 0) warnings.push("negativeTotal");
  return warnings;
}

/**
 * 書類番号のパターンから番号を作る。{YYYY} {YY} {MM} {DD} は日付、{N...} は連番（Nの数で桁数を指定）に置き換える。
 * 例: "INV-{YYYY}-{NNN}" → "INV-2026-001"
 */
export function formatDocumentNumber(pattern: string, date: string, sequence: number): string {
  const [yyyy = "", mm = "", dd = ""] = date.split("-");
  return pattern
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yyyy.slice(-2))
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
    .replace(/\{(N+)\}/g, (_, n: string) => String(sequence).padStart(n.length, "0"));
}

/** 連番を管理する単位（連番部分を除いたパターンに日付を適用したもの。年が変わると連番もリセットされる） */
export function sequenceKey(pattern: string, date: string): string {
  return formatDocumentNumber(pattern.replace(/\{N+\}/g, "#"), date, 0);
}

/** 金額を「¥1,234」形式にする */
export function formatYen(value: number): string {
  return `${value < 0 ? "-" : ""}¥${Math.abs(value).toLocaleString("ja-JP")}`;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let itemSeq = 0;
export function newItem(partial: Partial<InvoiceItem> = {}): InvoiceItem {
  itemSeq += 1;
  return { id: `item-${Date.now().toString(36)}-${itemSeq}`, name: "", quantity: "1", unit: "", unitPrice: "", tax: "10", ...partial };
}

export function createEmptyInvoice(): InvoiceData {
  return {
    docType: "invoice",
    issuer: {
      name: "",
      postalCode: "",
      address: "",
      tel: "",
      email: "",
      registrationNumber: "",
      bankName: "",
      branchName: "",
      accountType: "普通",
      accountNumber: "",
      accountHolder: "",
      logo: "",
      seal: "",
    },
    recipient: { name: "", honorific: "御中", address: "" },
    number: "",
    issueDate: today(),
    dueDate: "",
    subject: "",
    notes: "",
    taxMode: "exclusive",
    rounding: "floor",
    withholding: false,
    items: [newItem()],
  };
}

const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : fallback;
const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;
const isImage = (value: unknown): string =>
  typeof value === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(value) ? value : "";

/** 保存・インポートしたJSONを検証し、不足や不正な値を既定値で補った帳票データにする */
export function normalizeInvoiceData(input: unknown): InvoiceData {
  const base = createEmptyInvoice();
  if (!input || typeof input !== "object") return base;
  const raw = input as Record<string, unknown>;
  const issuer = (raw.issuer ?? {}) as Record<string, unknown>;
  const recipient = (raw.recipient ?? {}) as Record<string, unknown>;
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    docType: pick(raw.docType, ["invoice", "estimate", "delivery", "receipt"], base.docType),
    issuer: {
      ...Object.fromEntries(Object.keys(base.issuer).map((key) => [key, str(issuer[key], base.issuer[key as keyof typeof base.issuer])])),
      logo: isImage(issuer.logo),
      seal: isImage(issuer.seal),
    } as InvoiceData["issuer"],
    recipient: {
      name: str(recipient.name),
      honorific: pick(recipient.honorific, ["御中", "様"], "御中"),
      address: str(recipient.address),
    },
    number: str(raw.number),
    issueDate: str(raw.issueDate, base.issueDate),
    dueDate: str(raw.dueDate),
    subject: str(raw.subject),
    notes: str(raw.notes),
    taxMode: pick(raw.taxMode, ["exclusive", "inclusive"], base.taxMode),
    rounding: pick(raw.rounding, ["floor", "round", "ceil"], base.rounding),
    withholding: raw.withholding === true,
    items: items.slice(0, 500).map((value) => {
      const item = (value ?? {}) as Record<string, unknown>;
      return newItem({
        name: str(item.name),
        quantity: str(item.quantity, "1"),
        unit: str(item.unit),
        unitPrice: str(item.unitPrice),
        tax: pick(item.tax, TAX_CATEGORIES, "10"),
      });
    }),
  };
}
