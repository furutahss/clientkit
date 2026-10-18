/**
 * PostgreSQL の EXPLAIN (FORMAT JSON)（ANALYZE付き・なし）の出力を解析する。
 * 実測値がない項目は undefined のまま扱い、0として扱わない。
 */
import { locateJsonError, type JsonErrorLocation } from "@/lib/json-error";

type RawNode = Record<string, unknown> & { Plans?: RawNode[] };

export type PlanNode = {
  id: number;
  depth: number;
  nodeType: string;
  /** Relation Name・Index Name・Join Type など、ノードを特定するための補足 */
  label: string;
  parentRelationship?: string;
  planRows?: number;
  actualRows?: number;
  loops?: number;
  /** 1ループあたりの実測時間（ms、子ノードを含む） */
  actualTotalTime?: number;
  /** 全ループ合計の時間（ms、子ノードを含む）。並列実行中のノードはプロセス数で割った概算 */
  inclusiveTime?: number;
  /** 子ノードの時間を除いた自身の時間（ms）。並列・CTE・InitPlanにより負になる場合は0に丸める */
  selfTime?: number;
  /** 推定行数と実測行数（いずれも1ループあたり）のずれの倍率。1以上 */
  misestimate?: number;
  underestimated?: boolean;
  /** 一度も実行されなかった（Actual Loops が 0） */
  neverExecuted: boolean;
  details: { key: string; value: string }[];
  children: PlanNode[];
};

export type PlanSummary = {
  root: PlanNode;
  analyzed: boolean;
  planningTime?: number;
  executionTime?: number;
  nodeCount: number;
};

export type PlanParseResult =
  | { status: "ok"; plan: PlanSummary }
  | { status: "syntax"; error: JsonErrorLocation }
  | { status: "noPlan" };

const DETAIL_KEYS = [
  "Index Cond",
  "Recheck Cond",
  "Hash Cond",
  "Merge Cond",
  "Join Filter",
  "Filter",
  "Rows Removed by Filter",
  "Rows Removed by Join Filter",
  "Rows Removed by Index Recheck",
  "Sort Key",
  "Sort Method",
  "Group Key",
  "Workers Planned",
  "Workers Launched",
  "Shared Hit Blocks",
  "Shared Read Blocks",
  "Temp Read Blocks",
  "Temp Written Blocks",
  "Total Cost",
];

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

/** psqlの表形式で出力された「QUERY PLAN」見出しや行末の + を取り除く */
function stripPsqlDecoration(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*(QUERY PLAN|-{3,}|\(\d+ rows?\))\s*$/.test(line))
    .map((line) => line.replace(/\s*\+\s*$/, ""))
    .join("\n");
}

function parseJson(text: string): { value: unknown } | { error: JsonErrorLocation } {
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    try {
      return { value: JSON.parse(stripPsqlDecoration(text)) };
    } catch {
      return { error: locateJsonError(text, error) };
    }
  }
}

function findRoot(value: unknown): Record<string, unknown> | undefined {
  const entry = Array.isArray(value) ? value[0] : value;
  if (!entry || typeof entry !== "object") return undefined;
  const record = entry as Record<string, unknown>;
  if (record.Plan && typeof record.Plan === "object") return record;
  // Planを含まないノード単体が貼り付けられた場合
  if (typeof record["Node Type"] === "string") return { Plan: record };
  return undefined;
}

function nodeLabel(raw: RawNode): string {
  const parts: string[] = [];
  if (typeof raw["Join Type"] === "string" && raw["Node Type"] !== "Hash") parts.push(`${raw["Join Type"]}`);
  if (typeof raw["Strategy"] === "string") parts.push(`${raw["Strategy"]}`);
  if (typeof raw["Relation Name"] === "string") {
    const alias = raw["Alias"] && raw["Alias"] !== raw["Relation Name"] ? ` ${raw["Alias"]}` : "";
    parts.push(`on ${raw["Relation Name"]}${alias}`);
  } else if (typeof raw["CTE Name"] === "string") {
    parts.push(`on ${raw["CTE Name"]}`);
  }
  if (typeof raw["Index Name"] === "string") parts.push(`using ${raw["Index Name"]}`);
  if (typeof raw["Subplan Name"] === "string") parts.push(`(${raw["Subplan Name"]})`);
  return parts.join(" ");
}

export function parseExplain(text: string): PlanParseResult {
  const parsed = parseJson(text);
  if ("error" in parsed) return { status: "syntax", error: parsed.error };
  const root = findRoot(parsed.value);
  if (!root) return { status: "noPlan" };

  let nextId = 0;
  let analyzed = false;

  function build(raw: RawNode, depth: number, parallelProcesses: number): PlanNode {
    const loops = num(raw["Actual Loops"]);
    const actualTotalTime = num(raw["Actual Total Time"]);
    const actualRows = num(raw["Actual Rows"]);
    const planRows = num(raw["Plan Rows"]);
    if (loops !== undefined) analyzed = true;

    // Gather配下のノードは各プロセスの平均値が出力されるため、ループ数をプロセス数で割って概算する
    const workers = num(raw["Workers Launched"]);
    const isGather = raw["Node Type"] === "Gather" || raw["Node Type"] === "Gather Merge";
    const childProcesses = isGather && workers !== undefined ? workers + 1 : parallelProcesses;

    const children = (Array.isArray(raw.Plans) ? raw.Plans : []).map((child) => build(child, depth + 1, childProcesses));
    const inclusiveTime =
      actualTotalTime !== undefined && loops !== undefined ? (actualTotalTime * loops) / parallelProcesses : undefined;
    const childTime = children.reduce((sum, child) => sum + (child.inclusiveTime ?? 0), 0);

    let misestimate: number | undefined;
    let underestimated: boolean | undefined;
    if (planRows !== undefined && actualRows !== undefined && loops !== undefined && loops > 0) {
      // 0行同士の比較で0除算にならないよう、どちらも最低1行として比較する
      const estimated = Math.max(planRows, 1);
      const actual = Math.max(actualRows, 1);
      misestimate = Math.max(estimated, actual) / Math.min(estimated, actual);
      underestimated = actual > estimated;
    }

    return {
      id: nextId++,
      depth,
      nodeType: typeof raw["Node Type"] === "string" ? raw["Node Type"] : "?",
      label: nodeLabel(raw),
      parentRelationship: typeof raw["Parent Relationship"] === "string" ? raw["Parent Relationship"] : undefined,
      planRows,
      actualRows,
      loops,
      actualTotalTime,
      inclusiveTime,
      selfTime: inclusiveTime !== undefined ? Math.max(0, inclusiveTime - childTime) : undefined,
      misestimate,
      underestimated,
      neverExecuted: loops === 0,
      details: DETAIL_KEYS.filter((key) => raw[key] !== undefined).map((key) => ({
        key,
        value: Array.isArray(raw[key]) ? (raw[key] as unknown[]).join(", ") : String(raw[key]),
      })),
      children,
    };
  }

  const tree = build(root.Plan as RawNode, 0, 1);
  return {
    status: "ok",
    plan: {
      root: tree,
      analyzed,
      planningTime: num(root["Planning Time"]),
      executionTime: num(root["Execution Time"]),
      nodeCount: nextId,
    },
  };
}

export function flattenPlan(node: PlanNode): PlanNode[] {
  return [node, ...node.children.flatMap(flattenPlan)];
}
