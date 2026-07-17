export const PROJECT_TABS = ["traces", "spans", "sessions", "metrics"] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number];

/**
 * The default number of items to show in a table.
 * A typical big screen can only show less than 30 items at a time.
 */
export const DEFAULT_PAGE_SIZE = 30;

export const isProjectTab = (tab: string): tab is ProjectTab => {
  return PROJECT_TABS.includes(tab as ProjectTab);
};

/**
 * The keys of the charts in the project metric chart catalog
 * (see metrics/chartCatalog.tsx). The order here determines the order in
 * which the charts are displayed.
 */
export const PROJECT_METRIC_CHART_KEYS = [
  "traffic",
  "traces",
  "latency",
  "cost",
  "top_models_by_cost",
  "tokens",
  "top_models_by_tokens",
  "prompt_token_details",
  "completion_token_details",
  "llm_spans",
  "llm_span_errors",
  "tool_spans",
  "tool_span_errors",
  "span_annotations",
  "trace_annotations",
  "session_annotations",
] as const;

export type BuiltInProjectMetricChartKey =
  (typeof PROJECT_METRIC_CHART_KEYS)[number];

/**
 * The project table views that show a strip of metric charts above the table.
 */
export const METRIC_CHART_TABLE_VIEWS = [
  "spans",
  "traces",
  "sessions",
] as const;

export type MetricChartTableView = (typeof METRIC_CHART_TABLE_VIEWS)[number];

const PROJECT_EVALUATION_METRIC_CHART_KEY_SUFFIX = "_evaluation:";

export type ProjectEvaluationMetricChartKey =
  `${MetricChartTableView}${typeof PROJECT_EVALUATION_METRIC_CHART_KEY_SUFFIX}${string}`;

export type ProjectMetricChartKey =
  | BuiltInProjectMetricChartKey
  | ProjectEvaluationMetricChartKey;

export function getProjectEvaluationMetricChartKey({
  view,
  evaluationName,
}: {
  view: MetricChartTableView;
  evaluationName: string;
}): ProjectEvaluationMetricChartKey {
  return `${view}${PROJECT_EVALUATION_METRIC_CHART_KEY_SUFFIX}${evaluationName}`;
}

export function getProjectEvaluationMetricChartInfo(
  key: string
): { view: MetricChartTableView; evaluationName: string } | undefined {
  for (const view of METRIC_CHART_TABLE_VIEWS) {
    const prefix = `${view}${PROJECT_EVALUATION_METRIC_CHART_KEY_SUFFIX}`;
    if (key.startsWith(prefix)) {
      const evaluationName = key.slice(prefix.length);
      return evaluationName.length > 0 ? { view, evaluationName } : undefined;
    }
  }
  return undefined;
}

export const isProjectMetricChartKey = (
  key: string
): key is ProjectMetricChartKey =>
  PROJECT_METRIC_CHART_KEYS.includes(key as BuiltInProjectMetricChartKey) ||
  getProjectEvaluationMetricChartInfo(key) != null;

/**
 * The maximum number of metric charts that can be shown above a table at once.
 */
export const MAX_SELECTED_METRIC_CHARTS = 3;

/**
 * The default metric charts shown above each table view.
 */
export const DEFAULT_METRIC_CHART_KEYS: Record<
  MetricChartTableView,
  ProjectMetricChartKey[]
> = {
  spans: ["traffic"],
  traces: ["traces", "latency", "trace_annotations"],
  sessions: ["traces", "session_annotations"],
};
