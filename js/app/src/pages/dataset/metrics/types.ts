/**
 * Sync id shared by all experiment metric charts so hovering one chart
 * highlights the same experiment across all of them.
 */
export const EXPERIMENT_METRICS_CHART_SYNC_ID = "experimentMetrics";

/**
 * Selects the dataset's most recent experiments (up to
 * `EXPERIMENT_METRICS_EXPERIMENT_COUNT`). They are charted oldest to newest,
 * with the dataset's baseline experiment as the reference. Used by the
 * experiments list and the dataset metrics page.
 */
export type RecentExperimentSelection = {
  type: "recent";
};

/**
 * Selects exactly the experiments picked on the experiment compare page. The
 * base experiment is charted first as the reference, followed by the compare
 * experiments in the order they were picked.
 */
export type ComparedExperimentSelection = {
  type: "compared";
  baseExperimentId: string;
  compareExperimentIds: string[];
};

/**
 * Which of a dataset's experiments an experiment metric chart plots: the most
 * recent experiments, or the experiments picked for comparison. `type` tells
 * the two apart.
 */
export type ExperimentSelection =
  | RecentExperimentSelection
  | ComparedExperimentSelection;

/**
 * The selection of the dataset's most recent experiments
 */
export const RECENT_EXPERIMENT_SELECTION: RecentExperimentSelection = {
  type: "recent",
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
   * Which of the dataset's experiments to chart
   */
  experimentSelection: ExperimentSelection;
}
