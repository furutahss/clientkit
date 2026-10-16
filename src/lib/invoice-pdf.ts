/**
 * 帳票の描画命令（invoice-layout）をPDFに書き出す。日本語フォント（Noto Sans JP）を
 * サブセット化して埋め込む。pdf-lib・fontkit・フォントはこのツールでのみ動的に読み込む。
 */
import type { LayoutCommand, MeasureText } from "@/lib/invoice-layout";
import { PAGE } from "@/lib/invoice-layout";

/** セルフホストしているフォント（scripts/copy-vendor-assets.mjs でコピー） */
export const INVOICE_FONT_URL = "/vendor/fonts/NotoSansJP-Regular.ttf";
const PT_PER_MM = 72 / 25.4;

async function loadLibraries() {
  const [{ PDFDocument, rgb }, fontkitModule] = await Promise.all([
    import("@pdfme/pdf-lib"),
    import("fontkit"),
  ]);
  // fontkit 2.x はモジュール自体（create などの名前付きエクスポート）を fontkit として渡す。
  // @pdf-lib/fontkit はサブセット化した日本語フォントの一部の文字が欠けるため使わない
  const fontkit = fontkitModule.default ?? fontkitModule;
  return { PDFDocument, rgb, fontkit };
}

export type InvoiceFont = { bytes: ArrayBuffer; measure: MeasureText };

/** フォントを読み込み、PDFと同じ文字幅で測る関数を作る */
export async function loadInvoiceFont(): Promise<InvoiceFont> {
  const [{ PDFDocument, fontkit }, bytes] = await Promise.all([
    loadLibraries(),
    fetch(INVOICE_FONT_URL).then((response) => {
      if (!response.ok) throw new Error(`font ${response.status}`);
      return response.arrayBuffer();
    }),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(bytes, { subset: true });
  return { bytes, measure: (text, size) => font.widthOfTextAtSize(text, size) / PT_PER_MM };
}

function hexToRgb(rgb: (r: number, g: number, b: number) => ReturnType<typeof import("@pdfme/pdf-lib").rgb>, hex: string) {
  const value = parseInt(hex.replace("#", ""), 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

/** 描画命令からPDFを作る */
export async function renderInvoicePdf(pages: LayoutCommand[][], fontBytes: ArrayBuffer, title: string): Promise<Uint8Array> {
  const { PDFDocument, rgb, fontkit } = await loadLibraries();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setCreator("ClientKit");
  const font = await doc.embedFont(fontBytes, { subset: true });
  const images = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();
  const width = PAGE.width * PT_PER_MM;
  const height = PAGE.height * PT_PER_MM;
  const x = (mm: number) => mm * PT_PER_MM;
  const y = (mm: number) => height - mm * PT_PER_MM;
  const color = (hex: string | undefined) => hexToRgb(rgb, hex ?? "#000000");

  for (const commands of pages) {
    const page = doc.addPage([width, height]);
    for (const c of commands) {
      if (c.type === "text") {
        page.drawText(c.text, { x: x(c.x), y: y(c.y), size: c.size, font, color: color(c.color) });
      } else if (c.type === "line") {
        page.drawLine({
          start: { x: x(c.x1), y: y(c.y1) },
          end: { x: x(c.x2), y: y(c.y2) },
          thickness: c.width * PT_PER_MM,
          color: color(c.color),
        });
      } else if (c.type === "rect") {
        page.drawRectangle({
          x: x(c.x),
          y: y(c.y + c.h),
          width: c.w * PT_PER_MM,
          height: c.h * PT_PER_MM,
          color: c.fill ? color(c.fill) : undefined,
          borderColor: c.stroke ? color(c.stroke) : undefined,
          borderWidth: c.stroke ? (c.strokeWidth ?? 0.2) * PT_PER_MM : 0,
        });
      } else {
        let image = images.get(c.src);
        if (!image) {
          const bytes = Uint8Array.from(atob(c.src.split(",")[1] ?? ""), (ch) => ch.charCodeAt(0));
          image = c.src.startsWith("data:image/jpeg") ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
          images.set(c.src, image);
        }
        page.drawImage(image, { x: x(c.x), y: y(c.y + c.h), width: c.w * PT_PER_MM, height: c.h * PT_PER_MM });
      }
    }
  }
  return doc.save();
}
