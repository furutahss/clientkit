/**
 * 帳票のA4レイアウトを、描画命令（座標はmm、文字サイズはpt）の配列として組み立てる。
 * 同じ命令をプレビュー（SVG）とPDF（pdf-lib）の両方で描画することで、見た目のずれを防ぐ。
 * 文字幅は PDF に埋め込むフォントと同じフォントで測る（measure 関数で受け取る）。
 */
import {
  formatYen,
  parseDecimal,
  type DocumentType,
  type InvoiceData,
  type InvoiceTotals,
  type TaxCategory,
} from "@/lib/invoice";

export type LayoutCommand =
  | { type: "text"; x: number; y: number; size: number; text: string; color?: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; width: number; color?: string }
  | { type: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; strokeWidth?: number }
  | { type: "image"; x: number; y: number; w: number; h: number; src: string };

/** 文字列の幅（mm）を返す。size はpt */
export type MeasureText = (text: string, size: number) => number;
export type ImageSize = { width: number; height: number };

export const PAGE = { width: 210, height: 297 };
const M = 15;
const RIGHT = PAGE.width - M;
const BOTTOM = PAGE.height - 18;
const MUTED = "#555555";
const BORDER = "#999999";
const HEADER_FILL = "#eeeeee";

const TITLES: Record<DocumentType, string> = { invoice: "請求書", estimate: "御見積書", delivery: "納品書", receipt: "領収書" };
const AMOUNT_LABELS: Record<DocumentType, string> = {
  invoice: "ご請求金額",
  estimate: "御見積金額",
  delivery: "合計金額",
  receipt: "領収金額",
};
const DUE_LABELS: Record<DocumentType, string | null> = {
  invoice: "お支払期限",
  estimate: "有効期限",
  delivery: "納品日",
  receipt: null,
};
const INTROS: Record<DocumentType, string | null> = {
  invoice: "下記のとおりご請求申し上げます。",
  estimate: "下記のとおりお見積り申し上げます。",
  delivery: "下記のとおり納品いたしました。",
  receipt: null,
};
const TAX_LABELS: Record<TaxCategory, string> = { "10": "10%", "8": "8%※", exempt: "非課税", outside: "不課税" };

const COLUMNS = [
  { key: "name", label: "品名・摘要", width: 80, align: "left" },
  { key: "quantity", label: "数量", width: 18, align: "right" },
  { key: "unit", label: "単位", width: 14, align: "center" },
  { key: "price", label: "単価", width: 25, align: "right" },
  { key: "tax", label: "税率", width: 16, align: "center" },
  { key: "amount", label: "金額", width: 27, align: "right" },
] as const;
const ROW_H = 7;
const MIN_ROWS = 6;

/** "2026-10-06" → "2026年10月6日" */
export function formatJapaneseDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

