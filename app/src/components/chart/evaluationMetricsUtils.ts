export const SCORE_ONLY_LABEL = "Score only";

const SCORE_ONLY_RESIDUAL_EPSILON = 1e-9;

export type EvaluationSummary = {
  readonly name: string;
  readonly count: number;
  readonly scoreCount: number;
  readonly labelCount: number;
  readonly meanScore: number | null;
  readonly labelFractions: ReadonlyArray<{
    readonly label: string;
    readonly fraction: number;
  }>;
};

export type EvaluationMetricsInputPoint = {
  readonly x: number;
  readonly metadata?: Readonly<
    Record<string, string | number | boolean | null>
  >;
  readonly summaries: ReadonlyArray<EvaluationSummary>;
};

export type EvaluationMetricsChartPoint = {
  readonly x: number;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
  readonly meanScore?: number;
  readonly count?: number;
  readonly scoreCount?: number;
  readonly labelCount?: number;
  readonly fractions: ReadonlyArray<number | undefined>;
};

export type EvaluationMetricsSeries = {
  readonly name: string;
  readonly hasScores: boolean;
  readonly hasLabels: boolean;
  readonly labels: ReadonlyArray<string>;
  readonly data: ReadonlyArray<EvaluationMetricsChartPoint>;
};

/**
 * Returns the share of result-bearing annotations that have a score but no
 * label. Tiny floating-point residuals are omitted instead of charted.
 */
export function deriveScoreOnlyFraction(
  labelFractions: ReadonlyArray<{ readonly fraction: number }>
): number | undefined {
  const labelFractionTotal = labelFractions.reduce(
    (total, labelFraction) => total + labelFraction.fraction,
    0
  );
  const residual = Math.min(1, Math.max(0, 1 - labelFractionTotal));
  return residual < SCORE_ONLY_RESIDUAL_EPSILON ? undefined : residual;
}

/**
 * Normalizes summary snapshots into one chart series per evaluation. An
 * evaluation's score/label shape is classified over the complete input
 * window, so sparse or mixed buckets do not change chart type over time.
 */
export function normalizeEvaluationMetrics(
  points: ReadonlyArray<EvaluationMetricsInputPoint>
): EvaluationMetricsSeries[] {
  const evaluationNames = new Set<string>();
  for (const point of points) {
    for (const summary of point.summaries) {
      evaluationNames.add(summary.name);
    }
  }

  return Array.from(evaluationNames)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => {
      const summaries = points
        .map((point) =>
          point.summaries.find((summary) => summary.name === name)
        )
        .filter((summary): summary is EvaluationSummary => summary != null);
      const hasScores = summaries.some((summary) => summary.scoreCount > 0);
      const hasLabels = summaries.some((summary) => summary.labelCount > 0);
      const labels = Array.from(
        new Set(
          summaries.flatMap((summary) =>
            summary.labelFractions.map(({ label }) => label)
          )
        )
      ).sort((left, right) => left.localeCompare(right));
      const hasScoreOnly =
        hasLabels &&
        summaries.some(
          (summary) => deriveScoreOnlyFraction(summary.labelFractions) != null
        );
      const distributionLabels = hasScoreOnly
        ? [...labels, SCORE_ONLY_LABEL]
        : labels;

      return {
        name,
        hasScores,
        hasLabels,
        labels: distributionLabels,
        data: points.map((point) => {
          const summary = point.summaries.find(
            (candidate) => candidate.name === name
          );
          const fractionsByLabel = new Map(
            summary?.labelFractions.map(({ label, fraction }) => [
              label,
              fraction,
            ])
          );
          const scoreOnlyFraction = summary
            ? deriveScoreOnlyFraction(summary.labelFractions)
            : undefined;
          return {
            x: point.x,
            metadata: point.metadata ?? {},
            meanScore: summary?.meanScore ?? undefined,
            count: summary?.count,
            scoreCount: summary?.scoreCount,
            labelCount: summary?.labelCount,
            fractions: distributionLabels.map((label) =>
              label === SCORE_ONLY_LABEL
                ? scoreOnlyFraction
                : fractionsByLabel.get(label)
            ),
          };
        }),
      };
    });
}
