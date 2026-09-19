"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToolActions } from "@/components/tools/tool-actions";
import { buildUrl, parseQueryParams, splitUrl, type QueryParam } from "@/lib/url-query";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";

type Tab = "encode" | "query";
type EncodeMode = "encode" | "decode";
type EncodeMethod = "component" | "full";

export function UrlEncoderTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.urlEncoder;

  const TABS: { value: Tab; label: string }[] = [
    { value: "encode", label: dict.tabEncode },
    { value: "query", label: dict.tabQuery },
  ];

  const transform = React.useCallback(
    (
      text: string,
      mode: EncodeMode,
      method: EncodeMethod
    ): { output: string; error: string | null } => {
      try {
        if (mode === "encode") {
          return {
            output: method === "component" ? encodeURIComponent(text) : encodeURI(text),
            error: null,
          };
        }
        return {
          output: method === "component" ? decodeURIComponent(text) : decodeURI(text),
          error: null,
        };
      } catch {
        return {
          output: "",
          error: dict.decodeError,
        };
      }
    },
    [dict]
  );

  const [tab, setTab] = React.useState<Tab>("encode");

  const [encodeMode, setEncodeMode] = React.useState<EncodeMode>("encode");
  const [encodeMethod, setEncodeMethod] = React.useState<EncodeMethod>("component");
  const [encodeInput, setEncodeInput] = React.useState("");

  const { output: encodeOutput, error: encodeError } = React.useMemo(
    () => transform(encodeInput, encodeMode, encodeMethod),
    [encodeInput, encodeMode, encodeMethod, transform]
  );

  const [urlInput, setUrlInput] = React.useState("");
  const [params, setParams] = React.useState<QueryParam[]>([]);
  const [base, setBase] = React.useState("");
  const [hash, setHash] = React.useState("");
  const [hasParsed, setHasParsed] = React.useState(false);

  function handleParseUrl() {
    const { base: parsedBase, queryString, hash: parsedHash } = splitUrl(urlInput);
    setBase(parsedBase);
    setHash(parsedHash);
    setParams(parseQueryParams(queryString));
    setHasParsed(true);
  }

  const generatedUrl = hasParsed ? buildUrl(base, params, hash) : "";

  function updateParam(index: number, field: "key" | "value", value: string) {
    setParams((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  function removeParam(index: number) {
    setParams((prev) => prev.filter((_, i) => i !== index));
  }

  function addParam() {
    setParams((prev) => [...prev, { key: "", value: "" }]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit rounded-md border p-1">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
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

      {tab === "encode" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex w-fit rounded-md border p-1">
              {(
                [
                  { value: "encode", label: dict.modeEncode },
                  { value: "decode", label: dict.modeDecode },
                ] as { value: EncodeMode; label: string }[]
              ).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setEncodeMode(item.value)}
                  className={cn(
                    "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                    encodeMode === item.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="inline-flex w-fit rounded-md border p-1">
              {(
                [
                  { value: "component", label: dict.methodComponent },
                  { value: "full", label: dict.methodFull },
                ] as { value: EncodeMethod; label: string }[]
              ).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setEncodeMethod(item.value)}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs font-mono transition-colors",
                    encodeMethod === item.value
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{dict.methodNote}</p>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              {encodeMode === "encode" ? dict.inputLabelEncode : dict.inputLabelDecode}
            </label>
            <Textarea
              value={encodeInput}
              onChange={(e) => setEncodeInput(e.target.value)}
              placeholder={
                encodeMode === "encode"
                  ? dict.inputPlaceholderEncode
                  : dict.inputPlaceholderDecode
              }
              spellCheck={false}
              className="min-h-32 font-mono text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{dict.resultLabel}</label>
            <Textarea
              value={encodeOutput}
              readOnly
              placeholder={dict.outputPlaceholder}
              spellCheck={false}
              className="min-h-32 font-mono text-sm"
            />
            {encodeError && (
              <p className="text-sm text-destructive">{encodeError}</p>
            )}
          </div>

          <ToolActions
            onClear={() => setEncodeInput("")}
            clearDisabled={!encodeInput}
            getCopyText={() => encodeOutput}
            copyDisabled={!encodeOutput}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{dict.urlLabel}</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={dict.urlPlaceholder}
                spellCheck={false}
                className="font-mono text-sm"
              />
              <Button type="button" onClick={handleParseUrl} disabled={!urlInput}>
                {dict.parseButton}
              </Button>
            </div>
          </div>

          {hasParsed && (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">{dict.baseUrlLabel}</label>
                <Input
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                  spellCheck={false}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    {formatTemplate(dict.queryParamsLabel, { count: params.length })}
                  </label>
                  <Button type="button" variant="outline" size="sm" onClick={addParam}>
                    <Plus className="size-4" />
                    {dict.addParam}
                  </Button>
                </div>

                {params.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    {dict.noParams}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {params.map((param, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={param.key}
                          onChange={(e) => updateParam(index, "key", e.target.value)}
                          placeholder={dict.keyPlaceholder}
                          spellCheck={false}
                          className="font-mono text-sm"
                        />
                        <span className="text-muted-foreground">=</span>
                        <Input
                          value={param.value}
                          onChange={(e) => updateParam(index, "value", e.target.value)}
                          placeholder={dict.valuePlaceholder}
                          spellCheck={false}
                          className="font-mono text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeParam(index)}
                          aria-label={dict.removeParamAria}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">{dict.regeneratedUrlLabel}</label>
                <Textarea
                  value={generatedUrl}
                  readOnly
                  spellCheck={false}
                  className="min-h-20 font-mono text-sm"
                />
                <ToolActions
                  getCopyText={() => generatedUrl}
                  copyDisabled={!generatedUrl}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
