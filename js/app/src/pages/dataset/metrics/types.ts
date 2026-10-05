/**
 * Sync id shared by all experiment metric charts so hovering one chart
 * highlights the same experiment across all of them.
 */
export const EXPERIMENT_METRICS_CHART_SYNC_ID = "experimentMetrics";

/**
 * An explicit set of experiments to chart, as picked on the experiment compare
 * page. The base experiment is drawn as the reference and charted first,
 * followed by the compare experiments in selection order.
 */
export type ExperimentMetricsSelection = {
  baseExperimentId: string;
  compareExperimentIds: string[];
};

/**
 * The props for a single experiment metric chart view.
 */
export interface ExperimentMetricViewProps {
  /**
   * The ID of the dataset whose experiments are charted.
   */
  datasetId: string;
  /**
   * The experiments to chart. When omitted, the dataset's most recent
   * experiments are charted against the dataset baseline.
   */
  selection?: ExperimentMetricsSelection;
}
