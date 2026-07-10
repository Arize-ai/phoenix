/**
 * The keys of the charts in the experiment metric chart catalog
 * (see metrics/chartCatalog.tsx). Display order is determined by the
 * METRIC_PAGE_ROWS layout in metrics/DatasetMetricsPage.tsx, not by this
 * list's order.
 */
export const EXPERIMENT_METRIC_CHART_KEYS = [
  "latency",
  "cost",
  "tokens",
  "error_rate",
] as const;

export type ExperimentMetricChartKey =
  (typeof EXPERIMENT_METRIC_CHART_KEYS)[number];

/**
 * The number of most recent experiments shown in the experiment metric charts.
 */
export const EXPERIMENT_METRICS_EXPERIMENT_COUNT = 7;
