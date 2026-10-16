"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Download,
  FileDown,
  FileUp,
  Hash,
  ImagePlus,
  Info,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { downloadBytes } from "@/lib/download";
import {
  calculateInvoice,
  createEmptyInvoice,
  formatDocumentNumber,
  formatYen,
  isValidRegistrationNumber,
  newItem,
  normalizeInvoiceData,
  sequenceKey,
  TAX_CATEGORIES,
  validateInvoice,
  type DocumentType,
  type InvoiceData,
  type InvoiceItem,
} from "@/lib/invoice";
import { buildInvoiceLayout, PAGE, type ImageSize, type LayoutCommand } from "@/lib/invoice-layout";
import { INVOICE_FONT_URL, type InvoiceFont } from "@/lib/invoice-pdf";
import { cn, formatTemplate } from "@/lib/utils";

const DRAFT_KEY = "clientkit:invoice:draft";
const TEMPLATES_KEY = "clientkit:invoice:templates";
const NUMBERING_KEY = "clientkit:invoice:numbering";
const DOC_TYPES: DocumentType[] = ["invoice", "estimate", "delivery", "receipt"];
const FONT_FAMILY = "ClientKitInvoiceFont";
const PT_TO_MM = 25.4 / 72;
const MAX_IMAGE_EDGE = 600;

type Template = { name: string; savedAt: string; data: InvoiceData };
type Numbering = { pattern: string; counters: Record<string, number> };

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const loadFont = () => import("@/lib/invoice-pdf").then((module) => module.loadInvoiceFont());

/** 画像を長辺600px以内のPNGに変換する（PDFに埋め込めるのはPNG・JPEGのみのため） */
function imageFileToPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const k = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * k));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * k));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    image.src = url;
  });
}

function useImageSize(src: string): ImageSize | undefined {
  const [size, setSize] = React.useState<{ src: string; size: ImageSize } | null>(null);
  React.useEffect(() => {
    if (!src) return;
    const image = new Image();
    image.onload = () => setSize({ src, size: { width: image.naturalWidth, height: image.naturalHeight } });
    image.src = src;
  }, [src]);
  return size?.src === src ? size.size : undefined;
}

function PreviewPage({ commands, label }: { commands: LayoutCommand[]; label: string }) {
  return (
    <svg
      viewBox={`0 0 ${PAGE.width} ${PAGE.height}`}
      className="h-auto w-full bg-white text-black shadow-md ring-1 ring-black/10"
      role="img"
      aria-label={label}
    >
      {commands.map((c, i) => {
        if (c.type === "text") {
          return (
            <text
              key={i}
              x={c.x}
              y={c.y}
              fontSize={c.size * PT_TO_MM}
              fontFamily={FONT_FAMILY}
              fill={c.color ?? "#000"}
              style={{ whiteSpace: "pre" }}
            >
              {c.text}
            </text>
          );
        }
        if (c.type === "line") {
          return <line key={i} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke={c.color ?? "#000"} strokeWidth={c.width} />;
        }
        if (c.type === "rect") {
          return (
            <rect
              key={i}
              x={c.x}
              y={c.y}
              width={c.w}
              height={c.h}
              fill={c.fill ?? "none"}
              stroke={c.stroke ?? "none"}
              strokeWidth={c.strokeWidth ?? 0.2}
            />
          );
        }
        return <image key={i} href={c.src} x={c.x} y={c.y} width={c.w} height={c.h} preserveAspectRatio="none" />;
      })}
    </svg>
  );
}

