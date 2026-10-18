"use client";

import * as React from "react";
import { ChevronsDownUp, ChevronsUpDown, FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SafetyNote, TextInputPanel } from "@/components/tools/text-input-panel";
import { ToolActions } from "@/components/tools/tool-actions";
import { flattenPlan, parseExplain, type PlanNode } from "@/lib/pg-explain";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { cn, formatTemplate } from "@/lib/utils";

const SAMPLE = `[
  {
    "Plan": {
      "Node Type": "Hash Join", "Join Type": "Inner", "Total Cost": 2412.5,
      "Plan Rows": 120, "Actual Rows": 98000, "Actual Loops": 1,
      "Actual Startup Time": 12.1, "Actual Total Time": 182.4,
      "Hash Cond": "(o.customer_id = c.id)",
      "Plans": [
        {
          "Node Type": "Seq Scan", "Parent Relationship": "Outer", "Relation Name": "orders", "Alias": "o",
          "Total Cost": 1840.0, "Plan Rows": 100, "Actual Rows": 100000, "Actual Loops": 1,
          "Actual Startup Time": 0.02, "Actual Total Time": 121.7,
          "Filter": "(status = 'paid'::text)", "Rows Removed by Filter": 2000
        },
        {
          "Node Type": "Hash", "Parent Relationship": "Inner",
          "Plan Rows": 500, "Actual Rows": 480, "Actual Loops": 1, "Actual Total Time": 4.9,
          "Plans": [
            {
              "Node Type": "Index Scan", "Parent Relationship": "Outer", "Relation Name": "customers", "Alias": "c",
              "Index Name": "customers_region_idx", "Index Cond": "(region = 'jp'::text)",
              "Plan Rows": 500, "Actual Rows": 480, "Actual Loops": 1, "Actual Total Time": 4.1
            }
          ]
        },
        {
          "Node Type": "Index Scan", "Parent Relationship": "SubPlan", "Subplan Name": "SubPlan 1",
          "Relation Name": "coupons", "Index Name": "coupons_pkey",
          "Plan Rows": 1, "Actual Rows": 0, "Actual Loops": 0, "Actual Total Time": 0
        }
      ]
    },
    "Planning Time": 0.9,
    "Execution Time": 190.2
  }
]`;

type Dict = ReturnType<typeof getDictionary>["tools"]["pgExplainViewer"];

const ms = (value: number | undefined, locale: string) =>
  value === undefined ? "—" : `${value.toLocaleString(locale, { maximumFractionDigits: 3 })} ms`;
const count = (value: number | undefined, locale: string) => (value === undefined ? "—" : value.toLocaleString(locale));

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <span className={cn("whitespace-nowrap", className)}>
      <span className="text-muted-foreground">{label} </span>
      <span className="font-mono tabular-nums">{value}</span>
    </span>
  );
}

