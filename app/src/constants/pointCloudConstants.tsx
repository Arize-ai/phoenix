/**
 * UMAP configuration parameters
 * @src: https://umap-learn.readthedocs.io/en/latest/parameters.html
 */
export const DEFAULT_N_COMPONENTS = 3;
export const DEFAULT_N_NEIGHBORS = 30;
export const MIN_N_NEIGHBORS = 5;
export const MAX_N_NEIGHBORS = 100;
export const DEFAULT_MIN_DIST = 0.0;
export const MIN_MIN_DIST = 0.0;
export const MAX_MIN_DIST = 0.99;
/**
 * The default sample size for a single inferences for UMAP, if a primary and reference inferences are requested, the entire cloud will be twice this number
 */
export const DEFAULT_INFERENCES_SAMPLE_SIZE = 500;
export const MIN_INFERENCES_SAMPLE_SIZE = 300;
export const MAX_INFERENCES_SAMPLE_SIZE = 100000;

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
   * Color each point by the inferences the event / point belongs to.
   */
  inferences = "inferences",
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

export enum InferencesGroup {
  primary = "primary",
  reference = "reference",
  corpus = "corpus",
}

export enum CorrectnessGroup {
  correct = "correct",
  incorrect = "incorrect",
  unknown = "unknown",
}

export const DEFAULT_DARK_COLOR_SCHEME = ["#05fbff", "#cb8afd"];
export const DEFAULT_LIGHT_COLOR_SCHEME = ["#00add0", "#4500d9"];
/**
 * The default color to use when coloringStrategy does not apply.
 */
export const FALLBACK_COLOR = "#a5a5a5";
export const UNKNOWN_COLOR = FALLBACK_COLOR;
