"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import {
  decodeJwt,
  formatClaimDate,
  getExpiryStatus,
  TIME_CLAIMS,
} from "@/lib/jwt";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";

const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkNsaWVudEtpdCBVc2VyIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MzE1MzYwMDB9.dQw4w9WgXcQ_dummySignature";

function ExpiryBadge({
  status,
  dict,
}: {
  status: ReturnType<typeof getExpiryStatus>;
  dict: Dictionary["tools"]["jwtDecoder"];
}) {
  if (status === "unknown") return null;

  const config = {
    expired: {
      label: dict.expiredLabel,
      icon: AlertTriangle,
      className: "bg-destructive/10 text-destructive",
    },
    "not-yet-valid": {
      label: dict.notYetValidLabel,
      icon: Clock,
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    },
    valid: {
      label: dict.validLabel,
      icon: CheckCircle2,
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    },
  }[status];

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
        config.className
      )}
    >
      <Icon className="size-4" />
      {config.label}
    </span>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-sm whitespace-pre-wrap break-all">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function JwtDecoderTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.jwtDecoder;
  const [token, setToken] = React.useState("");

  const result = React.useMemo(() => {
    if (!token.trim()) return null;
    return decodeJwt(token);
  }, [token]);

  const expiryStatus = result && result.ok ? getExpiryStatus(result.payload) : "unknown";

  const timeClaims =
    result && result.ok && result.payload !== null && typeof result.payload === "object"
      ? TIME_CLAIMS.filter(
          (claim) =>
            typeof (result.payload as Record<string, unknown>)[claim] === "number"
        )
      : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{dict.inputLabel}</label>
        <Textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={SAMPLE_JWT}
          spellCheck={false}
          className="min-h-24 font-mono text-sm break-all"
        />
        <ToolActions onClear={() => setToken("")} clearDisabled={!token} />
      </div>

      {result && !result.ok && (
        <p className="text-sm text-destructive">{result.error}</p>
      )}

      {result && result.ok && (
        <div className="flex flex-col gap-4">
          {expiryStatus !== "unknown" && (
            <div className="flex flex-wrap items-center gap-2">
              <ExpiryBadge status={expiryStatus} dict={dict} />
            </div>
          )}

          {timeClaims.length > 0 && (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="border-b px-3 py-2 text-left font-medium">
                      {dict.claimHeader}
                    </th>
                    <th className="border-b px-3 py-2 text-left font-medium">
                      {dict.timestampHeader}
                    </th>
                    <th className="border-b px-3 py-2 text-left font-medium">
                      {dict.dateHeader}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {timeClaims.map((claim) => {
                    const value = (result.payload as Record<string, unknown>)[claim];
                    return (
                      <tr key={claim} className="odd:bg-muted/30">
                        <td className="border-b px-3 py-1.5 font-mono">{claim}</td>
                        <td className="border-b px-3 py-1.5 font-mono tabular-nums">
                          {String(value)}
                        </td>
                        <td className="border-b px-3 py-1.5">
                          {formatClaimDate(value) ?? "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">{dict.headerLabel}</label>
              <JsonBlock value={result.header} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">{dict.payloadLabel}</label>
              <JsonBlock value={result.payload} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{dict.signatureLabel}</label>
            <p className="rounded-md border bg-muted/30 p-3 font-mono text-sm break-all">
              {result.signature || dict.noSignature}
            </p>
            <p className="text-xs text-muted-foreground">{dict.signatureNote}</p>
          </div>
        </div>
      )}
    </div>
  );
}
