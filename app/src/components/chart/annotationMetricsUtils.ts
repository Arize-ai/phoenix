export type AnnotationMetricsView = "labels" | "scores";

export type AnnotationSummary = {
  readonly name: string;
  readonly meanScore: number | null;
  readonly labelFractions: ReadonlyArray<{
    readonly label: string;
    readonly fraction: number;
  }>;
};

export type AnnotationMetricsInputPoint = {
  readonly x: number;
  readonly metadata?: Readonly<
    Record<string, string | number | boolean | null>
  >;
  readonly summaries: ReadonlyArray<AnnotationSummary>;
};

export type AnnotationMetricsChartPoint = {
  readonly x: number;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
  /** Distinguishes an empty axis category from a summary with no labels. */
  readonly hasAnnotationSummary: boolean;
  readonly meanScore?: number;
  readonly fractions: ReadonlyArray<number | undefined>;
};

export type AnnotationMetricsSeries = {
  readonly name: string;
  readonly views: ReadonlyArray<AnnotationMetricsView>;
  readonly labels: ReadonlyArray<string>;
  readonly data: ReadonlyArray<AnnotationMetricsChartPoint>;
  readonly reference?: AnnotationMetricsChartPoint;
};

export function getEmptyAnnotationMetricsSeries(
  name: string
): AnnotationMetricsSeries {
  return {
    name,
    views: [],
    labels: [],
    data: [],
  };
}

export function getDefaultAnnotationMetricsView(
  series: AnnotationMetricsSeries
): AnnotationMetricsView {
  // Prefer labels for mixed annotations because a distribution exposes more
  // categorical detail than the aggregate score.
  return series.views.includes("labels") ? "labels" : "scores";
}

/**
 * Prepends a comparison point without duplicating it when it is already part
 * of the visible domain. Keeping this ordering outside the renderer makes the
 * baseline category invariant explicit and independently testable.
 */
export function getAnnotationMetricsChartData({
  data,
  reference,
}: {
  data: ReadonlyArray<AnnotationMetricsChartPoint>;
  reference?: AnnotationMetricsChartPoint;
}): ReadonlyArray<AnnotationMetricsChartPoint> {
  if (reference == null || data.some(({ x }) => x === reference.x)) {
    return data;
  }
  return [reference, ...data];
}

const OTHER_FRACTION_EPSILON = 1e-9;

/**
 * Returns the result-bearing share without a label. Missing labels are not
 * renormalized so each stacked distribution still totals 100%.
 */
export function getAnnotationOtherFraction({
  point,
}: {
  point: AnnotationMetricsChartPoint;
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
 * Normalizes summary snapshots into one aligned chart series per annotation.
 * Mixed annotations select which values to render without changing the shared
 * x-axis categories.
 */
export function normalizeAnnotationMetrics({
  points,
  referencePoint,
}: {
  points: ReadonlyArray<AnnotationMetricsInputPoint>;
  referencePoint?: AnnotationMetricsInputPoint;
}): AnnotationMetricsSeries[] {
  const pointsWithSummariesByName = points.map((point) => ({
    point,
    summariesByName: new Map(
      point.summaries.map((summary) => [summary.name, summary])
    ),
  }));
  const referenceSummariesByName = new Map(
    referencePoint?.summaries.map((summary) => [summary.name, summary]) ?? []
  );
  const annotationNames = new Set<string>();
  for (const { summariesByName } of pointsWithSummariesByName) {
    summariesByName.forEach((_, name) => annotationNames.add(name));
  }

  return Array.from(annotationNames)
    .sort((left, right) => left.localeCompare(right))
    .map((name): AnnotationMetricsSeries => {
      const summaryByPoint = pointsWithSummariesByName.map(
        ({ point, summariesByName }) => ({
          point,
          summary: summariesByName.get(name),
        })
      );
      // The reference is a comparison point, not part of the visible window
      // used to decide whether an annotation offers label and/or score views.
      const referenceSummary = referenceSummariesByName.get(name);
      // Individual summaries can have different labels, so build a stable
      // union in baseline-then-chronological order.
      const labels = Array.from(
        new Set(
          [referenceSummary, ...summaryByPoint.map(({ summary }) => summary)]
            .filter((summary): summary is AnnotationSummary => summary != null)
            .flatMap((summary) =>
              summary.labelFractions.map(({ label }) => label)
            )
        )
      );

      const makeChartPoint = ({
        point,
        summary,
      }: {
        point: AnnotationMetricsInputPoint;
        summary?: AnnotationSummary;
      }): AnnotationMetricsChartPoint => {
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
          meanScore: summary?.meanScore ?? undefined,
          fractions: labels.map((label) => fractionsByLabel.get(label)),
        };
      };

      const hasScoreValues = summaryByPoint.some(
        ({ summary }) => summary?.meanScore != null
      );
      const hasLabelValues = summaryByPoint.some(
        ({ summary }) => (summary?.labelFractions.length ?? 0) > 0
      );
      const views: AnnotationMetricsView[] = [];
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
        data: summaryByPoint.map(makeChartPoint),
        reference:
          referencePoint == null
            ? undefined
            : makeChartPoint({
                point: referencePoint,
                summary: referenceSummary,
              }),
      };
    })
    .filter(({ views }) => views.length > 0);
}
