import { describe, expect, it } from "vitest";

import {
  calculateInvoice,
  createEmptyInvoice,
  divideRound,
  formatDocumentNumber,
  formatYen,
  isValidRegistrationNumber,
  newItem,
  normalizeInvoiceData,
  parseDecimal,
  sequenceKey,
  validateInvoice,
  withholdingTax,
  type InvoiceData,
  type InvoiceItem,
  type Rounding,
  type TaxMode,
} from "./invoice";

function calc(
  items: Partial<InvoiceItem>[],
  options: { taxMode?: TaxMode; rounding?: Rounding; withholding?: boolean } = {}
) {
  return calculateInvoice({
    items: items.map((item) => newItem(item)),
    taxMode: options.taxMode ?? "exclusive",
    rounding: options.rounding ?? "floor",
    withholding: options.withholding ?? false,
  });
}

describe("parseDecimal", () => {
  it("小数・カンマ・全角数字・マイナスを解釈する", () => {
    expect(parseDecimal("1,234", 2)).toBe(123400n);
    expect(parseDecimal("1.5", 2)).toBe(150n);
    expect(parseDecimal("１２．３４", 2)).toBe(1234n);
    expect(parseDecimal("-500", 2)).toBe(-50000n);
    expect(parseDecimal("－500", 2)).toBe(-50000n);
    expect(parseDecimal(" 0 ", 2)).toBe(0n);
  });

  it("不正な値や桁数超過は null", () => {
    expect(parseDecimal("", 2)).toBeNull();
    expect(parseDecimal("abc", 2)).toBeNull();
    expect(parseDecimal("1.234", 2)).toBeNull();
    expect(parseDecimal("1..2", 2)).toBeNull();
  });
});

describe("divideRound", () => {
  it.each([
    [7n, 2n, "floor", 3n],
    [7n, 2n, "round", 4n],
    [7n, 2n, "ceil", 4n],
    [6n, 2n, "ceil", 3n],
    [149n, 100n, "round", 1n],
    [150n, 100n, "round", 2n],
    [-7n, 2n, "floor", -3n],
    [-7n, 2n, "round", -4n],
    [-7n, 2n, "ceil", -4n],
  ] as const)("%s / %s (%s) = %s", (n, d, mode, expected) => {
    expect(divideRound(n, d, mode)).toBe(expected);
  });
});

