import {
  getAnnotationMetricsChartData,
  getAnnotationOtherFraction,
  getDefaultAnnotationMetricsView,
  normalizeAnnotationMetrics,
} from "../annotationMetricsUtils";

describe("normalizeAnnotationMetrics", () => {
  it("classifies annotation views over the entire visible window", () => {
    const series = normalizeAnnotationMetrics({
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

  it("builds one aligned dataset for a mixed annotation", () => {
    const [series] = normalizeAnnotationMetrics({
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
      labels: ["pass", "fail"],
    });
    expect(series.data.map(({ x, meanScore }) => ({ x, meanScore }))).toEqual([
      { x: 1, meanScore: 0.4 },
      { x: 2, meanScore: undefined },
      { x: 3, meanScore: 0.8 },
    ]);
    expect(series.data.map(({ x }) => x)).toEqual([1, 2, 3]);
    expect(series.data[0]?.fractions).toEqual([undefined, undefined]);
    expect(series.data[0]?.hasAnnotationSummary).toBe(true);
    expect(
      getAnnotationOtherFraction({
        point: series.data[0]!,
      })
    ).toBe(1);
    expect(series.data[1]?.fractions).toEqual([1, undefined]);
    expect(series.data[2]?.fractions).toEqual([0.75, 0.25]);
    expect(getDefaultAnnotationMetricsView(series)).toBe("labels");
  });

  it("preserves every visible point when an annotation is sparse", () => {
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
    const [labelSeries, scoreSeries] = normalizeAnnotationMetrics({
      points,
    });

    expect(scoreSeries.data.map(({ x }) => x)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(scoreSeries.data.map(({ meanScore }) => meanScore)).toEqual([
      undefined,
      undefined,
      undefined,
      0.75,
      undefined,
      undefined,
      undefined,
    ]);
    expect(labelSeries.data.map(({ x }) => x)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(labelSeries.data[3]?.fractions).toEqual([undefined]);
    expect(labelSeries.data[3]?.hasAnnotationSummary).toBe(false);
    expect(labelSeries.data[4]?.fractions).toEqual([1]);
    expect(labelSeries.data[4]?.hasAnnotationSummary).toBe(true);
  });

  it("prepends only an out-of-window baseline", () => {
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
    const dataWithOutsideBaseline = getAnnotationMetricsChartData({
      data,
      reference: baselineOutsideWindow,
    });

    expect(dataWithOutsideBaseline[0]).toBe(baselineOutsideWindow);
    expect(dataWithOutsideBaseline.map(({ x }) => x)).toEqual([
      1, 4, 5, 6, 7, 8, 9, 10,
    ]);
    const dataWithInWindowBaseline = getAnnotationMetricsChartData({
      data,
      reference: {
        x: 6,
        metadata: { isBaseline: true },
        hasAnnotationSummary: true,
        meanScore: 0.6,
        fractions: [],
      },
    });
    expect(dataWithInWindowBaseline).toBe(data);
    expect(dataWithInWindowBaseline.map(({ x }) => x)).toEqual([
      4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("aligns a label baseline without letting its score add a score view", () => {
    const [series] = normalizeAnnotationMetrics({
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
    expect(series.data[0]?.fractions).toEqual([undefined, 1]);
    expect(series.reference).toEqual({
      x: 1,
      metadata: { isBaseline: true },
      hasAnnotationSummary: true,
      meanScore: 0.4,
      fractions: [1, undefined],
    });
  });

  it("omits annotations with no chartable values", () => {
    const series = normalizeAnnotationMetrics({
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
});

describe("getAnnotationOtherFraction", () => {
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

  it.each([
    ["partially unlabeled results", [0.5, 0.25, 0.1], true, 0.15],
    ["entirely unlabeled results", [], true, 1],
    ["an empty chart category", [], false, undefined],
    ["a complete distribution", [0.6, 0.4], true, undefined],
    ["a floating-point residual", [0.6, 0.3999999995], true, undefined],
    ["an overfull distribution", [0.7, 0.5], true, undefined],
  ] as const)(
    "handles %s",
    (_, fractions, hasAnnotationSummary, expectedFraction) => {
      const fraction = getAnnotationOtherFraction({
        point: makePoint({ fractions, hasAnnotationSummary }),
      });
      if (expectedFraction == null) {
        expect(fraction).toBeUndefined();
      } else {
        expect(fraction).toBeCloseTo(expectedFraction);
      }
    }
  );
});
