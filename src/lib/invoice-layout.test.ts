import { describe, expect, it } from "vitest";

import { calculateInvoice, createEmptyInvoice, newItem, type InvoiceData } from "./invoice";
import {
  buildInvoiceLayout,
  formatDecimal,
  formatJapaneseDate,
  truncateText,
  wrapText,
  type LayoutCommand,
} from "./invoice-layout";

/** 1文字 = 文字サイズ(pt)の0.35mm とみなす簡易的な幅計測 */
const measure = (text: string, size: number) => [...text].length * size * 0.35;

function texts(page: LayoutCommand[]): string[] {
  return page.flatMap((c) => (c.type === "text" ? [c.text] : []));
}

function sample(): InvoiceData {
  return {
    ...createEmptyInvoice(),
    issuer: { ...createEmptyInvoice().issuer, name: "山田デザイン事務所", registrationNumber: "T1234567890123", bankName: "みずほ銀行", accountNumber: "1234567" },
    recipient: { name: "株式会社サンプル", honorific: "御中", address: "東京都千代田区1-1" },
    number: "INV-2026-001",
    issueDate: "2026-10-06",
    dueDate: "2026-10-31",
    subject: "Webサイト制作",
    items: [
      newItem({ name: "デザイン", quantity: "1", unitPrice: "100000", tax: "10" }),
      newItem({ name: "お菓子", quantity: "2", unitPrice: "540", tax: "8" }),
      newItem({ name: "値引き", quantity: "1", unitPrice: "-5000", tax: "10" }),
    ],
  };
}

describe("書式", () => {
  it("日付と数値を整形する", () => {
    expect(formatJapaneseDate("2026-01-05")).toBe("2026年1月5日");
    expect(formatJapaneseDate("")).toBe("");
    expect(formatDecimal("1234567")).toBe("1,234,567");
    expect(formatDecimal("1.50")).toBe("1.5");
    expect(formatDecimal("-5000")).toBe("-5,000");
    expect(formatDecimal("abc")).toBe("abc");
  });

  it("文字列を折り返し・省略する", () => {
    expect(wrapText("あいうえおかきくけこ", 10 * 0.35 * 4, 10, measure)).toEqual(["あいうえ", "おかきく", "けこ"]);
    expect(wrapText("一行目\n二行目", 100, 10, measure)).toEqual(["一行目", "二行目"]);
    expect(truncateText("とても長い品名です", 10 * 0.35 * 5, 10, measure)).toBe("とても長…");
    expect(truncateText("短い", 100, 10, measure)).toBe("短い");
  });
});

describe("buildInvoiceLayout", () => {
  it("記載事項を1ページに配置する", () => {
    const data = sample();
    const pages = buildInvoiceLayout(data, calculateInvoice(data), measure);
    expect(pages).toHaveLength(1);
    const all = texts(pages[0]);
    expect(all).toEqual(
      expect.arrayContaining([
        "請　求　書",
        "No. INV-2026-001",
        "発行日　2026年10月6日",
        "株式会社サンプル　御中",
        "登録番号　T1234567890123",
        "お菓子 ※",
        "8%※",
        "10%対象",
        "8%対象（軽減税率）",
        "消費税（8%）",
        "※印は軽減税率（8%）対象品目です。",
        "【お振込先】",
        "お支払期限　2026年10月31日",
      ])
    );
    // 10%: 95,000 + 9,500 / 8%: 1,080 + 86 → 合計 105,666
    expect(all).toContain("¥105,666 -（税込）");
  });

  it("税込入力では内消費税として表示する", () => {
    const data = { ...sample(), taxMode: "inclusive" as const };
    const all = texts(buildInvoiceLayout(data, calculateInvoice(data), measure)[0]);
    expect(all).toContain("10%対象（税込）");
    expect(all).toContain("　内消費税（10%）");
  });

  it("源泉徴収と領収書の文言", () => {
    const data = { ...sample(), docType: "receipt" as const, withholding: true };
    const all = texts(buildInvoiceLayout(data, calculateInvoice(data), measure)[0]);
    expect(all).toContain("領　収　書");
    expect(all).toContain("源泉徴収税額");
    expect(all).toContain("差引領収額");
    expect(all).toContain("但し　Webサイト制作　として");
    expect(all).not.toContain("【お振込先】");
  });

  it("明細が多い場合は複数ページに分け、ヘッダーとページ番号を付ける", () => {
    const data = { ...sample(), items: Array.from({ length: 60 }, (_, i) => newItem({ name: `品目${i + 1}`, unitPrice: "100" })) };
    const pages = buildInvoiceLayout(data, calculateInvoice(data), measure);
    expect(pages.length).toBeGreaterThan(1);
    expect(texts(pages[1])).toContain("品名・摘要");
    expect(texts(pages[1])).toContain(`2 / ${pages.length}`);
    const names = pages.flatMap(texts).filter((t) => t.startsWith("品目"));
    expect(names).toHaveLength(60);
    // すべての命令がページ内に収まる
    for (const page of pages) {
      for (const c of page) {
        if (c.type === "text") expect(c.y).toBeLessThan(297);
      }
    }
  });
});
