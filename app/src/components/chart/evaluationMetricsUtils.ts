export const UNLABELED_LABEL = "unlabeled";

const UNLABELED_RESIDUAL_EPSILON = 1e-9;

export type EvaluationSummary = {
  readonly name: string;
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
  readonly fractions: ReadonlyArray<number | undefined>;
  readonly unlabeledFraction?: number;
};

export type EvaluationMetricsSeries = {
  readonly name: string;
  readonly hasScores: boolean;
  readonly hasLabels: boolean;
  readonly hasUnlabeled: boolean;
  readonly labels: ReadonlyArray<string>;
  readonly data: ReadonlyArray<EvaluationMetricsChartPoint>;
  readonly reference?: EvaluationMetricsChartPoint;
};

/**
 * Returns the share of annotations without a label. The server includes every
 * annotation of the evaluation name in the label-fraction denominator but
 * transmits only named labels, leaving this residual for the client to render.
 */
export function deriveUnlabeledFraction(
  labelFractions: ReadonlyArray<{ readonly fraction: number }>
): number | undefined {
  const labeledFraction = labelFractions.reduce(
    (total, { fraction }) => total + fraction,
    0
  );
  const residual = Math.min(1, Math.max(0, 1 - labeledFraction));
  return residual < UNLABELED_RESIDUAL_EPSILON ? undefined : residual;
}

/**
 * Normalizes summary snapshots into one chart series per evaluation. Shape is
 * classified over the visible window so sparse buckets cannot switch a chart
 * between score and distribution modes as the user changes the time range.
 */
export function normalizeEvaluationMetrics({
  points,
  referencePoint,
}: {
  points: ReadonlyArray<EvaluationMetricsInputPoint>;
  referencePoint?: EvaluationMetricsInputPoint;
}): EvaluationMetricsSeries[] {
  const evaluationNames = new Set<string>();
  for (const point of points) {
    for (const summary of point.summaries) {
      evaluationNames.add(summary.name);
    }
  }

  return Array.from(evaluationNames)
    .sort((left, right) => left.localeCompare(right))
    .map((name): EvaluationMetricsSeries => {
      const summaryByPoint = points.map((point) => ({
        point,
        summary: point.summaries.find((summary) => summary.name === name),
      }));
      const summaries = summaryByPoint.flatMap(({ summary }) =>
        summary == null ? [] : [summary]
      );
      const hasScores = summaries.some(({ meanScore }) => meanScore != null);
      const hasLabels = summaries.some(
        ({ labelFractions }) => labelFractions.length > 0
      );
      // The reference is a comparison point, not part of the visible window
      // used to classify an evaluation's chart shape.
      const referenceSummary = referencePoint?.summaries.find(
        (summary) => summary.name === name
      );
      const distributionSummaries =
        hasLabels && referenceSummary != null
          ? [...summaries, referenceSummary]
          : summaries;
      // Reference-only labels must share the same indexes and colors as the
      // visible bars when the baseline is prepended to a distribution chart.
      const labels = hasLabels
        ? Array.from(
            new Set(
              distributionSummaries.flatMap((summary) =>
                summary.labelFractions.map(({ label }) => label)
              )
            )
          ).sort((left, right) => left.localeCompare(right))
        : [];
      const hasUnlabeled =
        hasLabels &&
        distributionSummaries.some(
          ({ labelFractions }) =>
            deriveUnlabeledFraction(labelFractions) != null
        );

      const makeChartPoint = ({
        point,
        summary,
      }: {
        point: EvaluationMetricsInputPoint;
        summary: EvaluationSummary;
      }): EvaluationMetricsChartPoint => {
        const fractionsByLabel = new Map(
          summary.labelFractions.map(({ label, fraction }) => [label, fraction])
        );
        return {
          x: point.x,
          metadata: point.metadata ?? {},
          // A baseline does not introduce a score series that is absent from
          // the visible window, so only retain scores after window classification.
          meanScore: hasScores ? (summary.meanScore ?? undefined) : undefined,
          fractions: labels.map((label) => fractionsByLabel.get(label)),
          unlabeledFraction: hasLabels
            ? deriveUnlabeledFraction(summary.labelFractions)
            : undefined,
        };
      };

      // Once a name has labels anywhere in the window, every summary for that
      // name belongs in the distribution; a summary with no labels is 100%
      // unlabeled. Score-only charts still omit points that have no score.
      const data = summaryByPoint.flatMap(({ point, summary }) =>
        summary != null && (hasLabels || summary.meanScore != null)
          ? [makeChartPoint({ point, summary })]
          : []
      );
      const referenceIsChartable =
        referencePoint != null &&
        referenceSummary != null &&
        (hasLabels || (hasScores && referenceSummary.meanScore != null));

      return {
        name,
        hasScores,
        hasLabels,
        hasUnlabeled,
        labels,
        data,
        reference: referenceIsChartable
          ? makeChartPoint({
              point: referencePoint,
              summary: referenceSummary,
            })
          : undefined,
      };
    })
    .filter(({ hasScores, hasLabels }) => hasScores || hasLabels);
}
