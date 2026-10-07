"use client";

import * as React from "react";
import { AlertTriangle, Download, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import {
  CurlParseError,
  generators,
  maskRequest,
  parseCurl,
  splitUrl,
  type ParsedCurl,
  type TargetLanguage,
} from "@/lib/curl";
import { downloadBytes } from "@/lib/download";
import { cn, formatTemplate } from "@/lib/utils";

const LANGUAGES: { id: TargetLanguage; label: string; file: string }[] = [
  { id: "fetch", label: "JavaScript (fetch)", file: "request.mjs" },
  { id: "axios", label: "JavaScript (axios)", file: "request-axios.mjs" },
  { id: "python", label: "Python (requests)", file: "request.py" },
  { id: "csharp", label: "C# (HttpClient)", file: "Request.cs" },
  { id: "go", label: "Go (net/http)", file: "main.go" },
  { id: "curl", label: "cURL", file: "request.sh" },
];

const SAMPLE = `curl 'https://api.example.com/v1/users?page=1&api_key=abc123' \\
  -H 'accept: application/json' \\
  -H 'authorization: Bearer eyJhbGciOiJIUzI1NiJ9.sample.token' \\
  -H 'content-type: application/json' \\
  -b 'session=s3cr3t' \\
  --data-raw '{"name":"山田太郎","email":"taro@example.com","admin":false}' \\
  --compressed`;

function KeyValueTable({ rows, caption }: { rows: [string, string][]; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <tbody>
          {rows.map(([key, value], index) => (
            <tr key={index} className="odd:bg-muted/30">
              <th scope="row" className="border-b px-3 py-1.5 text-left align-top font-mono text-xs font-medium whitespace-nowrap">
                {key}
              </th>
              <td className="border-b px-3 py-1.5 font-mono text-xs break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CurlConverterTool() {
  const locale = useLocale();
  const dict = React.useMemo(() => getDictionary(locale).tools.curlConverter, [locale]);
  const [input, setInput] = React.useState("");
  const [language, setLanguage] = React.useState<TargetLanguage>("fetch");
  const [mask, setMask] = React.useState(true);
  const deferredInput = React.useDeferredValue(input);

  const parsed = React.useMemo((): { request: ParsedCurl | null; error: string | null } => {
    if (!deferredInput.trim()) return { request: null, error: null };
    try {
      return { request: parseCurl(deferredInput), error: null };
    } catch (e) {
      const code = e instanceof CurlParseError ? e.code : "notCurl";
      return { request: null, error: dict.errors[code] };
    }
  }, [deferredInput, dict]);

  const output = React.useMemo(() => {
    if (!parsed.request) return "";
    return generators[language](mask ? maskRequest(parsed.request) : parsed.request);
  }, [parsed.request, language, mask]);

  const request = parsed.request;
  const query = request ? splitUrl(request.url).query : [];
  const body = request?.body;
  const languageInfo = LANGUAGES.find((item) => item.id === language)!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="curl-input" className="text-sm font-medium">
            {dict.inputLabel}
          </label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>
            {dict.sample}
          </Button>
        </div>
        <Textarea
          id="curl-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={dict.inputPlaceholder}
          spellCheck={false}
          className="min-h-40 font-mono text-xs"
          aria-describedby="curl-input-hint"
        />
        <p id="curl-input-hint" className="text-xs text-muted-foreground">
          {dict.inputHint}
        </p>
        {parsed.error && (
          <p className="text-sm text-destructive" role="alert">
            {parsed.error}
          </p>
        )}
        <ToolActions onClear={() => setInput("")} clearDisabled={!input} />
      </div>

      {request && request.warnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {dict.warningsHeading}
          </span>
          <ul className="list-disc pl-5">
            {request.warnings.map((warning, index) => (
              <li key={index}>
                <code className="font-mono text-xs">{warning.option}</code>: {dict.warnings[warning.reason]}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <div role="tablist" aria-label={dict.languageLabel} className="flex flex-wrap gap-1 rounded-md border p-1">
            {LANGUAGES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`curl-tab-${item.id}`}
                aria-selected={language === item.id}
                aria-controls="curl-output"
                onClick={() => setLanguage(item.id)}
                className={cn(
                  "rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                  language === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="curl-mask" checked={mask} onCheckedChange={(checked) => setMask(checked === true)} className="mt-0.5" />
            <label htmlFor="curl-mask" className="text-sm">
              {dict.mask}
              <span className="block text-xs text-muted-foreground">{dict.maskHint}</span>
            </label>
          </div>
          <Textarea
            id="curl-output"
            role="tabpanel"
            aria-labelledby={`curl-tab-${language}`}
            value={output}
            readOnly
            wrap="off"
            spellCheck={false}
            placeholder={dict.outputPlaceholder}
            className="min-h-96 font-mono text-xs leading-relaxed"
          />
          <div className="flex flex-wrap gap-2">
            <ToolActions getCopyText={() => output} copyDisabled={!output} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!output}
              onClick={() => downloadBytes(new TextEncoder().encode(`${output}\n`), languageInfo.file, "text/plain")}
            >
              <Download className="size-4" />
              {formatTemplate(dict.download, { file: languageInfo.file })}
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <span className="text-sm font-medium">{dict.parsedHeading}</span>
          {request ? (
            <>
              <KeyValueTable
                caption={dict.requestCaption}
                rows={[
                  [dict.method, request.method],
                  ["URL", request.url],
                  ...(request.auth ? ([[dict.basicAuth, `${request.auth.user}:${"*".repeat(request.auth.password.length)}`]] as [string, string][]) : []),
                  [
                    dict.options,
                    [
                      request.followRedirects && dict.optionLocation,
                      request.insecure && dict.optionInsecure,
                      request.compressed && dict.optionCompressed,
                    ]
                      .filter(Boolean)
                      .join(" / ") || "—",
                  ],
                ]}
              />
              {query.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">{dict.query}</span>
                  <KeyValueTable caption={dict.query} rows={query} />
                </div>
              )}
              {request.headers.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatTemplate(dict.headers, { count: request.headers.length })}
                  </span>
                  <KeyValueTable caption={dict.headers} rows={request.headers} />
                </div>
              )}
              {body && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatTemplate(dict.body, { kind: dict.bodyKinds[body.kind] })}
                  </span>
                  {body.kind === "form" ? (
                    <KeyValueTable caption={dict.bodyKinds.form} rows={body.fields} />
                  ) : body.kind === "multipart" ? (
                    <KeyValueTable
                      caption={dict.bodyKinds.multipart}
                      rows={body.parts.map((part) => [part.name, part.isFile ? `📎 ${part.value}` : part.value])}
                    />
                  ) : (
                    <pre className="max-h-80 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap break-all">
                      {body.kind === "json" ? JSON.stringify(body.value, null, 2) : body.text}
                    </pre>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{dict.parsedPlaceholder}</p>
          )}
        </div>
      </div>
    </div>
  );
}
