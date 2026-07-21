import { formatEvaluationFraction } from "../EvaluationMetricsChart";
import {
  getDefaultEvaluationMetricsView,
  getEvaluationMetricsChartData,
  getEvaluationOtherFraction,
  normalizeEvaluationMetrics,
} from "../evaluationMetricsUtils";

describe("formatEvaluationFraction", () => {
  it("formats a unit fraction as a percentage", () => {
    expect(formatEvaluationFraction(0)).toBe("0.00%");
    expect(formatEvaluationFraction(0.25)).toBe("25.00%");
    expect(formatEvaluationFraction(1)).toBe("100.00%");
  });
});

describe("normalizeEvaluationMetrics", () => {
  it("classifies evaluation views over the entire visible window", () => {
    const series = normalizeEvaluationMetrics({
      points: [
        {
          x: 1,
          summaries: [
            {
              name: "mixed",
              meanScore: 0.4,
              labelFractions: [],
            },
            {
              name: "scores",
              meanScore: 0.7,
              labelFractions: [],
            },
          ],
        },
        {
          x: 2,
          summaries: [
            {
              name: "labels",
              meanScore: null,
              labelFractions: [{ label: "pass", fraction: 1 }],
            },
            {
              name: "mixed",
              meanScore: null,
              labelFractions: [{ label: "pass", fraction: 1 }],
            },
          ],
        },
      ],
    });

    expect(series.map(({ name }) => name)).toEqual([
      "labels",
      "mixed",
      "scores",
    ]);
    expect(series.map(({ views }) => views)).toEqual([
      ["labels"],
      ["labels", "scores"],
      ["scores"],
    ]);
  });

  it("builds independent datasets for a mixed evaluation", () => {
    const [series] = normalizeEvaluationMetrics({
      points: [
        {
          x: 1,
          summaries: [{ name: "quality", meanScore: 0.4, labelFractions: [] }],
        },
        {
          x: 2,
          summaries: [
            {
              name: "quality",
              meanScore: null,
              labelFractions: [{ label: "pass", fraction: 1 }],
            },
          ],
        },
        {
          x: 3,
          metadata: { experimentName: "third" },
          summaries: [
            {
              name: "quality",
              meanScore: 0.8,
              labelFractions: [
                { label: "fail", fraction: 0.25 },
                { label: "pass", fraction: 0.75 },
              ],
            },
          ],
        },
      ],
    });

    expect(series).toMatchObject({
      name: "quality",
      views: ["labels", "scores"],
      labels: ["fail", "pass"],
    });
    expect(series.dataByView.scores.map(({ x }) => x)).toEqual([1, 3]);
    expect(series.dataByView.labels.map(({ x }) => x)).toEqual([1, 2, 3]);
    expect(series.dataByView.labels[0]?.fractions).toEqual([
      undefined,
      undefined,
    ]);
    expect(series.dataByView.labels[0]?.hasAnnotationSummary).toBe(true);
    expect(
      getEvaluationOtherFraction({
        point: series.dataByView.labels[0]!,
      })
    ).toBe(1);
    expect(series.dataByView.labels[1]?.fractions).toEqual([undefined, 1]);
    expect(series.dataByView.labels[2]).toEqual({
      x: 3,
      metadata: { experimentName: "third" },
      hasAnnotationSummary: true,
      fractions: [0.25, 0.75],
    });
    expect(series.dataByView.scores[1]).toEqual({
      x: 3,
      metadata: { experimentName: "third" },
      hasAnnotationSummary: true,
      meanScore: 0.8,
      fractions: [],
    });
  });

  it("preserves every visible point when an evaluation is sparse", () => {
    const points = Array.from({ length: 7 }, (_, index) => ({
      x: index + 4,
      metadata: { experimentName: `experiment-${index + 4}` },
      summaries: [
        ...(index === 3
          ? [
              {
                name: "quality-score",
                meanScore: 0.75,
                labelFractions: [] as const,
              },
            ]
          : []),
        ...(index === 4
          ? [
              {
                name: "quality-label",
                meanScore: null,
                labelFractions: [{ label: "pass", fraction: 1 }] as const,
              },
            ]
          : []),
      ],
    }));
    const [labelSeries, scoreSeries] = normalizeEvaluationMetrics({
      points,
      includeEmptyPoints: true,
    });

    expect(scoreSeries.dataByView.scores.map(({ x }) => x)).toEqual([
      4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(
      scoreSeries.dataByView.scores.map(({ meanScore }) => meanScore)
    ).toEqual([
      undefined,
      undefined,
      undefined,
      0.75,
      undefined,
      undefined,
      undefined,
    ]);
    expect(labelSeries.dataByView.labels.map(({ x }) => x)).toEqual([
      4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(labelSeries.dataByView.labels[3]?.fractions).toEqual([undefined]);
    expect(labelSeries.dataByView.labels[3]?.hasAnnotationSummary).toBe(false);
    expect(labelSeries.dataByView.labels[4]?.fractions).toEqual([1]);
    expect(labelSeries.dataByView.labels[4]?.hasAnnotationSummary).toBe(true);
  });

  it("keeps an empty baseline reference outside the visible window", () => {
    const [series] = normalizeEvaluationMetrics({
      points: [
        {
          x: 4,
          summaries: [{ name: "quality", meanScore: 0.75, labelFractions: [] }],
        },
      ],
      referencePoint: {
        x: 1,
        metadata: { isBaseline: true },
        summaries: [],
      },
      includeEmptyPoints: true,
    });

    expect(series.referenceByView.scores).toEqual({
      x: 1,
      metadata: { isBaseline: true },
      hasAnnotationSummary: false,
      meanScore: undefined,
      fractions: [],
    });
  });

  it("prepends a baseline bar without duplicating its visible experiment", () => {
    const data = [4, 5, 6, 7, 8, 9, 10].map((x) => ({
      x,
      metadata: {},
      hasAnnotationSummary: true,
      meanScore: x / 10,
      fractions: [],
    }));
    const baselineOutsideWindow = {
      x: 1,
      metadata: { isBaseline: true },
      hasAnnotationSummary: true,
      meanScore: 0.25,
      fractions: [],
    };
    const dataWithOutsideBaseline = getEvaluationMetricsChartData({
      data,
      reference: baselineOutsideWindow,
    });

    expect(dataWithOutsideBaseline[0]).toBe(baselineOutsideWindow);
    expect(dataWithOutsideBaseline.map(({ x }) => x)).toEqual([
      1, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(
      getEvaluationMetricsChartData({
        data,
        reference: {
          x: 6,
          metadata: { isBaseline: true },
          hasAnnotationSummary: true,
          meanScore: 0.6,
          fractions: [],
        },
      }).map(({ x }) => x)
    ).toEqual([6, 4, 5, 7, 8, 9, 10]);
  });

  it("aligns a label baseline without letting its score add a score view", () => {
    const [series] = normalizeEvaluationMetrics({
      points: [
        {
          x: 4,
          summaries: [
            {
              name: "quality",
              meanScore: null,
              labelFractions: [{ label: "pass", fraction: 1 }],
            },
          ],
        },
      ],
      referencePoint: {
        x: 1,
        metadata: { isBaseline: true },
        summaries: [
          {
            name: "quality",
            meanScore: 0.4,
            labelFractions: [{ label: "fail", fraction: 1 }],
          },
        ],
      },
    });

    expect(series.views).toEqual(["labels"]);
    expect(series.labels).toEqual(["fail", "pass"]);
    expect(series.dataByView.labels[0]?.fractions).toEqual([undefined, 1]);
    expect(series.referenceByView).toEqual({
      labels: {
        x: 1,
        metadata: { isBaseline: true },
        hasAnnotationSummary: true,
        fractions: [1, undefined],
      },
      scores: undefined,
    });
  });

  it("preserves latest-point label ranking when there is no baseline", () => {
    const [series] = normalizeEvaluationMetrics({
      points: [
        {
          x: 1,
          summaries: [
            {
              name: "quality",
              meanScore: null,
              labelFractions: [
                { label: "old-only", fraction: 0.5 },
                { label: "shared", fraction: 0.5 },
              ],
            },
          ],
        },
        {
          x: 2,
          summaries: [
            {
              name: "quality",
              meanScore: null,
              labelFractions: [
                { label: "latest-first", fraction: 0.75 },
                { label: "shared", fraction: 0.25 },
              ],
            },
          ],
        },
      ],
    });

    expect(series.labels).toEqual(["latest-first", "shared", "old-only"]);
  });

  it("defaults mixed evaluations to labels", () => {
    const [series] = normalizeEvaluationMetrics({
      points: [
        {
          x: 1,
          summaries: [
            {
              name: "quality",
              meanScore: 0.5,
              labelFractions: [{ label: "pass", fraction: 1 }],
            },
          ],
        },
      ],
    });

    expect(getDefaultEvaluationMetricsView(series!)).toBe("labels");
  });

  it("omits evaluations with no chartable values", () => {
    const series = normalizeEvaluationMetrics({
      points: [
        {
          x: 1,
          summaries: [
            {
              name: "explanation-only",
              meanScore: null,
              labelFractions: [],
            },
          ],
        },
      ],
    });

    expect(series).toEqual([]);
  });

  it("returns no series when the window has no summaries", () => {
    expect(
      normalizeEvaluationMetrics({ points: [{ x: 1, summaries: [] }] })
    ).toEqual([]);
  });
});

describe("getEvaluationOtherFraction", () => {
  const makePoint = ({
    fractions,
    hasAnnotationSummary = true,
  }: {
    fractions: ReadonlyArray<number | undefined>;
    hasAnnotationSummary?: boolean;
  }) => ({
    x: 1,
    metadata: {},
    hasAnnotationSummary,
    fractions,
  });

  it("returns the fraction of results without labels", () => {
    const point = makePoint({ fractions: [0.5, 0.25, 0.1] });

    expect(getEvaluationOtherFraction({ point })).toBeCloseTo(0.15);
  });

  it("treats a result-bearing summary without labels as entirely other", () => {
    expect(
      getEvaluationOtherFraction({
        point: makePoint({ fractions: [] }),
      })
    ).toBe(1);
  });

  it("does not invent an other bar for an empty chart category", () => {
    expect(
      getEvaluationOtherFraction({
        point: makePoint({
          fractions: [],
          hasAnnotationSummary: false,
        }),
      })
    ).toBeUndefined();
  });

  it("suppresses zero and floating-point residuals", () => {
    expect(
      getEvaluationOtherFraction({
        point: makePoint({ fractions: [0.6, 0.4] }),
      })
    ).toBeUndefined();
    expect(
      getEvaluationOtherFraction({
        point: makePoint({ fractions: [0.6, 0.3999999995] }),
      })
    ).toBeUndefined();
    expect(
      getEvaluationOtherFraction({
        point: makePoint({ fractions: [0.7, 0.5] }),
      })
    ).toBeUndefined();
  });
});
