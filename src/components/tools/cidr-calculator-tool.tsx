"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SafetyNote } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { cidrContains, formatIpv4, parseCidr, parseIpv4 } from "@/lib/cidr";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";

const SAMPLE_CIDR = "192.168.10.37/24";
const SAMPLE_ADDRESSES = "192.168.10.5\n192.168.10.255\n192.168.11.1\n192.168.010.1";

export function CidrCalculatorTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.cidrCalculator;
  const numberFormat = new Intl.NumberFormat(locale);

  const [cidr, setCidr] = React.useState("");
  const [addresses, setAddresses] = React.useState("");

  const parsed = cidr.trim() === "" ? null : parseCidr(cidr);
  const info = parsed && "info" in parsed ? parsed.info : null;

  const rows: [string, string][] = info
    ? [
        [dict.network, `${formatIpv4(info.network)}/${info.prefix}`],
        [dict.mask, formatIpv4(info.mask)],
        [dict.wildcard, formatIpv4(info.wildcard)],
        [dict.range, `${formatIpv4(info.network)} – ${formatIpv4(info.last)}`],
        [dict.total, numberFormat.format(info.total)],
        [
          dict.usable,
          `${numberFormat.format(info.usable)}${
            info.prefix === 31 ? ` ${dict.usable31}` : info.prefix === 32 ? ` ${dict.usable32}` : ""
          }`,
        ],
        [dict.hostRange, `${formatIpv4(info.firstHost)} – ${formatIpv4(info.lastHost)}`],
      ]
    : [];

  const checks = info
    ? addresses
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .map((line) => {
          const address = parseIpv4(line);
          return { line, result: "error" in address ? address.error : cidrContains(info, address.value) };
        })
    : [];

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>

      <div className="flex flex-col gap-2">
        <label htmlFor="cidr-input" className="text-sm font-medium">
          {dict.cidrLabel}
        </label>
        <Input
          id="cidr-input"
          value={cidr}
          onChange={(e) => setCidr(e.target.value)}
          placeholder="10.0.0.0/16"
          spellCheck={false}
          aria-invalid={(parsed && "error" in parsed) || undefined}
          className="max-w-md font-mono"
        />
        {parsed && "error" in parsed && <p className="text-sm text-destructive">{dict.errors[parsed.error]}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setCidr(SAMPLE_CIDR);
            setAddresses(SAMPLE_ADDRESSES);
          }}
        >
          <FlaskConical className="size-4" />
          {dict.loadSample}
        </Button>
        <ToolActions
          onClear={() => {
            setCidr("");
            setAddresses("");
          }}
          clearDisabled={!cidr && !addresses}
          getCopyText={() => rows.map(([label, value]) => `${label}\t${value}`).join("\n")}
          copyDisabled={!info}
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{dict.resultHeading}</h2>
        {!info ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{dict.emptyState}</p>
        ) : (
          <>
            {info.hasHostBits && (
              <p className="rounded-md border border-amber-500/40 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                {formatTemplate(dict.normalized, {
                  input: `${formatIpv4(info.address)}/${info.prefix}`,
                  network: `${formatIpv4(info.network)}/${info.prefix}`,
                })}
              </p>
            )}
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg border p-4 text-sm sm:grid-cols-[max-content_1fr]">
              {rows.map(([label, value]) => (
                <React.Fragment key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-all font-mono">{value}</dd>
                </React.Fragment>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">{dict.countNote}</p>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="cidr-addresses" className="text-sm font-medium">
          {dict.containsLabel}
        </label>
        <Textarea
          id="cidr-addresses"
          value={addresses}
          onChange={(e) => setAddresses(e.target.value)}
          placeholder={"10.0.1.20\n10.1.0.1"}
          spellCheck={false}
          className="min-h-28 max-w-md font-mono text-sm"
        />
        {checks.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {checks.map(({ line, result }, index) => (
              <li key={index} className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono">{line}</span>
                <span
                  className={cn(
                    "font-medium",
                    result === true
                      ? "text-emerald-700 dark:text-emerald-400"
                      : result === false
                        ? "text-muted-foreground"
                        : "text-destructive"
                  )}
                >
                  {result === true ? dict.inside : result === false ? dict.outside : dict.errors[result]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