export function InvoiceGeneratorTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.invoiceGenerator, [locale]);

  const [data, setData] = React.useState<InvoiceData>(createEmptyInvoice);
  const [font, setFont] = React.useState<InvoiceFont | null>(null);
  const [fontError, setFontError] = React.useState(false);
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [templateName, setTemplateName] = React.useState("");
  const [selectedTemplate, setSelectedTemplate] = React.useState("");
  const [numbering, setNumbering] = React.useState<Numbering>({ pattern: "INV-{YYYY}-{NNN}", counters: {} });
  const [message, setMessage] = React.useState<{ text: string; error?: boolean } | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [restored, setRestored] = React.useState(false);

  const importRef = React.useRef<HTMLInputElement>(null);
  const logoRef = React.useRef<HTMLInputElement>(null);
  const sealRef = React.useRef<HTMLInputElement>(null);

  // 端末に保存された下書き・テンプレート・採番設定を読み込む
  React.useEffect(() => {
    Promise.resolve().then(() => {
      const draft = readStorage<unknown>(DRAFT_KEY, null);
      if (draft) setData(normalizeInvoiceData(draft));
      setTemplates(readStorage<Template[]>(TEMPLATES_KEY, []));
      setNumbering((prev) => readStorage<Numbering>(NUMBERING_KEY, prev));
      setRestored(true);
    });
  }, []);

  React.useEffect(() => {
    if (!restored) return;
    const timer = window.setTimeout(() => {
      if (!writeStorage(DRAFT_KEY, data)) setMessage({ text: dict.storageFull, error: true });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [data, restored, dict]);

  React.useEffect(() => {
    let cancelled = false;
    loadFont()
      .then((loaded) => {
        if (!cancelled) setFont(loaded);
      })
      .catch(() => {
        if (!cancelled) setFontError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const measure = React.useMemo(() => {
    if (!font) return null;
    const cache = new Map<string, number>();
    return (text: string, size: number) => {
      const key = `${size}|${text}`;
      let width = cache.get(key);
      if (width === undefined) {
        width = font.measure(text, size);
        cache.set(key, width);
      }
      return width;
    };
  }, [font]);

  const deferredData = React.useDeferredValue(data);
  const totals = React.useMemo(() => calculateInvoice(data), [data]);
  const warnings = React.useMemo(() => validateInvoice(data, totals), [data, totals]);
  const logoSize = useImageSize(deferredData.issuer.logo);
  const sealSize = useImageSize(deferredData.issuer.seal);
  const pages = React.useMemo(() => {
    if (!measure) return null;
    return buildInvoiceLayout(deferredData, calculateInvoice(deferredData), measure, { logo: logoSize, seal: sealSize });
  }, [deferredData, measure, logoSize, sealSize]);

  const update = (patch: Partial<InvoiceData>) => setData((prev) => ({ ...prev, ...patch }));
  const updateIssuer = (patch: Partial<InvoiceData["issuer"]>) =>
    setData((prev) => ({ ...prev, issuer: { ...prev.issuer, ...patch } }));
  const updateRecipient = (patch: Partial<InvoiceData["recipient"]>) =>
    setData((prev) => ({ ...prev, recipient: { ...prev.recipient, ...patch } }));
  const updateItem = (id: string, patch: Partial<InvoiceItem>) =>
    setData((prev) => ({ ...prev, items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  const moveItem = (index: number, delta: number) =>
    setData((prev) => {
      const items = prev.items.slice();
      const target = index + delta;
      if (target < 0 || target >= items.length) return prev;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...prev, items };
    });

  function flash(text: string, error = false) {
    setMessage({ text, error });
    window.setTimeout(() => setMessage((current) => (current?.text === text ? null : current)), 3000);
  }

  function assignNumber() {
    const key = sequenceKey(numbering.pattern, data.issueDate);
    const sequence = (numbering.counters[key] ?? 0) + 1;
    const next = { ...numbering, counters: { ...numbering.counters, [key]: sequence } };
    setNumbering(next);
    writeStorage(NUMBERING_KEY, next);
    update({ number: formatDocumentNumber(numbering.pattern, data.issueDate, sequence) });
  }

  function saveTemplate() {
    const name = templateName.trim();
    if (!name) return;
    const next = [...templates.filter((t) => t.name !== name), { name, savedAt: new Date().toISOString(), data }];
    if (writeStorage(TEMPLATES_KEY, next)) {
      setTemplates(next);
      setSelectedTemplate(name);
      setTemplateName("");
      flash(formatTemplate(dict.templateSaved, { name }));
    } else {
      flash(dict.storageFull, true);
    }
  }

  function loadTemplate() {
    const template = templates.find((t) => t.name === selectedTemplate);
    if (!template) return;
    // テンプレートは再利用のためのものなので、書類番号と日付は引き継がない
    const restoredData = normalizeInvoiceData(template.data);
    setData({ ...restoredData, number: "", issueDate: createEmptyInvoice().issueDate, dueDate: "" });
    flash(formatTemplate(dict.templateLoaded, { name: template.name }));
  }

  function deleteTemplate() {
    const next = templates.filter((t) => t.name !== selectedTemplate);
    writeStorage(TEMPLATES_KEY, next);
    setTemplates(next);
    setSelectedTemplate("");
  }

  async function handleImport(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      setData(normalizeInvoiceData(parsed?.data ?? parsed));
      flash(dict.imported);
    } catch {
      flash(dict.importError, true);
    }
  }

  async function handleImage(kind: "logo" | "seal", file: File) {
    try {
      updateIssuer({ [kind]: await imageFileToPng(file) });
    } catch {
      flash(dict.imageError, true);
    }
  }

  async function handleDownloadPdf() {
    if (!font || !measure) return;
    setExporting(true);
    try {
      const { renderInvoicePdf } = await import("@/lib/invoice-pdf");
      const layout = buildInvoiceLayout(data, totals, measure, { logo: logoSize, seal: sealSize });
      const title = dict.docTypes[data.docType];
      const bytes = await renderInvoicePdf(layout, font.bytes, title);
      const suffix = (data.number || data.issueDate || "draft").replace(/[\\/:*?"<>|]/g, "_");
      downloadBytes(bytes, `${title}_${suffix}.pdf`, "application/pdf");
    } catch {
      flash(dict.pdfError, true);
    } finally {
      setExporting(false);
    }
  }

  const field = (id: string, label: string, control: React.ReactNode, hint?: React.ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`invoice-${id}`} className="text-xs text-muted-foreground">
        {label}
      </label>
      {control}
      {hint}
    </div>
  );
  const input = (id: string, label: string, value: string, onChange: (value: string) => void, props: React.ComponentProps<"input"> = {}) =>
    field(id, label, <Input id={`invoice-${id}`} value={value} onChange={(e) => onChange(e.target.value)} {...props} />);
  const section = (title: string, children: React.ReactNode) => (
    <fieldset className="flex flex-col gap-3 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      {children}
    </fieldset>
  );

  const dueLabel = { invoice: dict.dueDateInvoice, estimate: dict.dueDateEstimate, delivery: dict.dueDateDelivery, receipt: "" }[
    data.docType
  ];
  const registrationInvalid = !!data.issuer.registrationNumber.trim() && !isValidRegistrationNumber(data.issuer.registrationNumber);

  return (
    <div className="flex flex-col gap-4">
      <style>{`@font-face{font-family:"${FONT_FAMILY}";src:url("${INVOICE_FONT_URL}") format("truetype");font-display:block;}`}</style>
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{dict.disclaimer}</span>
      </div>
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div role="tablist" aria-label={dict.docTypeLabel} className="inline-flex w-fit flex-wrap rounded-md border p-1">
        {DOC_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={data.docType === type}
            onClick={() => update({ docType: type })}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              data.docType === type ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {dict.docTypes[type]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {section(
            dict.documentSection,
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field(
                "number",
                dict.number,
                <div className="flex gap-2">
                  <Input id="invoice-number" value={data.number} onChange={(e) => update({ number: e.target.value })} />
                  <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={assignNumber}>
                    <Hash className="size-4" />
                    {dict.assignNumber}
                  </Button>
                </div>
              )}
              {input("pattern", dict.numberPattern, numbering.pattern, (value) => {
                const next = { ...numbering, pattern: value };
                setNumbering(next);
                writeStorage(NUMBERING_KEY, next);
              })}
              {input("issue-date", dict.issueDate, data.issueDate, (value) => update({ issueDate: value }), { type: "date" })}
              {dueLabel && input("due-date", dueLabel, data.dueDate, (value) => update({ dueDate: value }), { type: "date" })}
              <div className="sm:col-span-2">
                {input("subject", data.docType === "receipt" ? dict.subjectReceipt : dict.subject, data.subject, (value) =>
                  update({ subject: value })
                )}
              </div>
            </div>
          )}

          {section(
            dict.recipientSection,
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              {input("recipient-name", dict.recipientName, data.recipient.name, (value) => updateRecipient({ name: value }))}
              <div className="flex flex-col gap-1.5">
                <label id="invoice-honorific-label" className="text-xs text-muted-foreground">
                  {dict.honorific}
                </label>
                <Select
                  value={data.recipient.honorific}
                  onValueChange={(value) => updateRecipient({ honorific: value as InvoiceData["recipient"]["honorific"] })}
                >
                  <SelectTrigger className="w-full" aria-labelledby="invoice-honorific-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="御中">御中</SelectItem>
                    <SelectItem value="様">様</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                {field(
                  "recipient-address",
                  dict.address,
                  <Textarea
                    id="invoice-recipient-address"
                    value={data.recipient.address}
                    onChange={(e) => updateRecipient({ address: e.target.value })}
                    className="min-h-16"
                  />
                )}
              </div>
            </div>
          )}

          {section(
            dict.issuerSection,
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {input("issuer-name", dict.issuerName, data.issuer.name, (value) => updateIssuer({ name: value }))}
              </div>
              {input("postal", dict.postalCode, data.issuer.postalCode, (value) => updateIssuer({ postalCode: value }), {
                inputMode: "numeric",
                placeholder: "100-0001",
              })}
              {input("tel", dict.tel, data.issuer.tel, (value) => updateIssuer({ tel: value }), { type: "tel" })}
              <div className="sm:col-span-2">
                {field(
                  "issuer-address",
                  dict.address,
                  <Textarea
                    id="invoice-issuer-address"
                    value={data.issuer.address}
                    onChange={(e) => updateIssuer({ address: e.target.value })}
                    className="min-h-16"
                  />
                )}
              </div>
              {input("email", dict.email, data.issuer.email, (value) => updateIssuer({ email: value }), { type: "email" })}
              {field(
                "registration",
                dict.registrationNumber,
                <Input
                  id="invoice-registration"
                  value={data.issuer.registrationNumber}
                  onChange={(e) => updateIssuer({ registrationNumber: e.target.value })}
                  placeholder="T1234567890123"
                  aria-invalid={registrationInvalid}
                  aria-describedby="invoice-registration-hint"
                />,
                <p
                  id="invoice-registration-hint"
                  className={cn("text-xs", registrationInvalid ? "text-destructive" : "text-muted-foreground")}
                >
                  {registrationInvalid ? dict.registrationInvalid : dict.registrationHint}
                </p>
              )}
              {data.docType === "invoice" && (
                <>
                  {input("bank", dict.bankName, data.issuer.bankName, (value) => updateIssuer({ bankName: value }))}
                  {input("branch", dict.branchName, data.issuer.branchName, (value) => updateIssuer({ branchName: value }))}
                  <div className="flex flex-col gap-1.5">
                    <label id="invoice-account-type-label" className="text-xs text-muted-foreground">
                      {dict.accountType}
                    </label>
                    <Select value={data.issuer.accountType} onValueChange={(value) => updateIssuer({ accountType: value })}>
                      <SelectTrigger className="w-full" aria-labelledby="invoice-account-type-label">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["普通", "当座", "貯蓄"].map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {input("account-number", dict.accountNumber, data.issuer.accountNumber, (value) =>
                    updateIssuer({ accountNumber: value })
                  , { inputMode: "numeric" })}
                  <div className="sm:col-span-2">
                    {input("account-holder", dict.accountHolder, data.issuer.accountHolder, (value) =>
                      updateIssuer({ accountHolder: value })
                    )}
                  </div>
                </>
              )}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                {(
                  [
                    ["logo", logoRef, dict.logo],
                    ["seal", sealRef, dict.seal],
                  ] as const
                ).map(([kind, ref, label]) => (
                  <div key={kind} className="flex items-center gap-1">
                    <input
                      ref={ref}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImage(kind, file);
                        e.target.value = "";
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}>
                      <ImagePlus className="size-4" />
                      {data.issuer[kind] ? formatTemplate(dict.changeImage, { label }) : formatTemplate(dict.addImage, { label })}
                    </Button>
                    {data.issuer[kind] && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={formatTemplate(dict.removeImage, { label })}
                        onClick={() => updateIssuer({ [kind]: "" })}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {section(
            dict.itemsSection,
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex w-fit rounded-md border p-1" role="radiogroup" aria-label={dict.taxModeLabel}>
                  {(["exclusive", "inclusive"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={data.taxMode === mode}
                      onClick={() => update({ taxMode: mode })}
                      className={cn(
                        "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                        data.taxMode === mode ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {mode === "exclusive" ? dict.taxExclusive : dict.taxInclusive}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span id="invoice-rounding-label" className="text-xs text-muted-foreground">
                    {dict.roundingLabel}
                  </span>
                  <Select value={data.rounding} onValueChange={(value) => update({ rounding: value as InvoiceData["rounding"] })}>
                    <SelectTrigger className="w-32" aria-labelledby="invoice-rounding-label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="floor">{dict.roundingFloor}</SelectItem>
                      <SelectItem value="round">{dict.roundingRound}</SelectItem>
                      <SelectItem value="ceil">{dict.roundingCeil}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ol className="flex flex-col gap-3">
                {data.items.map((item, index) => {
                  const amount = totals.lineAmounts[index];
                  return (
                    <li key={item.id} className="grid grid-cols-12 gap-2 rounded-md border p-2">
                      <Input
                        aria-label={formatTemplate(dict.itemName, { n: index + 1 })}
                        placeholder={dict.itemNamePlaceholder}
                        value={item.name}
                        onChange={(e) => updateItem(item.id, { name: e.target.value })}
                        className="col-span-12"
                      />
                      <Input
                        aria-label={dict.quantity}
                        placeholder={dict.quantity}
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                        className="col-span-4 sm:col-span-2"
                      />
                      <Input
                        aria-label={dict.unit}
                        placeholder={dict.unit}
                        value={item.unit}
                        onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                        className="col-span-4 sm:col-span-2"
                      />
                      <Input
                        aria-label={dict.unitPrice}
                        placeholder={dict.unitPrice}
                        inputMode="decimal"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, { unitPrice: e.target.value })}
                        aria-invalid={amount === null}
                        className="col-span-4 sm:col-span-4"
                      />
                      <div className="col-span-12 sm:col-span-4">
                        <Select value={item.tax} onValueChange={(value) => updateItem(item.id, { tax: value as InvoiceItem["tax"] })}>
                          <SelectTrigger className="w-full" aria-label={dict.taxRate}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TAX_CATEGORIES.map((category) => (
                              <SelectItem key={category} value={category}>
                                {dict.taxCategories[category === "8" ? "reduced" : category === "10" ? "standard" : category]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-12 flex items-center justify-end gap-0.5">
                        <span className="mr-auto pl-1 text-sm tabular-nums">
                          {amount === null ? <span className="text-destructive">{dict.invalidNumber}</span> : formatYen(amount)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={dict.moveUp}
                          disabled={index === 0}
                          onClick={() => moveItem(index, -1)}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={dict.moveDown}
                          disabled={index === data.items.length - 1}
                          onClick={() => moveItem(index, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={dict.removeItem}
                          onClick={() => update({ items: data.items.filter((entry) => entry.id !== item.id) })}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => update({ items: [...data.items, newItem()] })}>
                  <Plus className="size-4" />
                  {dict.addItem}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => update({ items: [...data.items, newItem({ name: dict.discountName, unitPrice: "-" })] })}
                >
                  <Plus className="size-4" />
                  {dict.addDiscount}
                </Button>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="invoice-withholding"
                  checked={data.withholding}
                  onCheckedChange={(checked) => update({ withholding: checked === true })}
                  className="mt-0.5"
                />
                <label htmlFor="invoice-withholding" className="text-sm">
                  {dict.withholding}
                  <span className="block text-xs text-muted-foreground">{dict.withholdingHint}</span>
                </label>
              </div>
            </>
          )}

          {section(
            dict.notes,
            <Textarea
              aria-label={dict.notes}
              value={data.notes}
              onChange={(e) => update({ notes: e.target.value })}
              className="min-h-20"
            />
          )}

          {section(
            dict.templateSection,
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">{dict.templateHint}</p>
              <div className="flex flex-wrap gap-2">
                <Input
                  aria-label={dict.templateName}
                  placeholder={dict.templateName}
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTemplate();
                  }}
                  className="w-48"
                />
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={saveTemplate} disabled={!templateName.trim()}>
                  <Save className="size-4" />
                  {dict.saveTemplate}
                </Button>
              </div>
              {templates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger className="w-48" aria-label={dict.templateList}>
                      <SelectValue placeholder={dict.templateList} />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.name} value={template.name}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" className="h-9" onClick={loadTemplate} disabled={!selectedTemplate}>
                    {dict.loadTemplate}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-9" onClick={deleteTemplate} disabled={!selectedTemplate}>
                    <Trash2 className="size-4" />
                    {dict.deleteTemplate}
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImport(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadBytes(
                      new TextEncoder().encode(JSON.stringify({ version: 1, data }, null, 2)),
                      `${dict.docTypes[data.docType]}_${data.number || data.issueDate || "draft"}.json`,
                      "application/json"
                    )
                  }
                >
                  <FileDown className="size-4" />
                  {dict.exportJson}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => importRef.current?.click()}>
                  <FileUp className="size-4" />
                  {dict.importJson}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setData((prev) => ({ ...createEmptyInvoice(), docType: prev.docType, issuer: prev.issuer }))}
                >
                  {dict.newDocument}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-20 xl:self-start">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{dict.previewLabel}</span>
            <Button type="button" onClick={handleDownloadPdf} disabled={!font || exporting}>
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {dict.downloadPdf}
            </Button>
          </div>
          {message && (
            <p className={cn("text-sm", message.error ? "text-destructive" : "text-muted-foreground")} role="status">
              {message.text}
            </p>
          )}
          {warnings.length > 0 && (
            <div className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              <span className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="size-4" aria-hidden="true" />
                {dict.warningsHeading}
              </span>
              <ul className="list-disc pl-5">
                {warnings.map((warning) => (
                  <li key={warning}>{dict.warnings[warning]}</li>
                ))}
              </ul>
            </div>
          )}
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-md border p-3 text-sm tabular-nums">
            {totals.groups.map((group) => (
              <React.Fragment key={group.category}>
                <dt className="text-muted-foreground">
                  {formatTemplate(dict.groupSummary, {
                    label: dict.taxCategories[group.category === "8" ? "reduced" : group.category === "10" ? "standard" : group.category],
                  })}
                </dt>
                <dd className="text-right">
                  {formatYen(group.base)} / {dict.tax} {formatYen(group.tax)}
                </dd>
              </React.Fragment>
            ))}
            <dt className="font-medium">{dict.totalLabel}</dt>
            <dd className="text-right font-medium">{formatYen(totals.total)}</dd>
            {data.withholding && (
              <>
                <dt className="text-muted-foreground">{dict.withholdingLabel}</dt>
                <dd className="text-right">{formatYen(-totals.withholding)}</dd>
                <dt className="font-medium">{dict.amountDueLabel}</dt>
                <dd className="text-right font-medium">{formatYen(totals.amountDue)}</dd>
              </>
            )}
          </dl>
          {fontError ? (
            <p className="text-sm text-destructive" role="alert">
              {dict.fontError}
            </p>
          ) : pages ? (
            <div className="flex flex-col gap-4 rounded-md bg-muted/50 p-3">
              {pages.map((commands, index) => (
                <PreviewPage
                  key={index}
                  commands={commands}
                  label={formatTemplate(dict.pageLabel, { page: index + 1, total: pages.length })}
                />
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {dict.fontLoading}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
