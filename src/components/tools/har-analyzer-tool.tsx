"use client";

import * as React from "react";
import {
  AlertTriangle,
  FileUp,
  Gauge,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatBytes } from "@/lib/format-bytes";
import {
  analyzeHar,
  filterEntries,
  formatDuration,
  parseHarText,
  RESOURCE_CATEGORIES,
  type CategoryFilter,
  type HarAnalysis,
  type HarParseErrorCode,
  type ParsedHar,
  type ParsedHarEntry,
  type ResourceCategory,
  type ResourceIssue,
  type StatusFilter,
} from "@/lib/har";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";

type Dict = Dictionary["tools"]["harAnalyzer"];

type Tab = "errors" | "performance" | "security" | "resources";

// dataviz skill: fixed-order categorical palette (8 slots), validated for the
// adjacent-pairs case (stacked bars) in both light and dark surfaces.
const CATEGORY_COLOR_CLASS: Record<ResourceCategory, string> = {
  document: "bg-[#2a78d6] dark:bg-[#3987e5]",
  js: "bg-[#eb6834] dark:bg-[#d95926]",
  css: "bg-[#1baf7a] dark:bg-[#199e70]",
  image: "bg-[#eda100] dark:bg-[#c98500]",
  font: "bg-[#e87ba4] dark:bg-[#d55181]",
  api: "bg-[#008300] dark:bg-[#008300]",
  media: "bg-[#4a3aa7] dark:bg-[#9085e9]",
  other: "bg-[#e34948] dark:bg-[#e66767]",
};

function StatusBadge({ status }: { status: number }) {
  const bucket = Math.floor(status / 100);
  const className =
    bucket === 2
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : bucket === 3
        ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
        : bucket === 4
          ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
          : bucket === 5
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground";

  return (
    <span className={cn("inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      {status || "-"}
    </span>
  );
}

function CategoryBadge({ category, dict }: { category: ResourceCategory; dict: Dict }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("size-2 rounded-full", CATEGORY_COLOR_CLASS[category])} aria-hidden="true" />
      {dict.categories[category]}
    </span>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      {children}
    </p>
  );
}

function AdviceNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function RequestTable({
  entries,
  dict,
  variant,
  onSelect,
}: {
  entries: ParsedHarEntry[];
  dict: Dict;
  variant: "list" | "errors" | "slow";
  onSelect: (entry: ParsedHarEntry) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="border-b px-3 py-2 text-left font-medium">{dict.table.method}</th>
            <th className="border-b px-3 py-2 text-left font-medium">{dict.table.url}</th>
            {variant !== "slow" && (
              <th className="border-b px-3 py-2 text-left font-medium">{dict.table.status}</th>
            )}
            {variant === "list" && (
              <th className="border-b px-3 py-2 text-left font-medium">{dict.table.type}</th>
            )}
            {variant === "list" && (
              <th className="border-b px-3 py-2 text-left font-medium">{dict.table.size}</th>
            )}
            {variant === "slow" ? (
              <>
                <th className="border-b px-3 py-2 text-left font-medium">{dict.performanceTab.ttfb}</th>
                <th className="border-b px-3 py-2 text-left font-medium">{dict.performanceTab.download}</th>
                <th className="border-b px-3 py-2 text-left font-medium">{dict.performanceTab.total}</th>
              </>
            ) : (
              <th className="border-b px-3 py-2 text-left font-medium">{dict.table.time}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className="cursor-pointer odd:bg-muted/30 hover:bg-accent"
              onClick={() => onSelect(entry)}
            >
              <td className="border-b px-3 py-1.5 font-mono text-xs whitespace-nowrap">{entry.method}</td>
              <td className="max-w-[420px] truncate border-b px-3 py-1.5 font-mono text-xs" title={entry.url}>
                {entry.url}
              </td>
              {variant !== "slow" && (
                <td className="border-b px-3 py-1.5">
                  <StatusBadge status={entry.status} />
                </td>
              )}
              {variant === "list" && (
                <td className="border-b px-3 py-1.5 whitespace-nowrap">
                  <CategoryBadge category={entry.category} dict={dict} />
                </td>
              )}
              {variant === "list" && (
                <td className="border-b px-3 py-1.5 font-mono text-xs whitespace-nowrap tabular-nums">
                  {formatBytes(entry.contentSize)}
                </td>
              )}
              {variant === "slow" ? (
                <>
                  <td className="border-b px-3 py-1.5 font-mono text-xs whitespace-nowrap tabular-nums">
                    {formatDuration(entry.ttfb)}
                  </td>
                  <td className="border-b px-3 py-1.5 font-mono text-xs whitespace-nowrap tabular-nums">
                    {formatDuration(entry.downloadTime)}
                  </td>
                  <td className="border-b px-3 py-1.5 font-mono text-xs font-medium whitespace-nowrap tabular-nums">
                    {formatDuration(entry.time)}
                  </td>
                </>
              ) : (
                <td className="border-b px-3 py-1.5 font-mono text-xs whitespace-nowrap tabular-nums">
                  {formatDuration(entry.time)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoreCard({ analysis, dict }: { analysis: HarAnalysis; dict: Dict }) {
  const { healthScore, healthBreakdown } = analysis;
  const rating =
    healthScore >= 80 ? "good" : healthScore >= 50 ? "warning" : "bad";
  const ringClass =
    rating === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : rating === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive";
  const ratingLabel =
    rating === "good" ? dict.score.ratingGood : rating === "warning" ? dict.score.ratingWarning : dict.score.ratingBad;

  const securityIssues = healthBreakdown.missingSecurityHeaderCount + healthBreakdown.insecureRequestCount;
  const hasIssues =
    analysis.errorEntries.length > 0 || healthBreakdown.slowRequestCount > 0 || securityIssues > 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <Gauge className={cn("size-9 shrink-0", ringClass)} aria-hidden="true" />
        <div className="flex flex-col">
          <span className="text-xs font-medium text-muted-foreground">{dict.score.title}</span>
          <span className="flex items-baseline gap-1">
            <span className={cn("text-3xl font-bold tabular-nums", ringClass)}>{healthScore}</span>
            <span className="text-sm text-muted-foreground">{dict.score.outOf}</span>
          </span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "ml-1",
            rating === "good"
              ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-300"
              : rating === "warning"
                ? "border-amber-600/40 text-amber-800 dark:text-amber-300"
                : "border-destructive/40 text-destructive"
          )}
        >
          {ratingLabel}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground sm:border-l sm:pl-4">
        {hasIssues
          ? formatTemplate(dict.score.summary, {
              errors: analysis.errorEntries.length,
              slow: healthBreakdown.slowRequestCount,
              security: securityIssues,
            })
          : dict.score.summaryClean}
      </p>
    </div>
  );
}

function ErrorsTab({
  analysis,
  dict,
  onSelect,
}: {
  analysis: HarAnalysis;
  dict: Dict;
  onSelect: (entry: ParsedHarEntry) => void;
}) {
  const { errorEntries, healthBreakdown } = analysis;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{dict.errorsTab.description}</p>
      {errorEntries.length === 0 ? (
        <EmptyState>{dict.errorsTab.empty}</EmptyState>
      ) : (
        <>
          <p className="text-sm font-medium">
            {formatTemplate(dict.errorsTab.count, { count: errorEntries.length })}
          </p>
          {healthBreakdown.errorCount5xx > 0 && <AdviceNote>{dict.errorsTab.advice5xx}</AdviceNote>}
          {healthBreakdown.errorCount4xx > 0 && <AdviceNote>{dict.errorsTab.advice4xx}</AdviceNote>}
          <RequestTable entries={errorEntries} dict={dict} variant="errors" onSelect={onSelect} />
        </>
      )}
    </div>
  );
}

function ResourceIssueList({
  issues,
  dict,
  onSelect,
}: {
  issues: ResourceIssue[];
  dict: Dict;
  onSelect: (entry: ParsedHarEntry) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {issues.map(({ entry, type }) => (
        <button
          key={`${entry.id}-${type}`}
          type="button"
          onClick={() => onSelect(entry)}
          className="flex flex-col gap-1 rounded-md border p-2.5 text-left text-sm transition-colors hover:bg-accent sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="truncate font-mono text-xs" title={entry.url}>
            {entry.url}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary">
              {type === "uncompressed" ? dict.performanceTab.issueUncompressed : dict.performanceTab.issueLarge}
            </Badge>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatBytes(entry.contentSize)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function PerformanceTab({
  analysis,
  dict,
  onSelect,
}: {
  analysis: HarAnalysis;
  dict: Dict;
  onSelect: (entry: ParsedHarEntry) => void;
}) {
  const { slowEntries, resourceIssues } = analysis;
  const slowest = slowEntries.filter((e) => e.time > 0);
  const hasUncompressed = resourceIssues.some((i) => i.type === "uncompressed");
  const hasLarge = resourceIssues.some((i) => i.type === "large");

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{dict.performanceTab.description}</p>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{dict.performanceTab.slowestTitle}</h3>
        {slowest.length === 0 ? (
          <EmptyState>{dict.performanceTab.slowEmpty}</EmptyState>
        ) : (
          <>
            <AdviceNote>{dict.performanceTab.adviceSlow}</AdviceNote>
            <RequestTable entries={slowest} dict={dict} variant="slow" onSelect={onSelect} />
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{dict.performanceTab.issuesTitle}</h3>
        {resourceIssues.length === 0 ? (
          <EmptyState>{dict.performanceTab.issuesEmpty}</EmptyState>
        ) : (
          <>
            {hasUncompressed && <AdviceNote>{dict.performanceTab.adviceUncompressed}</AdviceNote>}
            {hasLarge && <AdviceNote>{dict.performanceTab.adviceLarge}</AdviceNote>}
            <ResourceIssueList issues={resourceIssues} dict={dict} onSelect={onSelect} />
          </>
        )}
      </div>
    </div>
  );
}

function SecurityTab({
  analysis,
  dict,
  onSelect,
}: {
  analysis: HarAnalysis;
  dict: Dict;
  onSelect: (entry: ParsedHarEntry) => void;
}) {
  const { security } = analysis;
  const missing = security.checks.filter((c) => !c.present);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{dict.securityTab.description}</p>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{dict.securityTab.headersTitle}</h3>
        {security.target && <p className="text-xs text-muted-foreground">{dict.securityTab.targetNote}</p>}
        <div className="flex flex-col gap-2">
          {security.checks.map((check) => (
            <div key={check.name} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
              <span className="flex items-center gap-2 font-mono text-xs">
                {check.present ? (
                  <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                )}
                {check.name}
              </span>
              <Badge
                variant="outline"
                className={
                  check.present
                    ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-300"
                    : "border-destructive/40 text-destructive"
                }
              >
                {check.present ? dict.securityTab.headerPresent : dict.securityTab.headerMissing}
              </Badge>
            </div>
          ))}
        </div>
        {missing.map((check) => (
          <AdviceNote key={check.name}>{dict.securityTab.adviceMissing[check.name]}</AdviceNote>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{dict.securityTab.insecureTitle}</h3>
        {security.insecureRequests.length === 0 ? (
          <EmptyState>{dict.securityTab.insecureEmpty}</EmptyState>
        ) : (
          <>
            <p className="text-sm font-medium">
              {formatTemplate(dict.securityTab.insecureCount, { count: security.insecureRequests.length })}
            </p>
            <AdviceNote>{dict.securityTab.adviceInsecure}</AdviceNote>
            <RequestTable entries={security.insecureRequests} dict={dict} variant="list" onSelect={onSelect} />
          </>
        )}
      </div>
    </div>
  );
}

function ResourcesTab({ analysis, dict }: { analysis: HarAnalysis; dict: Dict }) {
  const totalSize = analysis.totalSize || 1;
  const nonEmpty = analysis.breakdown.filter((item) => item.count > 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{dict.resourcesTab.description}</p>

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {nonEmpty.map((item) => (
          <div
            key={item.category}
            className={cn("h-full", CATEGORY_COLOR_CLASS[item.category])}
            style={{ width: `${(item.size / totalSize) * 100}%` }}
            title={`${dict.categories[item.category]}: ${formatBytes(item.size)}`}
          />
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="border-b px-3 py-2 text-left font-medium">{dict.resourcesTab.tableCategory}</th>
              <th className="border-b px-3 py-2 text-right font-medium">{dict.resourcesTab.tableCount}</th>
              <th className="border-b px-3 py-2 text-right font-medium">{dict.resourcesTab.tableSize}</th>
              <th className="border-b px-3 py-2 text-right font-medium">{dict.resourcesTab.tablePercentage}</th>
            </tr>
          </thead>
          <tbody>
            {analysis.breakdown.map((item) => (
              <tr key={item.category} className="odd:bg-muted/30">
                <td className="border-b px-3 py-1.5">
                  <CategoryBadge category={item.category} dict={dict} />
                </td>
                <td className="border-b px-3 py-1.5 text-right font-mono text-xs tabular-nums">{item.count}</td>
                <td className="border-b px-3 py-1.5 text-right font-mono text-xs tabular-nums">
                  {formatBytes(item.size)}
                </td>
                <td className="border-b px-3 py-1.5 text-right font-mono text-xs tabular-nums">
                  {((item.size / totalSize) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KeyValueTable({ dict, rows }: { dict: Dict; rows: { name: string; value: string }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{dict.detail.none}</p>;
  }
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="border-b px-2.5 py-1.5 text-left font-medium">{dict.detail.paramName}</th>
            <th className="border-b px-2.5 py-1.5 text-left font-medium">{dict.detail.paramValue}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.name}-${i}`} className="odd:bg-muted/30">
              <td className="border-b px-2.5 py-1.5 align-top font-mono text-xs break-all">{row.name}</td>
              <td className="border-b px-2.5 py-1.5 align-top font-mono text-xs break-all">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailSheet({
  entry,
  dict,
  onClose,
}: {
  entry: ParsedHarEntry | null;
  dict: Dict;
  onClose: () => void;
}) {
  return (
    <Sheet open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {entry && (
          <>
            <SheetHeader>
              <SheetTitle className="break-all">
                <span className="mr-2 font-mono text-sm text-muted-foreground">{entry.method}</span>
                {entry.url}
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{dict.detail.generalTitle}</h3>
                <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">{dict.detail.status}</dt>
                  <dd className="flex items-center gap-1.5">
                    <StatusBadge status={entry.status} />
                    <span className="text-xs">{entry.statusText}</span>
                  </dd>
                  <dt className="text-muted-foreground">{dict.detail.time}</dt>
                  <dd className="font-mono text-xs">{formatDuration(entry.time)}</dd>
                  <dt className="text-muted-foreground">{dict.detail.size}</dt>
                  <dd className="font-mono text-xs">{formatBytes(entry.contentSize)}</dd>
                  <dt className="text-muted-foreground">{dict.detail.mimeType}</dt>
                  <dd className="font-mono text-xs break-all">{entry.mimeType}</dd>
                  {entry.httpVersion && (
                    <>
                      <dt className="text-muted-foreground">{dict.detail.httpVersion}</dt>
                      <dd className="font-mono text-xs">{entry.httpVersion}</dd>
                    </>
                  )}
                  {!entry.isHttps && (
                    <>
                      <dt className="text-muted-foreground">HTTPS</dt>
                      <dd className="flex items-center gap-1 text-xs text-destructive">
                        <Lock className="size-3.5" aria-hidden="true" />
                        {dict.securityTab.headerMissing}
                      </dd>
                    </>
                  )}
                </dl>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{dict.detail.timingBreakdown}</h3>
                <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">{dict.performanceTab.ttfb}</dt>
                  <dd className="font-mono">{formatDuration(entry.ttfb)}</dd>
                  <dt className="text-muted-foreground">{dict.performanceTab.download}</dt>
                  <dd className="font-mono">{formatDuration(entry.downloadTime)}</dd>
                </dl>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{dict.detail.requestHeaders}</h3>
                <KeyValueTable dict={dict} rows={entry.requestHeaders} />
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{dict.detail.responseHeaders}</h3>
                <KeyValueTable dict={dict} rows={entry.responseHeaders} />
              </div>

              {entry.queryString.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">{dict.detail.queryParams}</h3>
                  <KeyValueTable dict={dict} rows={entry.queryString} />
                </div>
              )}

              {entry.requestCookies.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">{dict.detail.requestCookies}</h3>
                  <KeyValueTable dict={dict} rows={entry.requestCookies} />
                </div>
              )}

              {entry.responseCookies.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">{dict.detail.responseCookies}</h3>
                  <KeyValueTable dict={dict} rows={entry.responseCookies} />
                </div>
              )}

              {entry.postData && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">{dict.detail.postData}</h3>
                  {entry.postData.params.length > 0 ? (
                    <KeyValueTable
                      dict={dict}
                      rows={entry.postData.params.map((p) => ({ name: p.name, value: p.value ?? p.fileName ?? "" }))}
                    />
                  ) : (
                    <pre className="max-h-60 overflow-auto rounded-md border bg-muted/30 p-2.5 font-mono text-xs break-all whitespace-pre-wrap">
                      {entry.postData.text || dict.detail.none}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const TAB_ORDER: Tab[] = ["errors", "performance", "security", "resources"];

export function HarAnalyzerTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.harAnalyzer;

  const [harData, setHarData] = React.useState<ParsedHar | null>(null);
  const [fileInfo, setFileInfo] = React.useState<{ name: string; size: number } | null>(null);
  const [parseError, setParseError] = React.useState<HarParseErrorCode | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<Tab>("errors");
  const [selectedEntry, setSelectedEntry] = React.useState<ParsedHarEntry | null>(null);

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>("all");

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const analysis = React.useMemo(() => (harData ? analyzeHar(harData.entries) : null), [harData]);

  const filteredEntries = React.useMemo(() => {
    if (!harData) return [];
    return filterEntries(harData.entries, { search, status: statusFilter, category: categoryFilter });
  }, [harData, search, statusFilter, categoryFilter]);

  function loadFile(file: File) {
    setParseError(null);
    file
      .text()
      .then((text) => {
        const result = parseHarText(text);
        if (result.ok) {
          setHarData(result.data);
          setFileInfo({ name: file.name, size: file.size });
          setActiveTab("errors");
          setSearch("");
          setStatusFilter("all");
          setCategoryFilter("all");
        } else {
          setHarData(null);
          setFileInfo(null);
          setParseError(result.error);
        }
      })
      .catch(() => {
        setHarData(null);
        setFileInfo(null);
        setParseError("readFailed" as HarParseErrorCode);
      });
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) loadFile(dropped);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) loadFile(selected);
    e.target.value = "";
  }

  function handleReset() {
    setHarData(null);
    setFileInfo(null);
    setParseError(null);
    setSelectedEntry(null);
  }

  const errorMessage =
    parseError === "invalid-json"
      ? dict.errors.invalidJson
      : parseError === "invalid-structure"
        ? dict.errors.invalidStructure
        : parseError === "empty"
          ? dict.errors.empty
          : parseError
            ? dict.errors.readFailed
            : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      {!harData ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-border"
          )}
        >
          <FileUp className="size-8 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">{dict.dropzone.title}</p>
            <p className="text-sm text-muted-foreground">{dict.dropzone.description}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="size-4" />
            {dict.dropzone.chooseFile}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".har,.json,application/json"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <p className="text-xs text-muted-foreground">{dict.dropzone.formats}</p>
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        </div>
      ) : (
        analysis && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-medium">{fileInfo?.name}</span>
                <span className="text-muted-foreground">
                  {dict.summary.requests}: {analysis.totalRequests}
                </span>
                <span className="text-muted-foreground">
                  {dict.summary.totalSize}: {formatBytes(analysis.totalSize)}
                </span>
                <span className="text-muted-foreground">
                  {dict.summary.totalTime}: {formatDuration(analysis.totalTime)}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RefreshCw className="size-4" />
                {dict.loadAnother}
              </Button>
            </div>

            <ScoreCard analysis={analysis} dict={dict} />

            <div className="flex flex-col gap-3">
              <div className="inline-flex w-fit flex-wrap gap-1 rounded-md border p-1">
                {TAB_ORDER.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                      activeTab === tab
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {dict.tabs[tab]}
                  </button>
                ))}
              </div>

              {activeTab === "errors" && (
                <ErrorsTab analysis={analysis} dict={dict} onSelect={setSelectedEntry} />
              )}
              {activeTab === "performance" && (
                <PerformanceTab analysis={analysis} dict={dict} onSelect={setSelectedEntry} />
              )}
              {activeTab === "security" && (
                <SecurityTab analysis={analysis} dict={dict} onSelect={setSelectedEntry} />
              )}
              {activeTab === "resources" && <ResourcesTab analysis={analysis} dict={dict} />}
            </div>

            <div className="flex flex-col gap-3 border-t pt-5">
              <h2 className="text-base font-semibold">{dict.requestList.title}</h2>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={dict.requestList.searchPlaceholder}
                  className="max-w-xs"
                />
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{dict.requestList.statusAll}</SelectItem>
                    <SelectItem value="2xx">{dict.requestList.status2xx}</SelectItem>
                    <SelectItem value="3xx">{dict.requestList.status3xx}</SelectItem>
                    <SelectItem value="4xx">{dict.requestList.status4xx}</SelectItem>
                    <SelectItem value="5xx">{dict.requestList.status5xx}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{dict.requestList.categoryAll}</SelectItem>
                    {RESOURCE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {dict.categories[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(search || statusFilter !== "all" || categoryFilter !== "all") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                      setCategoryFilter("all");
                    }}
                  >
                    <X className="size-4" />
                    {dict.requestList.clearFilters}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatTemplate(dict.requestList.resultCount, {
                  filtered: filteredEntries.length,
                  total: analysis.totalRequests,
                })}
              </p>
              {filteredEntries.length === 0 ? (
                <EmptyState>{dict.requestList.empty}</EmptyState>
              ) : (
                <RequestTable entries={filteredEntries} dict={dict} variant="list" onSelect={setSelectedEntry} />
              )}
            </div>
          </div>
        )
      )}

      <DetailSheet entry={selectedEntry} dict={dict} onClose={() => setSelectedEntry(null)} />
    </div>
  );
}
