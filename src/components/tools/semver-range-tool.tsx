"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SafetyNote } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { checkCandidates, checkRange } from "@/lib/semver-range";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn } from "@/lib/utils";

const SAMPLE_RANGE = "^1.2.0";
const SAMPLE_VERSIONS = "1.2.0\n1.9.0\n2.0.0\n1.1.9\n1.10.0-beta.1\nv1.3.0\n1.2";

export function SemverRangeTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.semverRange;

  const [range, setRange] = React.useState("");
  const [versions, setVersions] = React.useState("");
  const [includePrerelease, setIncludePrerelease] = React.useState(false);

  const rangeCheck = checkRange(range);
  const results =
    rangeCheck.status === "valid" ? checkCandidates(range, versions.split(/\r?\n/), includePrerelease) : [];

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>

      <div className="flex flex-col gap-2">
        <label htmlFor="semver-range" className="text-sm font-medium">
          {dict.rangeLabel}
        </label>
        <Input
          id="semver-range"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          placeholder="^1.2.0"
          spellCheck={false}
          aria-invalid={(rangeCheck.status !== "valid" && rangeCheck.status !== "empty") || undefined}
          className="max-w-md font-mono"
        />
        {rangeCheck.status === "valid" ? (
          <p className="text-sm text-muted-foreground">
            {dict.normalized} <code className="font-mono">{rangeCheck.normalized}</code>
          </p>
        ) : (
          rangeCheck.status !== "empty" && <p className="text-sm text-destructive">{dict.rangeErrors[rangeCheck.status]}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="semver-versions" className="text-sm font-medium">
          {dict.versionsLabel}
        </label>
        <Textarea
          id="semver-versions"
          value={versions}
          onChange={(e) => setVersions(e.target.value)}
          placeholder={"1.2.3\n2.0.0"}
          spellCheck={false}
          className="min-h-36 max-w-md font-mono text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={includePrerelease} onCheckedChange={(checked) => setIncludePrerelease(checked === true)} />
        {dict.includePrerelease}
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setRange(SAMPLE_RANGE);
            setVersions(SAMPLE_VERSIONS);
          }}
        >
          <FlaskConical className="size-4" />
          {dict.loadSample}
        </Button>
        <ToolActions
          onClear={() => {
            setRange("");
            setVersions("");
          }}
          clearDisabled={!range && !versions}
          getCopyText={() =>
            results.map((r) => `${r.input}\t${r.status === "invalid" ? dict.invalidVersion : dict[r.status]}`).join("\n")
          }
          copyDisabled={results.length === 0}
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{dict.resultHeading}</h2>
        {results.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{dict.emptyState}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{dict.columnVersion}</th>
                  <th className="px-3 py-2 font-medium">{dict.columnResult}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index} className="border-t align-top">
                    <td className="px-3 py-1.5 font-mono">{result.input}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={cn(
                          "font-medium",
                          result.status === "match" && "text-emerald-700 dark:text-emerald-400",
                          result.status === "noMatch" && "text-muted-foreground",
                          result.status === "invalid" && "text-destructive"
                        )}
                      >
                        {result.status === "invalid" ? dict.invalidVersion : dict[result.status]}
                      </span>
                      {result.status !== "invalid" && result.version !== result.input && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({dict.parsedAs} <code className="font-mono">{result.version}</code>)
                        </span>
                      )}
                      {result.status === "noMatch" && result.prereleaseExcluded && (
                        <p className="text-xs text-amber-700 dark:text-amber-400">{dict.prereleaseExcluded}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