/** 数量・単価の表示（カンマ区切り、小数は必要な桁のみ） */
export function formatDecimal(value: string): string {
  const parsed = parseDecimal(value, 2);
  if (parsed === null) return value.trim();
  const negative = parsed < 0n;
  const abs = negative ? -parsed : parsed;
  const int = (abs / 100n).toLocaleString("ja-JP");
  const frac = (abs % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${int}${frac ? `.${frac}` : ""}`;
}

/** 指定幅に収まるよう文字単位で折り返す */
export function wrapText(text: string, maxWidth: number, size: number, measure: MeasureText): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const char of paragraph) {
      if (line && measure(line + char, size) > maxWidth) {
        lines.push(line);
        line = char.trim() ? char : "";
      } else {
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** 指定幅に収まらない場合は末尾を「…」にする */
export function truncateText(text: string, maxWidth: number, size: number, measure: MeasureText): string {
  if (measure(text, size) <= maxWidth) return text;
  let result = "";
  for (const char of text) {
    if (measure(`${result}${char}…`, size) > maxWidth) break;
    result += char;
  }
  return `${result}…`;
}

function fit(size: ImageSize | undefined, maxW: number, maxH: number) {
  if (!size || size.width <= 0 || size.height <= 0) return { w: maxW, h: maxH };
  const k = Math.min(maxW / size.width, maxH / size.height);
  return { w: size.width * k, h: size.height * k };
}

export function buildInvoiceLayout(
  data: InvoiceData,
  totals: InvoiceTotals,
  measure: MeasureText,
  images: { logo?: ImageSize; seal?: ImageSize } = {}
): LayoutCommand[][] {
  const pages: LayoutCommand[][] = [[]];
  let page = pages[0];
  const text = (x: number, y: number, size: number, value: string, align: "left" | "right" | "center" = "left", color?: string) => {
    if (!value) return;
    const w = align === "left" ? 0 : measure(value, size);
    page.push({ type: "text", x: align === "right" ? x - w : align === "center" ? x - w / 2 : x, y, size, text: value, color });
  };
  const line = (x1: number, y1: number, x2: number, y2: number, width = 0.2, color = BORDER) =>
    page.push({ type: "line", x1, y1, x2, y2, width, color });
  const newPage = () => {
    page = [];
    pages.push(page);
  };

  // タイトル・書類番号・発行日
  const title = TITLES[data.docType];
  text(PAGE.width / 2, 24, 20, title.length <= 4 ? [...title].join("　") : title, "center");
  let ry = 34;
  if (data.number) {
    text(RIGHT, ry, 9, `No. ${data.number}`, "right");
    ry += 5;
  }
  if (data.issueDate) text(RIGHT, ry, 9, `発行日　${formatJapaneseDate(data.issueDate)}`, "right");

  // 宛先
  let ly = 50;
  const recipientName = data.recipient.name.trim();
  text(M, ly, 14, recipientName ? `${recipientName}　${data.recipient.honorific}` : "");
  line(M, ly + 2.5, M + 100, ly + 2.5, 0.4, "#333333");
  ly += 8;
  for (const row of wrapText(data.recipient.address, 100, 9, measure)) {
    if (!row) continue;
    text(M, ly, 9, row, "left", MUTED);
    ly += 4.5;
  }

  // 発行者（ロゴ・社印）
  const ix = 122;
  const iw = RIGHT - ix;
  let iy = 46;
  if (data.issuer.logo) {
    const { w, h } = fit(images.logo, iw, 12);
    page.push({ type: "image", x: ix, y: iy, w, h, src: data.issuer.logo });
    iy += h + 5;
  } else {
    iy += 4;
  }
  const nameY = iy;
  for (const row of wrapText(data.issuer.name, iw, 11, measure)) {
    text(ix, iy, 11, row);
    iy += 5.5;
  }
  const issuerLines = [
    data.issuer.postalCode && `〒${data.issuer.postalCode.replace(/^〒/, "")}`,
    ...wrapText(data.issuer.address, iw, 8.5, measure),
    data.issuer.tel && `TEL ${data.issuer.tel}`,
    data.issuer.email && data.issuer.email,
    data.issuer.registrationNumber && `登録番号　${data.issuer.registrationNumber}`,
  ].filter((row): row is string => !!row);
  for (const row of issuerLines) {
    text(ix, iy, 8.5, row, "left", MUTED);
    iy += 4.3;
  }
  if (data.issuer.seal) {
    const { w, h } = fit(images.seal, 20, 20);
    page.push({ type: "image", x: RIGHT - w, y: nameY - 6, w, h, src: data.issuer.seal });
  }

  // 前文・件名・金額
  let y = Math.max(ly + 4, 76);
  const intro = INTROS[data.docType];
  if (intro) {
    text(M, y, 9, intro);
    y += 7;
  }
  if (data.subject) {
    text(M, y, 10, `件名　${truncateText(data.subject, 100, 10, measure)}`);
    line(M, y + 1.8, M + 105, y + 1.8);
    y += 8;
  }
  y = Math.max(y, iy + 2);
  page.push({ type: "rect", x: M, y, w: 105, h: 12, stroke: "#333333", strokeWidth: 0.4 });
  text(M + 3, y + 7.6, 10, AMOUNT_LABELS[data.docType]);
  text(M + 102, y + 8.3, 15, `${formatYen(totals.amountDue)} -（税込）`, "right");
  const dueLabel = DUE_LABELS[data.docType];
  if (dueLabel && data.dueDate) text(M + 110, y + 7.6, 9, `${dueLabel}　${formatJapaneseDate(data.dueDate)}`);
  y += 19;

  // 明細
  const drawHeader = () => {
    page.push({ type: "rect", x: M, y, w: RIGHT - M, h: ROW_H, fill: HEADER_FILL, stroke: BORDER, strokeWidth: 0.2 });
    let x = M;
    for (const col of COLUMNS) {
      text(x + col.width / 2, y + 4.8, 8.5, col.label, "center");
      x += col.width;
    }
    y += ROW_H;
  };
  drawHeader();
  const rowCount = Math.max(MIN_ROWS, data.items.length);
  for (let i = 0; i < rowCount; i++) {
    if (y + ROW_H > BOTTOM) {
      newPage();
      y = 20;
      drawHeader();
    }
    const item = data.items[i];
    let x = M;
    for (const col of COLUMNS) {
      line(x, y, x, y + ROW_H);
      if (item) {
        const amount = totals.lineAmounts[i];
        const value = {
          name: item.name + (item.tax === "8" ? " ※" : ""),
          quantity: formatDecimal(item.quantity),
          unit: item.unit,
          price: formatDecimal(item.unitPrice),
          tax: TAX_LABELS[item.tax],
          amount: amount === null ? "—" : amount.toLocaleString("ja-JP"),
        }[col.key];
        const fitted = truncateText(value, col.width - 3, 9, measure);
        const tx = col.align === "left" ? x + 1.5 : col.align === "right" ? x + col.width - 1.5 : x + col.width / 2;
        text(tx, y + 4.8, 9, fitted, col.align);
      }
      x += col.width;
    }
    line(RIGHT, y, RIGHT, y + ROW_H);
    line(M, y + ROW_H, RIGHT, y + ROW_H);
    y += ROW_H;
  }

  // 税率ごとの集計
  const inclusive = data.taxMode === "inclusive";
  const summary: [string, string][] = [];
  for (const group of totals.groups) {
    if (group.category === "exempt" || group.category === "outside") {
      summary.push([group.category === "exempt" ? "非課税" : "不課税", formatYen(group.base)]);
      continue;
    }
    const name = group.category === "8" ? "8%対象（軽減税率）" : "10%対象";
    summary.push([inclusive ? `${name}（税込）` : name, formatYen(inclusive ? group.total : group.base)]);
    summary.push([inclusive ? `　内消費税（${group.category}%）` : `消費税（${group.category}%）`, formatYen(group.tax)]);
  }
  summary.push(["合計（税込）", formatYen(totals.total)]);
  if (data.withholding) {
    summary.push(["源泉徴収税額", formatYen(-totals.withholding)]);
    summary.push([data.docType === "receipt" ? "差引領収額" : "差引請求額", formatYen(totals.amountDue)]);
  }

  const leftNotes: string[] = [];
  if (data.items.some((item) => item.tax === "8")) leftNotes.push("※印は軽減税率（8%）対象品目です。");
  if (data.docType === "receipt") {
    leftNotes.push(`但し　${data.subject || "お品代"}　として`, "上記正に領収いたしました。");
  }
  const bank = data.issuer;
  const bankLines =
    data.docType === "invoice" && (bank.bankName || bank.accountNumber)
      ? [
          "【お振込先】",
          [bank.bankName, bank.branchName].filter(Boolean).join("　"),
          [bank.accountType, bank.accountNumber].filter(Boolean).join("　"),
          bank.accountHolder && `口座名義　${bank.accountHolder}`,
        ].filter(Boolean)
      : [];

  const summaryH = summary.length * 6 + 4;
  const leftH = (leftNotes.length + bankLines.length) * 4.6 + 4;
  if (y + Math.max(summaryH, leftH) > BOTTOM) {
    newPage();
    y = 20;
  }
  let sy = y + 3;
  const sx = 120;
  summary.forEach(([label, value], index) => {
    const last = index === summary.length - 1;
    if (last) page.push({ type: "rect", x: sx, y: sy, w: RIGHT - sx, h: 6, fill: HEADER_FILL });
    text(sx + 1.5, sy + 4.3, last ? 9.5 : 8.5, label);
    text(RIGHT - 1.5, sy + 4.3, last ? 9.5 : 8.5, value, "right");
    line(sx, sy + 6, RIGHT, sy + 6);
    sy += 6;
  });
  let ny = y + 7;
  for (const row of [...leftNotes, ...(leftNotes.length && bankLines.length ? [""] : []), ...bankLines]) {
    text(M, ny, 8.5, row);
    ny += 4.6;
  }
  y = Math.max(sy, ny) + 5;

  // 備考
  if (data.notes.trim()) {
    const rows = wrapText(data.notes.trim(), RIGHT - M - 6, 8.5, measure);
    const h = rows.length * 4.4 + 9;
    if (y + h > BOTTOM) {
      newPage();
      y = 20;
    }
    text(M, y + 4, 9, "備考");
    page.push({ type: "rect", x: M, y: y + 6, w: RIGHT - M, h: h - 4, stroke: BORDER, strokeWidth: 0.2 });
    rows.forEach((row, index) => text(M + 3, y + 11 + index * 4.4, 8.5, row));
  }

  if (pages.length > 1) {
    pages.forEach((commands, index) => {
      page = commands;
      text(PAGE.width / 2, PAGE.height - 8, 8, `${index + 1} / ${pages.length}`, "center", MUTED);
    });
  }
  return pages;
}
