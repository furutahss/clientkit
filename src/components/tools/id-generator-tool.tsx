"use client";

import * as React from "react";
import { Download, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { downloadBytes } from "@/lib/download";
import {
  createUlidGenerator,
  createUuidV7Generator,
  generatePassword,
  passwordEntropy,
  uuidV4,
  type PasswordOptions,
} from "@/lib/id-generator";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";

type Tab = "uuid" | "ulid" | "password";
type UuidVersion = "v4" | "v7";

const MAX_ID_COUNT = 1000;
const MAX_PASSWORD_COUNT = 100;
const MIN_PASSWORD_LENGTH = 4;
const MAX_PASSWORD_LENGTH = 128;

function clampCount(value: number, max: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

type Strength = "weak" | "fair" | "strong" | "veryStrong";

function strengthFor(bits: number): Strength {
  if (bits < 50) return "weak";
  if (bits < 70) return "fair";
  if (bits < 100) return "strong";
  return "veryStrong";
}

const STRENGTH_CLASS: Record<Strength, string> = {
  weak: "bg-destructive",
  fair: "bg-amber-500",
  strong: "bg-emerald-500",
  veryStrong: "bg-emerald-600",
};

export function IdGeneratorTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.idGenerator;

  const [tab, setTab] = React.useState<Tab>("uuid");
  const [uuidVersion, setUuidVersion] = React.useState<UuidVersion>("v4");
  const [count, setCount] = React.useState(5);
  const [uppercase, setUppercase] = React.useState(false);
  const [hyphens, setHyphens] = React.useState(true);
  const [passwordOptions, setPasswordOptions] = React.useState<PasswordOptions>({
    length: 16,
    uppercase: true,
    lowercase: true,
    digits: true,
    symbols: true,
    excludeAmbiguous: false,
  });
  const [output, setOutput] = React.useState("");
  const [seed, setSeed] = React.useState(0);

  const effectiveCount = clampCount(count, tab === "password" ? MAX_PASSWORD_COUNT : MAX_ID_COUNT);
  const noCharset =
    !passwordOptions.uppercase &&
    !passwordOptions.lowercase &&
    !passwordOptions.digits &&
    !passwordOptions.symbols;

  // 乱数を含むためサーバー側では生成せず、ブラウザでのみ生成する
  React.useEffect(() => {
    const lines: string[] = [];
    if (tab === "uuid") {
      const next = uuidVersion === "v4" ? uuidV4 : createUuidV7Generator();
      for (let i = 0; i < effectiveCount; i += 1) {
        let value = next();
        if (!hyphens) value = value.replace(/-/g, "");
        lines.push(uppercase ? value.toUpperCase() : value);
      }
    } else if (tab === "ulid") {
      const next = createUlidGenerator();
      for (let i = 0; i < effectiveCount; i += 1) {
        const value = next();
        lines.push(uppercase ? value : value.toLowerCase());
      }
    } else {
      for (let i = 0; i < effectiveCount; i += 1) {
        const value = generatePassword(passwordOptions);
        if (value) lines.push(value);
      }
    }
    const timer = window.setTimeout(() => setOutput(lines.join("\n")), 0);
    return () => window.clearTimeout(timer);
  }, [tab, uuidVersion, effectiveCount, uppercase, hyphens, passwordOptions, seed]);

  function selectTab(next: Tab) {
    setTab(next);
    setUppercase(next === "ulid");
    if (next === "password") setCount((prev) => Math.min(prev, MAX_PASSWORD_COUNT));
  }

  function updatePassword<K extends keyof PasswordOptions>(key: K, value: PasswordOptions[K]) {
    setPasswordOptions((prev) => ({ ...prev, [key]: value }));
  }

  function handleDownload() {
    if (!output) return;
    downloadBytes(new TextEncoder().encode(`${output}\n`), `${tab}.txt`, "text/plain");
  }

  const entropy = passwordEntropy(passwordOptions);
  const strength = strengthFor(entropy);

  const TABS: { value: Tab; label: string }[] = [
    { value: "uuid", label: dict.tabUuid },
    { value: "ulid", label: dict.tabUlid },
    { value: "password", label: dict.tabPassword },
  ];

  const PASSWORD_SETS: { key: "uppercase" | "lowercase" | "digits" | "symbols"; label: string }[] = [
    { key: "uppercase", label: dict.charUppercase },
    { key: "lowercase", label: dict.charLowercase },
    { key: "digits", label: dict.charDigits },
    { key: "symbols", label: dict.charSymbols },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="inline-flex w-fit rounded-md border p-1">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => selectTab(item.value)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              tab === item.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-lg border p-4">
          {tab === "uuid" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{dict.versionLabel}</span>
              <div className="inline-flex w-fit rounded-md border p-1">
                {(["v4", "v7"] as const).map((version) => (
                  <button
                    key={version}
                    type="button"
                    onClick={() => setUuidVersion(version)}
                    className={cn(
                      "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                      uuidVersion === version
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {version === "v4" ? dict.versionV4 : dict.versionV7}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {uuidVersion === "v4" ? dict.versionV4Hint : dict.versionV7Hint}
              </p>
            </div>
          )}

          {tab === "ulid" && <p className="text-sm text-muted-foreground">{dict.ulidHint}</p>}

          {tab === "password" && (
            <>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password-length" className="text-sm font-medium">
                    {dict.lengthLabel}
                  </label>
                  <Input
                    id="password-length"
                    type="number"
                    inputMode="numeric"
                    min={MIN_PASSWORD_LENGTH}
                    max={MAX_PASSWORD_LENGTH}
                    value={passwordOptions.length}
                    onChange={(e) =>
                      updatePassword(
                        "length",
                        Math.min(
                          MAX_PASSWORD_LENGTH,
                          Math.max(MIN_PASSWORD_LENGTH, Math.floor(Number(e.target.value) || MIN_PASSWORD_LENGTH))
                        )
                      )
                    }
                    className="h-7 w-20 text-right"
                  />
                </div>
                <Slider
                  value={[passwordOptions.length]}
                  onValueChange={([value]) => updatePassword("length", value)}
                  min={MIN_PASSWORD_LENGTH}
                  max={MAX_PASSWORD_LENGTH}
                  step={1}
                  aria-label={dict.lengthLabel}
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{dict.charsetLabel}</span>
                <div className="grid grid-cols-2 gap-2">
                  {PASSWORD_SETS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={`password-${key}`}
                        checked={passwordOptions[key]}
                        onCheckedChange={(checked) => updatePassword(key, checked === true)}
                      />
                      <label htmlFor={`password-${key}`} className="text-sm">
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="password-ambiguous"
                    checked={passwordOptions.excludeAmbiguous}
                    onCheckedChange={(checked) => updatePassword("excludeAmbiguous", checked === true)}
                  />
                  <label htmlFor="password-ambiguous" className="text-sm">
                    {dict.excludeAmbiguous}
                  </label>
                </div>
                {noCharset && <p className="text-sm text-destructive">{dict.noCharsetError}</p>}
              </div>
              {!noCharset && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{dict.strengthLabel}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatTemplate(dict.strengthValue, {
                        label: dict.strength[strength],
                        bits: Math.round(entropy),
                      })}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full transition-all", STRENGTH_CLASS[strength])}
                      style={{ width: `${Math.min(100, (entropy / 128) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="id-count" className="text-sm font-medium">
                {dict.countLabel}
              </label>
              <Input
                id="id-count"
                type="number"
                inputMode="numeric"
                min={1}
                max={tab === "password" ? MAX_PASSWORD_COUNT : MAX_ID_COUNT}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                onBlur={() => setCount(effectiveCount)}
                className="h-7 w-24 text-right"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatTemplate(dict.countHint, {
                max: tab === "password" ? MAX_PASSWORD_COUNT : MAX_ID_COUNT,
              })}
            </p>
          </div>

          {tab !== "password" && (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="id-uppercase"
                  checked={uppercase}
                  onCheckedChange={(checked) => setUppercase(checked === true)}
                />
                <label htmlFor="id-uppercase" className="text-sm">
                  {dict.uppercase}
                </label>
              </div>
              {tab === "uuid" && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="id-hyphens"
                    checked={hyphens}
                    onCheckedChange={(checked) => setHyphens(checked === true)}
                  />
                  <label htmlFor="id-hyphens" className="text-sm">
                    {dict.hyphens}
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="id-output" className="text-sm font-medium">
            {dict.outputLabel}
          </label>
          <Textarea
            id="id-output"
            value={output}
            readOnly
            placeholder={dict.outputPlaceholder}
            spellCheck={false}
            className="min-h-72 font-mono text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setSeed((prev) => prev + 1)}
              disabled={tab === "password" && noCharset}
            >
              <RefreshCw className="size-4" />
              {dict.regenerate}
            </Button>
            <ToolActions getCopyText={() => output} copyDisabled={!output} />
            <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={!output}>
              <Download className="size-4" />
              {dict.download}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
