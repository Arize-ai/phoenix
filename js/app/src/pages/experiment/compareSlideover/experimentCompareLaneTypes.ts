import type { AnnotationConfig } from "@phoenix/components/annotation";

export type CompareLaneSide = "base" | "compare";

export type CompareLaneExperiment = {
  readonly id: string;
  readonly name: string;
  readonly sequenceNumber: number;
  readonly repetitions: number;
  readonly metadata: unknown;
  readonly annotationSummaries: readonly {
    readonly annotationName: string;
    readonly minScore: number | null;
    readonly maxScore: number | null;
  }[];
};

/**
 * A run that is being generated and has no record yet.
 */
export type CompareLanePendingRun = {
  readonly repetitionNumber: number;
  /** The output received so far; null when the run does not stream */
  readonly partialOutput: string | null;
};

/**
 * What the slideover's caller knows about an experiment's runs for the open
 * example while it is still producing them. A finished experiment has none.
 */
export type CompareLaneLiveRuns = {
  readonly pendingRuns: readonly CompareLanePendingRun[];
  /**
   * Changes whenever a run or an annotation of the example is recorded, so
   * the lane reads its runs again.
   */
  readonly fetchKey: string;
};

/**
 * One side of the slideover: an experiment, its color, and the repetition
 * the side is showing.
 */
export type CompareLane = {
  side: CompareLaneSide;
  experiment: CompareLaneExperiment;
  color: string;
  /** The 1-based repetition shown, already held inside the experiment's count */
  shownRepetitionNumber: number;
  /** Set while the experiment's runs for the example are still coming in */
  liveRuns?: CompareLaneLiveRuns;
};

export type AnnotationConfigsByName = Partial<Record<string, AnnotationConfig>>;
