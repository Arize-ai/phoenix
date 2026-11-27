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
 * One side of the slideover: an experiment, its color, and the repetition
 * the side is showing.
 */
export type CompareLane = {
  side: CompareLaneSide;
  experiment: CompareLaneExperiment;
  color: string;
  /** The 1-based repetition shown, already held inside the experiment's count */
  shownRepetitionNumber: number;
};

export type AnnotationConfigsByName = Partial<Record<string, AnnotationConfig>>;
