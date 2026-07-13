/**
 * The keys of the charts in the experiment metric chart catalog
 * (see metrics/chartCatalog.tsx), in the order they appear in the chart
 * selector. The Metrics page display order is determined by the
 * METRIC_PAGE_ROWS layout in metrics/DatasetMetricsPage.tsx, not by this
 * list's order.
 */
export const EXPERIMENT_METRIC_CHART_KEYS = [
  "annotation_scores",
  "latency",
  "cost",
  "tokens",
  "error_rate",
] as const;

export type ExperimentMetricChartKey =
  (typeof EXPERIMENT_METRIC_CHART_KEYS)[number];

export const isExperimentMetricChartKey = (
  key: string
): key is ExperimentMetricChartKey =>
  EXPERIMENT_METRIC_CHART_KEYS.includes(key as ExperimentMetricChartKey);

/**
 * The maximum number of metric charts that can be shown above the experiments
 * table at once.
 */
export const MAX_SELECTED_EXPERIMENT_METRIC_CHARTS = 3;

/**
 * The default metric charts shown above the experiments table.
 */
export const DEFAULT_EXPERIMENT_METRIC_CHART_KEYS: ExperimentMetricChartKey[] =
  ["annotation_scores", "latency", "cost"];

/**
 * The number of most recent experiments shown in the experiment metric charts.
 */
export const EXPERIMENT_METRICS_EXPERIMENT_COUNT = 7;
