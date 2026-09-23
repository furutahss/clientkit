"use client";

import * as React from "react";
import { Check, Copy, FileUp, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import {
  fingerprint,
  formatDistinguishedName,
  getValidityStatus,
  parseCertificatesFromBytes,
  parseCertificatesFromText,
  type CertificateInputResult,
  type ParsedCertificate,
  type ValidityStatus,
} from "@/lib/x509";
import { getDictionary } from "@/i18n/dictionaries";
import type { Dictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { takePendingToolFile } from "@/lib/pending-tool-file";
import { cn, formatTemplate } from "@/lib/utils";

type Dict = Dictionary["tools"]["certificateDecoder"];

type Fingerprints = { sha256: string; sha1: string };

const STATUS_CLASS: Record<ValidityStatus, string> = {
  valid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  expiring: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  expired: "bg-destructive/10 text-destructive",
  "not-yet-valid": "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 shrink-0"
      aria-label={label}
      title={label}
      disabled={!value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // クリップボードAPIが利用できない環境では何もしない
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b py-2 last:border-b-0 sm:flex-row sm:gap-3">
      <span className="w-40 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1 text-sm break-all">{children}</div>
    </div>
  );
}

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function CertificateCard({
  certificate,
  index,
  total,
  fingerprints,
  now,
  dict,
  intlLocale,
}: {
  certificate: ParsedCertificate;
  index: number;
  total: number;
  fingerprints: Fingerprints | undefined;
  now: number | null;
  dict: Dict;
  intlLocale: string;
}) {
  const commonName =
    certificate.subject.find((entry) => entry.type === "CN")?.value ??
    formatDistinguishedName(certificate.subject);
  const validity = now !== null ? getValidityStatus(certificate, now) : null;

  const statusText = validity
    ? formatTemplate(dict.status[validity.status], { days: validity.days })
    : "";

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          {total > 1 && (
            <span className="text-xs text-muted-foreground">
              {formatTemplate(dict.certificateIndex, { index: index + 1, total })}
            </span>
          )}
          <span className="text-base font-semibold break-all">{commonName || dict.noCommonName}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {validity && (
            <span className={cn("inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_CLASS[validity.status])}>
              {statusText}
            </span>
          )}
          {certificate.isCa && (
            <span className="inline-flex w-fit items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {dict.caBadge}
            </span>
          )}
          {certificate.selfIssued && (
            <span className="inline-flex w-fit items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {dict.selfSignedBadge}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <Row label={dict.fieldSubject}>{formatDistinguishedName(certificate.subject) || "-"}</Row>
        <Row label={dict.fieldIssuer}>{formatDistinguishedName(certificate.issuer) || "-"}</Row>
        <Row label={dict.fieldNotBefore}>
          {formatDate(certificate.notBefore, intlLocale)}
          <span className="ml-2 font-mono text-xs text-muted-foreground">{certificate.notBefore.toISOString()}</span>
        </Row>
        <Row label={dict.fieldNotAfter}>
          <span className={cn(validity?.status === "expired" && "font-medium text-destructive")}>
            {formatDate(certificate.notAfter, intlLocale)}
          </span>
          <span className="ml-2 font-mono text-xs text-muted-foreground">{certificate.notAfter.toISOString()}</span>
        </Row>
        <Row label={dict.fieldSan}>
          {certificate.subjectAltNames.length === 0 ? (
            <span className="text-muted-foreground">{dict.none}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {certificate.subjectAltNames.map((name, sanIndex) => (
                <span key={sanIndex} className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-xs">
                  <span className="text-muted-foreground">{name.type}:</span>
                  {name.value}
                </span>
              ))}
            </div>
          )}
        </Row>
        <Row label={dict.fieldFingerprintSha256}>
          <span className="inline-flex items-start gap-1">
            <span className="font-mono text-xs">{fingerprints?.sha256 ?? dict.calculating}</span>
            <CopyButton value={fingerprints?.sha256 ?? ""} label={dict.copy} />
          </span>
        </Row>
        <Row label={dict.fieldFingerprintSha1}>
          <span className="inline-flex items-start gap-1">
            <span className="font-mono text-xs">{fingerprints?.sha1 ?? dict.calculating}</span>
            <CopyButton value={fingerprints?.sha1 ?? ""} label={dict.copy} />
          </span>
        </Row>
        <Row label={dict.fieldSerial}>
          <span className="font-mono text-xs">{certificate.serialNumber}</span>
        </Row>
        <Row label={dict.fieldSignatureAlgorithm}>{certificate.signatureAlgorithm}</Row>
        <Row label={dict.fieldPublicKey}>
          {certificate.publicKey.algorithm}
          {certificate.publicKey.size !== null && ` ${formatTemplate(dict.bits, { bits: certificate.publicKey.size })}`}
          {certificate.publicKey.curve && ` / ${certificate.publicKey.curve}`}
        </Row>
        <Row label={dict.fieldVersion}>v{certificate.version}</Row>
        {certificate.isCa !== null && (
          <Row label={dict.fieldBasicConstraints}>
            {certificate.isCa ? dict.caTrue : dict.caFalse}
            {certificate.pathLength !== null && ` (${formatTemplate(dict.pathLength, { value: certificate.pathLength })})`}
          </Row>
        )}
        {certificate.keyUsage.length > 0 && (
          <Row label={dict.fieldKeyUsage}>
            <span className="font-mono text-xs">{certificate.keyUsage.join(", ")}</span>
          </Row>
        )}
        {certificate.extendedKeyUsage.length > 0 && (
          <Row label={dict.fieldExtendedKeyUsage}>
            <span className="font-mono text-xs">{certificate.extendedKeyUsage.join(", ")}</span>
          </Row>
        )}
        {certificate.subjectKeyId && (
          <Row label={dict.fieldSubjectKeyId}>
            <span className="font-mono text-xs">{certificate.subjectKeyId}</span>
          </Row>
        )}
        {certificate.authorityKeyId && (
          <Row label={dict.fieldAuthorityKeyId}>
            <span className="font-mono text-xs">{certificate.authorityKeyId}</span>
          </Row>
        )}
        {certificate.extensions.length > 0 && (
          <Row label={dict.fieldExtensions}>
            <span className="font-mono text-xs">
              {certificate.extensions
                .map((extension) => `${extension.name}${extension.critical ? ` (${dict.critical})` : ""}`)
                .join(", ")}
            </span>
          </Row>
        )}
      </div>
    </li>
  );
}

export function CertificateDecoderTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.certificateDecoder;
  const intlLocale = locale === "ja" ? "ja-JP" : "en-US";

  const [input, setInput] = React.useState("");
  const [fileResult, setFileResult] = React.useState<{ name: string; result: CertificateInputResult } | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [fingerprints, setFingerprints] = React.useState<Map<ParsedCertificate, Fingerprints>>(new Map());
  const [now, setNow] = React.useState<number | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadFile = React.useCallback(
    (file: File) => {
      setFileError(null);
      file
        .arrayBuffer()
        .then((buffer) => {
          const result = parseCertificatesFromBytes(new Uint8Array(buffer));
          setInput("");
          setFileResult({ name: file.name, result });
        })
        .catch(() => setFileError(dict.fileReadError));
    },
    [dict]
  );

  React.useEffect(() => {
    const pending = takePendingToolFile("certificate-decoder");
    if (pending) Promise.resolve().then(() => loadFile(pending));
  }, [loadFile]);

  const textResult = React.useMemo(
    () => (input.trim() ? parseCertificatesFromText(input) : null),
    [input]
  );
  const result = fileResult?.result ?? textResult;

  React.useEffect(() => {
    if (!result || result.certificates.length === 0) return;
    let cancelled = false;
    Promise.all(
      result.certificates.map(async (certificate) => {
        const [sha256, sha1] = await Promise.all([
          fingerprint(certificate.der, "SHA-256"),
          fingerprint(certificate.der, "SHA-1"),
        ]);
        return [certificate, { sha256, sha1 }] as const;
      })
    )
      .then((entries) => {
        if (!cancelled) setFingerprints(new Map(entries));
      })
      .catch(() => {
        // Web Crypto APIが使えない環境（非HTTPSなど）ではフィンガープリントを表示しない
      });
    return () => {
      cancelled = true;
    };
  }, [result]);

  function handleClear() {
    setInput("");
    setFileResult(null);
    setFileError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="certificate-input" className="text-sm font-medium">
            {dict.inputLabel}
          </label>
          <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="size-4" />
            {dict.openFile}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pem,.crt,.cer,.der,.cert,application/x-x509-ca-cert,application/pkix-cert,application/x-pem-file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadFile(file);
              e.target.value = "";
            }}
          />
        </div>
        {fileResult ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <span className="font-medium break-all">{fileResult.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatTemplate(dict.loadedCount, { count: fileResult.result.certificates.length })}
            </span>
          </div>
        ) : (
          <Textarea
            id="certificate-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const file = e.dataTransfer.files?.[0];
              if (!file) return;
              e.preventDefault();
              loadFile(file);
            }}
            placeholder={dict.inputPlaceholder}
            spellCheck={false}
            className="min-h-48 font-mono text-xs"
          />
        )}
        {fileError && <p className="text-sm text-destructive">{fileError}</p>}
        <ToolActions onClear={handleClear} clearDisabled={!input && !fileResult} />
      </div>

      {!result ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {dict.emptyState}
        </p>
      ) : (
        <>
          {result.errors > 0 && (
            <p className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
              {result.certificates.length === 0
                ? dict.parseError
                : formatTemplate(dict.partialError, { count: result.errors })}
            </p>
          )}
          {result.certificates.length === 0 && result.errors === 0 && (
            <p className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{dict.noCertificate}</p>
          )}
          <ul className="flex flex-col gap-4">
            {result.certificates.map((certificate, index) => (
              <CertificateCard
                key={index}
                certificate={certificate}
                index={index}
                total={result.certificates.length}
                fingerprints={fingerprints.get(certificate)}
                now={now}
                dict={dict}
                intlLocale={intlLocale}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