describe("calculateInvoice（税抜入力）", () => {
  it("10%のみ", () => {
    const result = calc([{ quantity: "3", unitPrice: "1000" }]);
    expect(result.groups).toEqual([{ category: "10", base: 3000, tax: 300, total: 3300 }]);
    expect(result.total).toBe(3300);
    expect(result.amountDue).toBe(3300);
  });

  it("8%と10%の混在は税率ごとに集計する", () => {
    const result = calc([
      { quantity: "2", unitPrice: "540", tax: "8" },
      { quantity: "1", unitPrice: "1980", tax: "10" },
      { quantity: "1", unitPrice: "300", tax: "8" },
    ]);
    expect(result.groups).toEqual([
      { category: "10", base: 1980, tax: 198, total: 2178 },
      { category: "8", base: 1380, tax: 110, total: 1490 },
    ]);
    expect(result.subtotal).toBe(3360);
    expect(result.taxTotal).toBe(308);
    expect(result.total).toBe(3668);
  });

  it("端数処理は明細ごとではなく税率ごとに1回だけ行う", () => {
    // 明細ごとに処理すると 99*0.1=9.9→9 が3行で27円になるが、合計297円に対して1回なら29円
    const items = [
      { quantity: "1", unitPrice: "99" },
      { quantity: "1", unitPrice: "99" },
      { quantity: "1", unitPrice: "99" },
    ];
    expect(calc(items, { rounding: "floor" }).groups[0].tax).toBe(29);
    expect(calc(items, { rounding: "round" }).groups[0].tax).toBe(30);
    expect(calc(items, { rounding: "ceil" }).groups[0].tax).toBe(30);
  });

  it("四捨五入の境界（0.5円は切り上げ、0.4円は切り捨て）", () => {
    expect(calc([{ unitPrice: "105" }], { rounding: "round" }).groups[0].tax).toBe(11); // 10.5
    expect(calc([{ unitPrice: "104" }], { rounding: "round" }).groups[0].tax).toBe(10); // 10.4
    expect(calc([{ unitPrice: "1", tax: "8" }], { rounding: "ceil" }).groups[0].tax).toBe(1); // 0.08
    expect(calc([{ unitPrice: "1", tax: "8" }], { rounding: "floor" }).groups[0].tax).toBe(0);
  });

  it("小数の数量・単価は明細金額の1円未満を丸める", () => {
    const result = calc([{ quantity: "1.5", unitPrice: "333" }], { rounding: "floor" }); // 499.5
    expect(result.lineAmounts).toEqual([499]);
    expect(calc([{ quantity: "1.5", unitPrice: "333" }], { rounding: "round" }).lineAmounts).toEqual([500]);
    expect(calc([{ quantity: "3", unitPrice: "0.25" }], { rounding: "floor" }).lineAmounts).toEqual([0]);
  });

  it("値引き行（マイナス明細）は同じ税率の対価から差し引く", () => {
    const result = calc([
      { quantity: "1", unitPrice: "10000", tax: "10" },
      { quantity: "1", unitPrice: "-1000", tax: "10" },
      { quantity: "1", unitPrice: "5000", tax: "8" },
    ]);
    expect(result.groups).toEqual([
      { category: "10", base: 9000, tax: 900, total: 9900 },
      { category: "8", base: 5000, tax: 400, total: 5400 },
    ]);
  });

  it("マイナスの端数は絶対値で丸める", () => {
    const result = calc([{ quantity: "1", unitPrice: "-99" }], { rounding: "floor" });
    expect(result.groups[0]).toEqual({ category: "10", base: -99, tax: -9, total: -108 });
  });

  it("非課税・不課税は消費税0円で別に集計する", () => {
    const result = calc([
      { unitPrice: "1000", tax: "10" },
      { unitPrice: "500", tax: "exempt" },
      { unitPrice: "300", tax: "outside" },
    ]);
    expect(result.groups.map((g) => [g.category, g.base, g.tax])).toEqual([
      ["10", 1000, 100],
      ["exempt", 500, 0],
      ["outside", 300, 0],
    ]);
    expect(result.total).toBe(1900);
  });

  it("不正な明細は計算から除外し null を返す", () => {
    const result = calc([{ unitPrice: "1000" }, { unitPrice: "abc" }, { quantity: "", unitPrice: "100" }]);
    expect(result.lineAmounts).toEqual([1000, null, null]);
    expect(result.total).toBe(1100);
  });

  it("明細がない場合はすべて0", () => {
    expect(calc([])).toMatchObject({ groups: [], subtotal: 0, taxTotal: 0, total: 0, amountDue: 0 });
  });

  it("大きな金額でも誤差なく計算する", () => {
    const result = calc([{ quantity: "999999.99", unitPrice: "99999999.99" }]);
    expect(result.lineAmounts).toEqual([99999998990000]); // 99,999,998,990,000.0001 → 切り捨て
    expect(result.groups[0].tax).toBe(9999999899000);
  });
});

describe("calculateInvoice（税込入力）", () => {
  it("税込金額から内税を計算する", () => {
    const result = calc([{ unitPrice: "1100" }], { taxMode: "inclusive" });
    expect(result.groups).toEqual([{ category: "10", base: 1000, tax: 100, total: 1100 }]);
  });

  it("8%と10%の混在・税率ごとに1回の端数処理", () => {
    const result = calc(
      [
        { unitPrice: "1000", tax: "10" }, // 1000*10/110 = 90.90...
        { unitPrice: "1000", tax: "8" }, // 1000*8/108 = 74.07...
        { unitPrice: "1000", tax: "8" },
      ],
      { taxMode: "inclusive", rounding: "floor" }
    );
    expect(result.groups).toEqual([
      { category: "10", base: 910, tax: 90, total: 1000 },
      { category: "8", base: 1852, tax: 148, total: 2000 }, // 2000*8/108 = 148.14...
    ]);
    expect(result.total).toBe(3000);
    const rounded = calc([{ unitPrice: "1000", tax: "10" }], { taxMode: "inclusive", rounding: "round" });
    expect(rounded.groups[0].tax).toBe(91);
  });
});

