import { formatEvaluationFraction } from "../EvaluationMetricsChart";
import {
  getDefaultEvaluationMetricsView,
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
    expect(series.dataByView.labels.map(({ x }) => x)).toEqual([2, 3]);
    expect(series.dataByView.labels[0]?.fractions).toEqual([undefined, 1]);
    expect(series.dataByView.labels[1]).toEqual({
      x: 3,
      metadata: { experimentName: "third" },
      fractions: [0.25, 0.75],
    });
    expect(series.dataByView.scores[1]).toEqual({
      x: 3,
      metadata: { experimentName: "third" },
      meanScore: 0.8,
      fractions: [],
    });
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
        fractions: [1, undefined],
      },
      scores: undefined,
    });
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
