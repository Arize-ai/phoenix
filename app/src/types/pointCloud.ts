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
