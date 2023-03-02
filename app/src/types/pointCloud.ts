export enum ColoringStrategy {
  dataset = "dataset",
  correctness = "correctness",
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
