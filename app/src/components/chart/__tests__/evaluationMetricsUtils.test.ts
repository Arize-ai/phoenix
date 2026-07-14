import { formatEvaluationFraction } from "../EvaluationMetricsChart";
import {
  deriveUnlabeledFraction,
  normalizeEvaluationMetrics,
} from "../evaluationMetricsUtils";

describe("formatEvaluationFraction", () => {
  it("formats a unit fraction as a percentage", () => {
    expect(formatEvaluationFraction(0)).toBe("0.00%");
    expect(formatEvaluationFraction(0.25)).toBe("25.00%");
    expect(formatEvaluationFraction(1)).toBe("100.00%");
  });
});

describe("deriveUnlabeledFraction", () => {
  it("derives and clamps the residual outside the labeled fractions", () => {
    expect(deriveUnlabeledFraction([])).toBe(1);
    expect(
      deriveUnlabeledFraction([{ fraction: 0.25 }, { fraction: 0.5 }])
    ).toBe(0.25);
    expect(deriveUnlabeledFraction([{ fraction: -0.1 }])).toBe(1);
    expect(deriveUnlabeledFraction([{ fraction: 1.1 }])).toBeUndefined();
  });

  it("suppresses only floating-point-sized residuals", () => {
    expect(
      deriveUnlabeledFraction([{ fraction: 0.6 }, { fraction: 0.4 }])
    ).toBeUndefined();
    expect(
      deriveUnlabeledFraction([{ fraction: 1 - Number.EPSILON }])
    ).toBeUndefined();
  });
});

describe("normalizeEvaluationMetrics", () => {
  it("classifies evaluation shape over the entire visible window", () => {
    const series = normalizeEvaluationMetrics({
      points: [
        {
          x: 1,
          summaries: [
            { name: "mixed", meanScore: 0.4, labelFractions: [] },
            { name: "scores", meanScore: 0.7, labelFractions: [] },
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
    expect(
      series.map(({ hasLabels, hasScores }) => ({ hasLabels, hasScores }))
    ).toEqual([
      { hasLabels: true, hasScores: false },
      { hasLabels: true, hasScores: true },
      { hasLabels: false, hasScores: true },
    ]);
  });

  it("combines a label distribution and mean scores in one mixed series", () => {
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
                { label: "pass", fraction: 0.5 },
              ],
            },
          ],
        },
      ],
    });

    expect(series).toMatchObject({
      name: "quality",
      hasLabels: true,
      hasScores: true,
      hasUnlabeled: true,
      labels: ["fail", "pass"],
    });
    expect(series?.data).toEqual([
      {
        x: 1,
        metadata: {},
        meanScore: 0.4,
        fractions: [undefined, undefined],
        unlabeledFraction: 1,
      },
      {
        x: 2,
        metadata: {},
        meanScore: undefined,
        fractions: [undefined, 1],
        unlabeledFraction: undefined,
      },
      {
        x: 3,
        metadata: { experimentName: "third" },
        meanScore: 0.8,
        fractions: [0.25, 0.5],
        unlabeledFraction: 0.25,
      },
    ]);
  });

  it("treats a no-label summary as unlabeled once the window has a label", () => {
    const [series] = normalizeEvaluationMetrics({
      points: [
        {
          x: 1,
          summaries: [{ name: "quality", meanScore: null, labelFractions: [] }],
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
      ],
    });

    expect(series?.data[0]).toMatchObject({
      fractions: [undefined],
      unlabeledFraction: 1,
    });
  });

  it("aligns a distribution baseline without letting its score change the visible shape", () => {
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
            labelFractions: [{ label: "fail", fraction: 0.75 }],
          },
        ],
      },
    });

    expect(series).toMatchObject({
      hasLabels: true,
      hasScores: false,
      hasUnlabeled: true,
      labels: ["fail", "pass"],
      reference: {
        x: 1,
        metadata: { isBaseline: true },
        meanScore: undefined,
        fractions: [0.75, undefined],
        unlabeledFraction: 0.25,
      },
    });
  });

  it("does not add an unlabeled category to score-only evaluations", () => {
    const [series] = normalizeEvaluationMetrics({
      points: [
        {
          x: 1,
          summaries: [{ name: "quality", meanScore: 0.01, labelFractions: [] }],
        },
      ],
    });

    expect(series).toMatchObject({
      hasLabels: false,
      hasScores: true,
      hasUnlabeled: false,
      labels: [],
      data: [{ meanScore: 0.01, unlabeledFraction: undefined }],
    });
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
