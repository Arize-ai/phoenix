export type EvaluationMetricsView = "labels" | "scores";

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
};

export type EvaluationMetricsSeries = {
  readonly name: string;
  readonly views: ReadonlyArray<EvaluationMetricsView>;
  readonly labels: ReadonlyArray<string>;
  readonly dataByView: Readonly<
    Record<EvaluationMetricsView, ReadonlyArray<EvaluationMetricsChartPoint>>
  >;
  readonly referenceByView: Readonly<
    Partial<Record<EvaluationMetricsView, EvaluationMetricsChartPoint>>
  >;
};

export function getDefaultEvaluationMetricsView(
  series: EvaluationMetricsSeries
): EvaluationMetricsView {
  // Prefer labels for mixed evaluations because a distribution exposes more
  // categorical detail than the aggregate score.
  return series.views.includes("labels") ? "labels" : "scores";
}

/**
 * Normalizes summary snapshots into one chart series per evaluation. Separate
 * score and label datasets let mixed evaluations switch views without putting
 * scores and percentages on the same axis.
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
      // The reference is a comparison point, not part of the visible window
      // used to decide whether an evaluation offers label and/or score views.
      const referenceSummary = referencePoint?.summaries.find(
        (summary) => summary.name === name
      );
      const labels = Array.from(
        new Set(
          [...summaryByPoint.map(({ summary }) => summary), referenceSummary]
            .filter((summary): summary is EvaluationSummary => summary != null)
            .flatMap((summary) =>
              summary.labelFractions.map(({ label }) => label)
            )
        )
      ).sort((left, right) => left.localeCompare(right));

      const makeScorePoint = ({
        point,
        summary,
      }: {
        point: EvaluationMetricsInputPoint;
        summary: EvaluationSummary;
      }): EvaluationMetricsChartPoint => ({
        x: point.x,
        metadata: point.metadata ?? {},
        meanScore: summary.meanScore ?? undefined,
        fractions: [],
      });
      const makeLabelPoint = ({
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
          fractions: labels.map((label) => fractionsByLabel.get(label)),
        };
      };

      // Omit individual experiments/buckets that have no value for the active
      // view instead of rendering misleading empty bars.
      const scoreData = summaryByPoint.flatMap(({ point, summary }) =>
        summary?.meanScore == null ? [] : [makeScorePoint({ point, summary })]
      );
      const labelData = summaryByPoint.flatMap(({ point, summary }) =>
        summary == null || summary.labelFractions.length === 0
          ? []
          : [makeLabelPoint({ point, summary })]
      );
      const views: EvaluationMetricsView[] = [];
      if (labelData.length > 0) {
        views.push("labels");
      }
      if (scoreData.length > 0) {
        views.push("scores");
      }

      return {
        name,
        views,
        labels,
        dataByView: {
          labels: labelData,
          scores: scoreData,
        },
        referenceByView: {
          labels:
            labelData.length > 0 &&
            referencePoint != null &&
            referenceSummary != null &&
            referenceSummary.labelFractions.length > 0
              ? makeLabelPoint({
                  point: referencePoint,
                  summary: referenceSummary,
                })
              : undefined,
          scores:
            scoreData.length > 0 &&
            referencePoint != null &&
            referenceSummary?.meanScore != null
              ? makeScorePoint({
                  point: referencePoint,
                  summary: referenceSummary,
                })
              : undefined,
        },
      };
    })
    .filter(({ views }) => views.length > 0);
}
