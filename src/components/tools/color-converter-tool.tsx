"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  contrastRatio,
  evaluateWcag,
  formatCmyk,
  formatHex,
  formatHsl,
  formatHsv,
  formatRgb,
  parseCmykString,
  parseHex,
  parseHslString,
  parseHsvString,
  parseRgbString,
  type Rgb,
} from "@/lib/color";
import { cn } from "@/lib/utils";

type FormatKey = "hex" | "rgb" | "hsl" | "hsv" | "cmyk";

const FORMATS: { key: FormatKey; label: string }[] = [
  { key: "hex", label: "HEX" },
  { key: "rgb", label: "RGB" },
  { key: "hsl", label: "HSL" },
  { key: "hsv", label: "HSV" },
  { key: "cmyk", label: "CMYK" },
];

const DEFAULT_RGB: Rgb = { r: 37, g: 99, b: 235 };

function formatFor(key: FormatKey, rgb: Rgb): string {
  switch (key) {
    case "hex":
      return formatHex(rgb);
    case "rgb":
      return formatRgb(rgb);
    case "hsl":
      return formatHsl(rgb);
    case "hsv":
      return formatHsv(rgb);
    case "cmyk":
      return formatCmyk(rgb);
  }
}

function parseFor(key: FormatKey, value: string): Rgb | null {
  switch (key) {
    case "hex":
      return parseHex(value);
    case "rgb":
      return parseRgbString(value);
    case "hsl":
      return parseHslString(value);
    case "hsv":
      return parseHsvString(value);
    case "cmyk":
      return parseCmykString(value);
  }
}

function computeAllDrafts(rgb: Rgb): Record<FormatKey, string> {
  return {
    hex: formatFor("hex", rgb),
    rgb: formatFor("rgb", rgb),
    hsl: formatFor("hsl", rgb),
    hsv: formatFor("hsv", rgb),
    cmyk: formatFor("cmyk", rgb),
  };
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // クリップボードAPIが利用できない環境では何もしない
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      aria-label="コピー"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}

function ColorConverter() {
  const [rgb, setRgb] = React.useState<Rgb>(DEFAULT_RGB);
  const [activeField, setActiveField] = React.useState<FormatKey | null>(null);
  const [editingText, setEditingText] = React.useState("");
  const [invalidField, setInvalidField] = React.useState<FormatKey | null>(null);

  const drafts = React.useMemo(() => {
    const computed = computeAllDrafts(rgb);
    if (activeField) computed[activeField] = editingText;
    return computed;
  }, [rgb, activeField, editingText]);

  function handleFocus(key: FormatKey) {
    setActiveField(key);
    setEditingText(formatFor(key, rgb));
  }

  function handleChange(key: FormatKey, value: string) {
    setEditingText(value);
    const parsed = parseFor(key, value);
    if (parsed) {
      setInvalidField(null);
      setRgb(parsed);
    } else {
      setInvalidField(key);
    }
  }

  function handleBlur() {
    setActiveField(null);
    setInvalidField(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <input
          type="color"
          value={formatHex(rgb)}
          onChange={(e) => {
            const parsed = parseHex(e.target.value);
            if (parsed) setRgb(parsed);
          }}
          className="size-16 cursor-pointer rounded-md border"
          aria-label="カラーピッカー"
        />
        <div
          className="h-16 flex-1 rounded-md border"
          style={{ backgroundColor: formatRgb(rgb) }}
          aria-hidden="true"
        />
      </div>

      <div className="flex flex-col gap-2">
        {FORMATS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-sm font-medium text-muted-foreground">
              {label}
            </span>
            <Input
              value={drafts[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              onFocus={() => handleFocus(key)}
              onBlur={handleBlur}
              spellCheck={false}
              className={cn(
                "font-mono text-sm",
                invalidField === key && "border-destructive"
              )}
              aria-invalid={invalidField === key}
            />
            <CopyButton value={drafts[key]} />
          </div>
        ))}
      </div>
      {invalidField && (
        <p className="text-sm text-destructive">
          {FORMATS.find((f) => f.key === invalidField)?.label}
          の値を正しく解釈できませんでした。
        </p>
      )}
    </div>
  );
}

function ContrastChecker() {
  const [foreground, setForeground] = React.useState("#000000");
  const [background, setBackground] = React.useState("#FFFFFF");

  const fgRgb = parseHex(foreground);
  const bgRgb = parseHex(background);
  const result = fgRgb && bgRgb ? evaluateWcag(fgRgb, bgRgb) : null;

  function badge(pass: boolean, label: string) {
    return (
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-medium",
          pass
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
            : "bg-destructive/10 text-destructive"
        )}
      >
        {label}: {pass ? "Pass" : "Fail"}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">文字色（前景色）</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={parseHex(foreground) ? foreground : "#000000"}
              onChange={(e) => setForeground(e.target.value)}
              className="size-10 shrink-0 cursor-pointer rounded-md border"
              aria-label="文字色のカラーピッカー"
            />
            <Input
              value={foreground}
              onChange={(e) => setForeground(e.target.value)}
              spellCheck={false}
              className="font-mono text-sm"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">背景色</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={parseHex(background) ? background : "#FFFFFF"}
              onChange={(e) => setBackground(e.target.value)}
              className="size-10 shrink-0 cursor-pointer rounded-md border"
              aria-label="背景色のカラーピッカー"
            />
            <Input
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              spellCheck={false}
              className="font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {!fgRgb || !bgRgb ? (
        <p className="text-sm text-destructive">
          文字色・背景色をHEX形式（例: #000000）で入力してください。
        </p>
      ) : (
        <>
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-lg border p-8 text-center"
            style={{ backgroundColor: formatRgb(bgRgb) }}
          >
            <p
              className="text-2xl font-bold"
              style={{ color: formatRgb(fgRgb) }}
            >
              テキストのサンプル表示 Sample Text
            </p>
            <p className="text-sm" style={{ color: formatRgb(fgRgb) }}>
              コントラスト比: {contrastRatio(fgRgb, bgRgb).toFixed(2)} : 1
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">通常テキスト</span>
              <div className="flex flex-wrap gap-2">
                {badge(result!.aaNormal, "AA")}
                {badge(result!.aaaNormal, "AAA")}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                大きいテキスト（18pt以上 / 14pt太字以上）
              </span>
              <div className="flex flex-wrap gap-2">
                {badge(result!.aaLarge, "AA")}
                {badge(result!.aaaLarge, "AAA")}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ColorConverterTool() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">カラーコード変換</h2>
        <ColorConverter />
      </div>

      <div className="flex flex-col gap-3 border-t pt-6">
        <h2 className="text-lg font-semibold">コントラスト比判定（WCAG 2.1）</h2>
        <ContrastChecker />
      </div>
    </div>
  );
}
