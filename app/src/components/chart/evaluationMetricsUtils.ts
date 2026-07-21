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
  /** Distinguishes an empty axis category from a summary with no labels. */
  readonly hasAnnotationSummary: boolean;
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

export function getEmptyEvaluationMetricsSeries(
  name: string
): EvaluationMetricsSeries {
  return {
    name,
    views: [],
    labels: [],
    dataByView: { labels: [], scores: [] },
    referenceByView: {},
  };
}

export function getDefaultEvaluationMetricsView(
  series: EvaluationMetricsSeries
): EvaluationMetricsView {
  // Prefer labels for mixed evaluations because a distribution exposes more
  // categorical detail than the aggregate score.
  return series.views.includes("labels") ? "labels" : "scores";
}

/**
 * Prepends a comparison point without duplicating it when it is already part
 * of the visible domain. Keeping this ordering outside the renderer makes the
 * baseline category invariant explicit and independently testable.
 */
export function getEvaluationMetricsChartData({
  data,
  reference,
}: {
  data: ReadonlyArray<EvaluationMetricsChartPoint>;
  reference?: EvaluationMetricsChartPoint;
}): ReadonlyArray<EvaluationMetricsChartPoint> {
  return reference == null
    ? data
    : [reference, ...data.filter(({ x }) => x !== reference.x)];
}

const OTHER_FRACTION_EPSILON = 1e-9;

/**
 * Returns the result-bearing share without a label. Missing labels are not
 * renormalized so each stacked distribution still totals 100%.
 */
export function getEvaluationOtherFraction({
  point,
}: {
  point: EvaluationMetricsChartPoint;
}): number | undefined {
  if (!point.hasAnnotationSummary) {
    return undefined;
  }
  const includedFraction = point.fractions.reduce<number>(
    (total, fraction) => total + (fraction ?? 0),
    0
  );
  const residual = Math.min(Math.max(1 - includedFraction, 0), 1);
  return residual < OTHER_FRACTION_EPSILON ? undefined : residual;
}

/**
 * Normalizes summary snapshots into one chart series per evaluation. Separate
 * score and label datasets let mixed evaluations switch views without putting
 * scores and percentages on the same axis.
 */
export function normalizeEvaluationMetrics({
  points,
  referencePoint,
  includeEmptyPoints = false,
}: {
  points: ReadonlyArray<EvaluationMetricsInputPoint>;
  referencePoint?: EvaluationMetricsInputPoint;
  /** Retain input categories that have no value for a supported view. */
  includeEmptyPoints?: boolean;
}): EvaluationMetricsSeries[] {
  const pointsWithSummariesByName = points.map((point) => ({
    point,
    summariesByName: new Map(
      point.summaries.map((summary) => [summary.name, summary])
    ),
  }));
  const referenceSummariesByName = new Map(
    referencePoint?.summaries.map((summary) => [summary.name, summary]) ?? []
  );
  const evaluationNames = new Set<string>();
  for (const { summariesByName } of pointsWithSummariesByName) {
    summariesByName.forEach((_, name) => evaluationNames.add(name));
  }

  return Array.from(evaluationNames)
    .sort((left, right) => left.localeCompare(right))
    .map((name): EvaluationMetricsSeries => {
      const summaryByPoint = pointsWithSummariesByName.map(
        ({ point, summariesByName }) => ({
          point,
          summary: summariesByName.get(name),
        })
      );
      // The reference is a comparison point, not part of the visible window
      // used to decide whether an evaluation offers label and/or score views.
      const referenceSummary = referenceSummariesByName.get(name);
      const latestSummary = summaryByPoint
        .slice()
        .reverse()
        .find(
          ({ summary }) => (summary?.labelFractions.length ?? 0) > 0
        )?.summary;
      // Individual summaries can have different labels, so build a stable
      // union starting with the baseline and latest comparison points.
      const labels = Array.from(
        new Set(
          [
            referenceSummary,
            latestSummary,
            ...summaryByPoint.map(({ summary }) => summary),
          ]
            .filter((summary): summary is EvaluationSummary => summary != null)
            .flatMap((summary) =>
              summary.labelFractions.map(({ label }) => label)
            )
        )
      );

      const makeScorePoint = ({
        point,
        summary,
      }: {
        point: EvaluationMetricsInputPoint;
        summary?: EvaluationSummary;
      }): EvaluationMetricsChartPoint => ({
        x: point.x,
        metadata: point.metadata ?? {},
        hasAnnotationSummary: summary != null,
        meanScore: summary?.meanScore ?? undefined,
        fractions: [],
      });
      const makeLabelPoint = ({
        point,
        summary,
      }: {
        point: EvaluationMetricsInputPoint;
        summary?: EvaluationSummary;
      }): EvaluationMetricsChartPoint => {
        const fractionsByLabel = new Map(
          (summary?.labelFractions ?? []).map(({ label, fraction }) => [
            label,
            fraction,
          ])
        );
        return {
          x: point.x,
          metadata: point.metadata ?? {},
          hasAnnotationSummary: summary != null,
          fractions: labels.map((label) => fractionsByLabel.get(label)),
        };
      };

      const hasScoreValues = summaryByPoint.some(
        ({ summary }) => summary?.meanScore != null
      );
      const hasLabelValues = summaryByPoint.some(
        ({ summary }) => (summary?.labelFractions.length ?? 0) > 0
      );
      // Category charts can opt into a shared domain. Missing values remain
      // undefined, so they reserve axis space without drawing empty bars.
      const scoreData = includeEmptyPoints
        ? summaryByPoint.map(makeScorePoint)
        : summaryByPoint.flatMap(({ point, summary }) =>
            summary?.meanScore == null
              ? []
              : [makeScorePoint({ point, summary })]
          );
      const labelData = includeEmptyPoints
        ? summaryByPoint.map(makeLabelPoint)
        : summaryByPoint.flatMap(({ point, summary }) =>
            summary == null ? [] : [makeLabelPoint({ point, summary })]
          );
      const views: EvaluationMetricsView[] = [];
      if (hasLabelValues) {
        views.push("labels");
      }
      if (hasScoreValues) {
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
            hasLabelValues &&
            referencePoint != null &&
            (includeEmptyPoints || referenceSummary != null)
              ? makeLabelPoint({
                  point: referencePoint,
                  summary: referenceSummary,
                })
              : undefined,
          scores:
            hasScoreValues &&
            referencePoint != null &&
            (includeEmptyPoints || referenceSummary?.meanScore != null)
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
