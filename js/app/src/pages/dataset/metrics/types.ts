/**
 * Sync id shared by all experiment metric charts so hovering one chart
 * highlights the same experiment across all of them.
 */
export const EXPERIMENT_METRICS_CHART_SYNC_ID = "experimentMetrics";

/**
 * The props for a single experiment metric chart view.
 */
export interface ExperimentMetricViewProps {
  /**
   * The ID of the dataset whose experiments are charted.
   */
  datasetId: string;
}
