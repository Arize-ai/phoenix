import { formatEvaluationFraction } from "../EvaluationMetricsChart";
import {
  SCORE_ONLY_LABEL,
  deriveScoreOnlyFraction,
  normalizeEvaluationMetrics,
} from "../evaluationMetricsUtils";

describe("formatEvaluationFraction", () => {
  it("formats a unit fraction as a percentage", () => {
    expect(formatEvaluationFraction(0)).toBe("0.00%");
    expect(formatEvaluationFraction(0.25)).toBe("25.00%");
    expect(formatEvaluationFraction(1)).toBe("100.00%");
  });
});

describe("deriveScoreOnlyFraction", () => {
  it("derives and clamps the unlabeled result fraction", () => {
    expect(
      deriveScoreOnlyFraction([{ fraction: 0.5 }, { fraction: 0.25 }])
    ).toBeCloseTo(0.25);
    expect(deriveScoreOnlyFraction([{ fraction: 1.1 }])).toBeUndefined();
    expect(deriveScoreOnlyFraction([{ fraction: -0.2 }])).toEqual(1);
  });

  it("suppresses only residuals below the floating-point epsilon", () => {
    expect(deriveScoreOnlyFraction([{ fraction: 1 - 0.5e-9 }])).toBeUndefined();
    expect(deriveScoreOnlyFraction([{ fraction: 1 - 2e-9 }])).toBeCloseTo(2e-9);
  });
});

describe("normalizeEvaluationMetrics", () => {
  it("classifies evaluation shape over the entire window", () => {
    const series = normalizeEvaluationMetrics([
      {
        x: 1,
        summaries: [
          {
            name: "mixed",
            count: 2,
            scoreCount: 2,
            labelCount: 0,
            meanScore: 0.4,
            labelFractions: [],
          },
          {
            name: "scores",
            count: 1,
            scoreCount: 1,
            labelCount: 0,
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
            count: 1,
            scoreCount: 0,
            labelCount: 1,
            meanScore: null,
            labelFractions: [{ label: "pass", fraction: 1 }],
          },
          {
            name: "mixed",
            count: 1,
            scoreCount: 0,
            labelCount: 1,
            meanScore: null,
            labelFractions: [{ label: "pass", fraction: 1 }],
          },
        ],
      },
    ]);

    expect(series.map(({ name }) => name)).toEqual([
      "labels",
      "mixed",
      "scores",
    ]);
    expect(
      series.map(({ hasScores, hasLabels }) => [hasScores, hasLabels])
    ).toEqual([
      [false, true],
      [true, true],
      [true, false],
    ]);
  });

  it("constructs mixed score and distribution values with coverage", () => {
    const [series] = normalizeEvaluationMetrics([
      {
        x: 7,
        metadata: { experimentName: "seventh", isBaseline: true },
        summaries: [
          {
            name: "quality",
            count: 4,
            scoreCount: 3,
            labelCount: 3,
            meanScore: 0.6,
            labelFractions: [
              { label: "pass", fraction: 0.5 },
              { label: "fail", fraction: 0.25 },
            ],
          },
        ],
      },
    ]);

    expect(series).toMatchObject({
      name: "quality",
      hasScores: true,
      hasLabels: true,
      labels: ["fail", "pass", SCORE_ONLY_LABEL],
    });
    expect(series.data[0]).toEqual({
      x: 7,
      metadata: { experimentName: "seventh", isBaseline: true },
      meanScore: 0.6,
      count: 4,
      scoreCount: 3,
      labelCount: 3,
      fractions: [0.25, 0.5, 0.25],
    });
  });

  it("returns no series when the window has no summaries", () => {
    expect(normalizeEvaluationMetrics([{ x: 1, summaries: [] }])).toEqual([]);
  });

  it("omits evaluations with no chartable values", () => {
    const series = normalizeEvaluationMetrics([
      {
        x: 1,
        summaries: [
          {
            name: "explanation-only",
            count: 0,
            scoreCount: 0,
            labelCount: 0,
            meanScore: null,
            labelFractions: [],
          },
        ],
      },
    ]);

    expect(series).toEqual([]);
  });
});
