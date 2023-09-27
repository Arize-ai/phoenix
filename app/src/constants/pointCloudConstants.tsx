/**
 * UMAP configuration parameters
 * @src: https://umap-learn.readthedocs.io/en/latest/parameters.html
 */
export const MIN_N_NEIGHBORS = 5;
export const MAX_N_NEIGHBORS = 100;
export const MIN_MIN_DIST = 0.0;
export const MAX_MIN_DIST = 0.99;
/**
 * The default sample size is passed as Config from server for a single dataset for UMAP, if a
 * primary and reference dataset are requested, the entire cloud will be twice this number
 */
export const MIN_DATASET_SAMPLE_SIZE = 300;
export const MAX_DATASET_SAMPLE_SIZE = 100000;

/**
 * HDBSCAN parameters
 */
export const DEFAULT_MIN_CLUSTER_SIZE = 10;
export const MIN_CLUSTER_MIN_SAMPLES = 1;
export const MIN_MIN_CLUSTER_SIZE = 2;
export const DEFAULT_CLUSTER_MIN_SAMPLES = 1;
export const DEFAULT_CLUSTER_SELECTION_EPSILON = 0;

export enum ColoringStrategy {
  /**
   * Color each point by the dataset the event / point belongs to.
   */
  dataset = "dataset",
  /**
   * Color each point by the correctness (E.g. predicted value == actual value)
   */
  correctness = "correctness",
  /**
   * Color each point by a specific dimension value
   */
  dimension = "dimension",
}

export enum SelectionDisplay {
  list = "list",
  gallery = "gallery",
}

export enum SelectionGridSize {
  small = "small",
  medium = "medium",
  large = "large",
}

/**
 * Definitions for the color groups as determined by the coloring strategy.
 */

export enum DatasetGroup {
  primary = "primary",
  reference = "reference",
  corpus = "corpus",
}

export enum CorrectnessGroup {
  correct = "correct",
  incorrect = "incorrect",
  unknown = "unknown",
}

export const DEFAULT_COLOR_SCHEME = ["#05fbff", "#cb8afd"];

/**
 * The default color to use when coloringStrategy does not apply.
 */
export const FALLBACK_COLOR = "#a5a5a5";
export const UNKNOWN_COLOR = FALLBACK_COLOR;
