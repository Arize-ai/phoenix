export function calculateAnnotationScorePercentile(
  value: number,
  min?: number | null,
  max?: number | null
): number {
  // Assume a 0 to 1 range if min and max are not provided
  const correctedMin = typeof min === "number" ? min : 0;
  const correctedMax = typeof max === "number" ? max : 1;

  if (correctedMin === correctedMax && correctedMax === value) {
    // All the values are the same
    // If the value is 0, show empty; if non-zero, show full
    return value === 0 ? 0 : 100;
  }

  // Avoid division by zero
  const range = correctedMax - correctedMin || 1;
  return ((value - correctedMin) / range) * 100;
}

type AnnotationSummary = {
  readonly annotationName: string;
  readonly meanScore: number | null;
};

type AnnotatedExperiment = {
  readonly id: string;
  readonly annotationSummaries: ReadonlyArray<AnnotationSummary>;
};

export type AnnotationMeanScoreComparison = {
  annotationName: string;
  baseExperimentMeanScore: number;
  compareExperimentMeanScores: {
    experimentId: string;
    meanScore: number | null;
  }[];
};

/**
 * Pairs each annotation scored on the base experiment with every compare
 * experiment's mean score for it, null where that experiment lacks the
 * annotation. With no compare experiments each comparison list is empty.
 */
export function compareAnnotationMeanScores(
  baseExperiment: Pick<AnnotatedExperiment, "annotationSummaries">,
  compareExperiments: ReadonlyArray<AnnotatedExperiment>
): AnnotationMeanScoreComparison[] {
  const comparisons: AnnotationMeanScoreComparison[] = [];
  for (const {
    annotationName,
    meanScore,
  } of baseExperiment.annotationSummaries) {
    if (meanScore == null) {
      continue;
    }
    comparisons.push({
      annotationName,
      baseExperimentMeanScore: meanScore,
      compareExperimentMeanScores: compareExperiments.map((experiment) => ({
        experimentId: experiment.id,
        meanScore:
          experiment.annotationSummaries.find(
            (summary) => summary.annotationName === annotationName
          )?.meanScore ?? null,
      })),
    });
  }
  return comparisons;
}