describe("源泉徴収税", () => {
  it("100万円以下は10.21%（1円未満切り捨て）", () => {
    expect(withholdingTax(0)).toBe(0);
    expect(withholdingTax(-1000)).toBe(0);
    expect(withholdingTax(10000)).toBe(1021);
    expect(withholdingTax(55555)).toBe(5672); // 5672.1655
    expect(withholdingTax(1_000_000)).toBe(102100);
  });

  it("100万円を超える部分は20.42%", () => {
    expect(withholdingTax(1_000_001)).toBe(102100); // 102100.2042
    expect(withholdingTax(1_500_000)).toBe(204200);
    expect(withholdingTax(2_000_000)).toBe(306300);
  });

  it("税抜の対価の額に対して計算し、請求金額から差し引く", () => {
    const result = calc([{ unitPrice: "100000" }], { withholding: true });
    expect(result).toMatchObject({ subtotal: 100000, total: 110000, withholding: 10210, amountDue: 99790 });
    const inclusive = calc([{ unitPrice: "110000" }], { taxMode: "inclusive", withholding: true });
    expect(inclusive).toMatchObject({ subtotal: 100000, withholding: 10210, amountDue: 99790 });
  });
});

describe("入力チェック", () => {
  it("登録番号の形式を確認する", () => {
    expect(isValidRegistrationNumber("T1234567890123")).toBe(true);
    expect(isValidRegistrationNumber("t-1234-5678-9012-3")).toBe(true);
    expect(isValidRegistrationNumber("Ｔ１２３４５６７８９０１２３")).toBe(true);
    expect(isValidRegistrationNumber("1234567890123")).toBe(false);
    expect(isValidRegistrationNumber("T123456789012")).toBe(false);
    expect(isValidRegistrationNumber("T12345678901234")).toBe(false);
  });

  it("記載事項の不足を警告する", () => {
    const data = createEmptyInvoice();
    data.items = [newItem({ unitPrice: "x" })];
    const warnings = validateInvoice(data, calculateInvoice(data));
    expect(warnings).toEqual(
      expect.arrayContaining([
        "missingIssuerName",
        "missingRegistrationNumber",
        "missingRecipient",
        "invalidItems",
        "missingItemName",
      ])
    );
  });

  it("見積書では登録番号を必須にしない", () => {
    const data: InvoiceData = {
      ...createEmptyInvoice(),
      docType: "estimate",
      issuer: { ...createEmptyInvoice().issuer, name: "発行者" },
      recipient: { name: "取引先", honorific: "御中", address: "" },
      items: [newItem({ name: "作業", unitPrice: "1000" })],
    };
    expect(validateInvoice(data, calculateInvoice(data))).toEqual([]);
    data.issuer.registrationNumber = "T123";
    expect(validateInvoice(data, calculateInvoice(data))).toEqual(["invalidRegistrationNumber"]);
  });
});

describe("書類番号", () => {
  it("パターンから番号を作る", () => {
    expect(formatDocumentNumber("INV-{YYYY}-{NNN}", "2026-10-06", 1)).toBe("INV-2026-001");
    expect(formatDocumentNumber("{YY}{MM}{DD}-{NN}", "2026-10-06", 12)).toBe("261006-12");
    expect(formatDocumentNumber("Q{N}", "2026-10-06", 1234)).toBe("Q1234");
  });

  it("連番の管理単位は日付部分が変わると別になる", () => {
    expect(sequenceKey("INV-{YYYY}-{NNN}", "2026-10-06")).toBe("INV-2026-#");
    expect(sequenceKey("INV-{YYYY}-{NNN}", "2027-01-01")).toBe("INV-2027-#");
  });
});

describe("その他", () => {
  it("金額を円表記にする", () => {
    expect(formatYen(1234567)).toBe("¥1,234,567");
    expect(formatYen(-500)).toBe("-¥500");
  });

  it("インポートしたJSONを検証して補う", () => {
    const data = normalizeInvoiceData({
      docType: "receipt",
      issuer: { name: "山田太郎", logo: "javascript:alert(1)", seal: "data:image/png;base64,AAAA" },
      recipient: { honorific: "殿" },
      taxMode: "inclusive",
      rounding: "bogus",
      items: [{ name: "作業", unitPrice: 1000, tax: "8" }, null],
    });
    expect(data.docType).toBe("receipt");
    expect(data.issuer.name).toBe("山田太郎");
    expect(data.issuer.accountType).toBe("普通");
    expect(data.issuer.logo).toBe("");
    expect(data.issuer.seal).toBe("data:image/png;base64,AAAA");
    expect(data.recipient.honorific).toBe("御中");
    expect(data.taxMode).toBe("inclusive");
    expect(data.rounding).toBe("floor");
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toMatchObject({ name: "作業", unitPrice: "1000", tax: "8" });
    expect(normalizeInvoiceData("garbage").items).toHaveLength(1);
  });
});
