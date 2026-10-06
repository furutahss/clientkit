import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { PDFDocument } from "@pdfme/pdf-lib";
import { describe, expect, it } from "vitest";

import { calculateInvoice, createEmptyInvoice, newItem } from "./invoice";
import { buildInvoiceLayout } from "./invoice-layout";
import { renderInvoicePdf } from "./invoice-pdf";

const require = createRequire(import.meta.url);
const fontPath = require.resolve("@expo-google-fonts/noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf");

describe("renderInvoicePdf", () => {
  it("日本語フォントをサブセット化して埋め込んだPDFを作る", async () => {
    const font = readFileSync(fontPath);
    const fontBytes = font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength) as ArrayBuffer;
    const data = {
      ...createEmptyInvoice(),
      issuer: { ...createEmptyInvoice().issuer, name: "山田デザイン事務所" },
      recipient: { name: "株式会社サンプル", honorific: "御中" as const, address: "" },
      items: Array.from({ length: 50 }, (_, i) => newItem({ name: `ロゴ制作 ${i + 1}`, unitPrice: "1000" })),
    };
    const pages = buildInvoiceLayout(data, calculateInvoice(data), (text, size) => text.length * size * 0.35);
    const bytes = await renderInvoicePdf(pages, fontBytes, "請求書");

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    // フォント全体（約5.7MB）ではなく、使った文字だけが埋め込まれる
    expect(bytes.length).toBeLessThan(300_000);
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBe(pages.length);
    expect(parsed.getTitle()).toBe("請求書");
  });
});
