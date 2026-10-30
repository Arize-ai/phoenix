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

/**
 * The keys of the charts the project evaluators table offers, in display
 * order. They chart the project's evaluators, not its traces, so the other
 * tables don't offer them.
 */
export const EVALUATOR_METRIC_CHART_KEYS = [
  "evaluations_by_evaluator",
  "evaluation_lag_by_evaluator",
  "cost_by_evaluator",
  "failures_by_evaluator",
  "cost_over_time_by_evaluator",
  "evaluation_queue_size",
] as const;

export type BuiltInProjectMetricChartKey =
  | (typeof PROJECT_METRIC_CHART_KEYS)[number]
  | (typeof EVALUATOR_METRIC_CHART_KEYS)[number];

/**
 * The levels annotations are charted at: the spans, traces and sessions
 * tables' rows.
 */
export const ANNOTATION_METRIC_LEVELS = [
  "spans",
  "traces",
  "sessions",
] as const;

export type AnnotationMetricLevel = (typeof ANNOTATION_METRIC_LEVELS)[number];

/**
 * The project table views that show a strip of metric charts above the table.
 */
export const METRIC_CHART_TABLE_VIEWS = [
  ...ANNOTATION_METRIC_LEVELS,
  "evaluators",
] as const;

export type MetricChartTableView = (typeof METRIC_CHART_TABLE_VIEWS)[number];

export const PROJECT_ANNOTATION_METRIC_CHART_DESCRIPTION =
  "Evaluation results over time";

// The level identifies which entity-level metrics query should render an
// annotation name that may also exist on another level.
const PROJECT_ANNOTATION_METRIC_CHART_KEY_SEPARATOR = "_annotation:";

export type ProjectAnnotationMetricChartKey =
  `${AnnotationMetricLevel}${typeof PROJECT_ANNOTATION_METRIC_CHART_KEY_SEPARATOR}${string}`;

export type ProjectMetricChartKey =
  | BuiltInProjectMetricChartKey
  | ProjectAnnotationMetricChartKey;

export function getProjectAnnotationMetricChartKey({
  view,
  annotationName,
}: {
  view: AnnotationMetricLevel;
  annotationName: string;
}): ProjectAnnotationMetricChartKey {
  return `${view}${PROJECT_ANNOTATION_METRIC_CHART_KEY_SEPARATOR}${annotationName}`;
}

export function getProjectAnnotationMetricChartInfo(
  key: string
): { view: AnnotationMetricLevel; annotationName: string } | undefined {
  for (const view of ANNOTATION_METRIC_LEVELS) {
    const prefix = `${view}${PROJECT_ANNOTATION_METRIC_CHART_KEY_SEPARATOR}`;
    if (key.startsWith(prefix)) {
      const annotationName = key.slice(prefix.length);
      return { view, annotationName };
    }
  }
  return undefined;
}

export const isProjectMetricChartKey = (
  key: string
): key is ProjectMetricChartKey =>
  [...PROJECT_METRIC_CHART_KEYS, ...EVALUATOR_METRIC_CHART_KEYS].includes(
    key as BuiltInProjectMetricChartKey
  ) || getProjectAnnotationMetricChartInfo(key) != null;

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
  evaluators: [
    "evaluations_by_evaluator",
    "evaluation_lag_by_evaluator",
    "cost_by_evaluator",
  ],
};
