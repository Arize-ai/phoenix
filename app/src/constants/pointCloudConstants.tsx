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

/**
 * Definitions for the color groups as determined by the coloring strategy.
 */

export enum DatasetGroup {
  primary = "primary",
  reference = "reference",
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