function NodeSummary({ dict, node, total, locale }: { dict: Dict; node: PlanNode; total?: number; locale: string }) {
  const share = node.selfTime !== undefined && total ? node.selfTime / total : undefined;
  const severe = node.misestimate !== undefined && node.misestimate >= 100;
  const warn = node.misestimate !== undefined && node.misestimate >= 10;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2">
        {node.parentRelationship && <span className="text-xs text-muted-foreground">{node.parentRelationship}</span>}
        <span className="font-medium">{node.nodeType}</span>
        {node.label && <span className="break-all font-mono text-xs">{node.label}</span>}
        {node.neverExecuted && (
          <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">{dict.neverExecuted}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
        <Metric label={dict.planRows} value={count(node.planRows, locale)} />
        <Metric label={dict.actualRows} value={count(node.actualRows, locale)} />
        <Metric label={dict.loops} value={count(node.loops, locale)} />
        <Metric label={dict.actualTime} value={ms(node.actualTotalTime, locale)} />
        <Metric
          label={dict.selfTime}
          value={`${ms(node.selfTime, locale)}${share !== undefined ? ` (${Math.round(share * 100)}%)` : ""}`}
          className={cn(share !== undefined && share >= 0.3 && "font-medium text-destructive")}
        />
        {node.misestimate !== undefined && node.misestimate >= 2 && (
          <span
            className={cn(
              "whitespace-nowrap font-medium",
              severe ? "text-destructive" : warn ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
            )}
          >
            {formatTemplate(node.underestimated ? dict.underestimated : dict.overestimated, {
              factor: node.misestimate.toLocaleString(locale, { maximumFractionDigits: 1 }),
            })}
          </span>
        )}
      </div>
      {node.details.length > 0 && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 text-xs">
          {node.details.map((detail) => (
            <React.Fragment key={detail.key}>
              <dt className="text-muted-foreground">{detail.key}</dt>
              <dd className="break-all font-mono">{detail.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}

function PlanTree({ dict, node, total, locale }: { dict: Dict; node: PlanNode; total?: number; locale: string }) {
  if (node.children.length === 0) {
    return (
      <div className="border-l py-1.5 pl-6">
        <NodeSummary dict={dict} node={node} total={total} locale={locale} />
      </div>
    );
  }
  return (
    <details open className="border-l py-1.5 pl-2 [&>summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none gap-1">
        <span className="inline-block h-fit w-3 shrink-0 select-none text-muted-foreground transition-transform [details[open]>summary>&]:rotate-90">▸</span>
        <NodeSummary dict={dict} node={node} total={total} locale={locale} />
      </summary>
      <div className="ml-2 mt-1 flex flex-col">
        {node.children.map((child) => (
          <PlanTree key={child.id} dict={dict} node={child} total={total} locale={locale} />
        ))}
      </div>
    </details>
  );
}

export function PgExplainViewerTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.pgExplainViewer;

  const [input, setInput] = React.useState("");
  const [fileError, setFileError] = React.useState(false);
  const [treeKey, setTreeKey] = React.useState(0);
  const [expanded, setExpanded] = React.useState(true);
  const deferred = React.useDeferredValue(input);
  const treeRef = React.useRef<HTMLDivElement>(null);

  const result = React.useMemo(() => (deferred.trim() === "" ? null : parseExplain(deferred)), [deferred]);
  const plan = result?.status === "ok" ? result.plan : null;
  const nodes = plan ? flattenPlan(plan.root) : [];
  // 実行時間（Execution Time）がなければ、ルートノードの時間を全体とみなす
  const total = plan ? (plan.executionTime ?? plan.root.inclusiveTime) : undefined;
  const slowest = nodes
    .filter((node) => node.selfTime !== undefined)
    .sort((a, b) => b.selfTime! - a.selfTime!)
    .slice(0, 3);
  const misestimated = nodes
    .filter((node) => node.misestimate !== undefined && node.misestimate >= 10)
    .sort((a, b) => b.misestimate! - a.misestimate!)
    .slice(0, 3);

  function setAll(open: boolean) {
    treeRef.current?.querySelectorAll("details").forEach((details) => {
      details.open = open;
    });
    setExpanded(open);
  }

  const describeNode = (node: PlanNode) => `${node.nodeType}${node.label ? ` ${node.label}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <SafetyNote>{dict.safetyNote}</SafetyNote>

      <TextInputPanel
        id="pg-explain-input"
        label={dict.inputLabel}
        value={input}
        onChange={setInput}
        placeholder={'[{"Plan": {"Node Type": "Seq Scan", ...}, "Execution Time": 1.2}]'}
        openFileLabel={dict.openFile}
        onFileError={() => setFileError(true)}
        accept=".json,.txt,application/json,text/plain"
        invalid={!!result && result.status !== "ok"}
      />
      {result?.status === "syntax" && (
        <p className="text-sm text-destructive">
          {formatTemplate(dict.parseError, { line: result.error.line, column: result.error.column, message: result.error.message })}
        </p>
      )}
      {result?.status === "noPlan" && <p className="text-sm text-destructive">{dict.noPlan}</p>}
      {fileError && <p className="text-sm text-destructive">{dict.fileReadError}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setInput(SAMPLE);
            setTreeKey((key) => key + 1);
            setExpanded(true);
          }}
        >
          <FlaskConical className="size-4" />
          {dict.loadSample}
        </Button>
        <ToolActions
          onClear={() => {
            setInput("");
            setFileError(false);
          }}
          clearDisabled={!input}
        />
      </div>

      {!plan ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{dict.emptyState}</p>
      ) : (
        <>
          <section className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <Metric label={dict.planningTime} value={ms(plan.planningTime, locale)} />
              <Metric label={dict.executionTime} value={ms(plan.executionTime, locale)} />
              <Metric label={dict.nodeCount} value={String(plan.nodeCount)} />
            </div>
            {!plan.analyzed && <p className="text-amber-700 dark:text-amber-400">{dict.notAnalyzed}</p>}
            {slowest.length > 0 && (
              <div>
                <p className="font-medium">{dict.slowestHeading}</p>
                <ol className="list-decimal pl-5">
                  {slowest.map((node) => (
                    <li key={node.id} className="break-all">
                      {describeNode(node)} — {ms(node.selfTime, locale)}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {misestimated.length > 0 && (
              <div>
                <p className="font-medium">{dict.misestimateHeading}</p>
                <ol className="list-decimal pl-5">
                  {misestimated.map((node) => (
                    <li key={node.id} className="break-all">
                      {describeNode(node)} —{" "}
                      {formatTemplate(dict.rowsComparison, {
                        plan: count(node.planRows, locale),
                        actual: count(node.actualRows, locale),
                        factor: node.misestimate!.toLocaleString(locale, { maximumFractionDigits: 1 }),
                      })}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{dict.timeNote}</p>
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium">{dict.treeHeading}</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setAll(!expanded)}>
                {expanded ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
                {expanded ? dict.collapseAll : dict.expandAll}
              </Button>
            </div>
            <div ref={treeRef} key={treeKey} className="overflow-x-auto rounded-lg border p-3 text-sm">
              <PlanTree dict={dict} node={plan.root} total={total} locale={locale} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
