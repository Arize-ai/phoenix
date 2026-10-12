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
  "prompt_token_details",
  "completion_token_details",
  "error_rate",
] as const;

export type BuiltInExperimentMetricChartKey =
  (typeof EXPERIMENT_METRIC_CHART_KEYS)[number];

const EXPERIMENT_ANNOTATION_METRIC_CHART_KEY_PREFIX = "annotation:";

export type ExperimentAnnotationMetricChartKey =
  `${typeof EXPERIMENT_ANNOTATION_METRIC_CHART_KEY_PREFIX}${string}`;

export type ExperimentMetricChartKey =
  | BuiltInExperimentMetricChartKey
  | ExperimentAnnotationMetricChartKey;

export function getExperimentAnnotationMetricChartKey(
  annotationName: string
): ExperimentAnnotationMetricChartKey {
  return `${EXPERIMENT_ANNOTATION_METRIC_CHART_KEY_PREFIX}${annotationName}`;
}

export function getExperimentAnnotationName(key: string): string | undefined {
  if (!key.startsWith(EXPERIMENT_ANNOTATION_METRIC_CHART_KEY_PREFIX)) {
    return undefined;
  }
  return key.slice(EXPERIMENT_ANNOTATION_METRIC_CHART_KEY_PREFIX.length);
}

/**
 * Annotation keys are validated by shape because current annotation names
 * require a dataset query. Stale selections intentionally survive hydration
 * so the selector can show them and let the user deselect them.
 */
export const isExperimentMetricChartKey = (
  key: string
): key is ExperimentMetricChartKey =>
  EXPERIMENT_METRIC_CHART_KEYS.includes(
    key as BuiltInExperimentMetricChartKey
  ) || getExperimentAnnotationName(key) != null;

/**
 * Drops persisted chart keys that are no longer in the chart catalog so stale
 * keys don't render as empty panels. A value that is not a list falls back to
 * `fallback`.
 */
export function sanitizeExperimentMetricChartKeys(
  keys: unknown,
  fallback: ExperimentMetricChartKey[]
): ExperimentMetricChartKey[] {
  return Array.isArray(keys)
    ? keys.filter(
        (key): key is ExperimentMetricChartKey =>
          typeof key === "string" && isExperimentMetricChartKey(key)
      )
    : fallback;
}

/**
 * The default metric charts shown above the experiments table.
 */
export const DEFAULT_EXPERIMENT_METRIC_CHART_KEYS: ExperimentMetricChartKey[] =
  ["annotation_scores", "latency", "cost"];

/**
 * The number of most recent experiments shown in the experiment metric charts.
 */
export const EXPERIMENT_METRICS_EXPERIMENT_COUNT = 7;

export const EXPERIMENT_ANNOTATION_METRIC_CHART_DESCRIPTION =
  "Evaluation results by experiment";
