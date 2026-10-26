import {
  calculateAnnotationScorePercentile,
  compareAnnotationMeanScores,
} from "../utils";

describe("calculateAnnotationScorePercentile", () => {
  describe("with default min/max (0 to 1 range)", () => {
    it("returns 0 for value of 0", () => {
      expect(calculateAnnotationScorePercentile(0)).toEqual(0);
    });

    it("returns 50 for value of 0.5", () => {
      expect(calculateAnnotationScorePercentile(0.5)).toEqual(50);
    });

    it("returns 100 for value of 1", () => {
      expect(calculateAnnotationScorePercentile(1)).toEqual(100);
    });
  });

  describe("with explicit min/max", () => {
    it("calculates percentile correctly for custom range", () => {
      expect(calculateAnnotationScorePercentile(5, 0, 10)).toEqual(50);
      expect(calculateAnnotationScorePercentile(0, 0, 10)).toEqual(0);
      expect(calculateAnnotationScorePercentile(10, 0, 10)).toEqual(100);
    });

    it("handles negative ranges", () => {
      expect(calculateAnnotationScorePercentile(0, -10, 10)).toEqual(50);
      expect(calculateAnnotationScorePercentile(-10, -10, 10)).toEqual(0);
      expect(calculateAnnotationScorePercentile(10, -10, 10)).toEqual(100);
    });

    it("handles ranges not starting at 0", () => {
      expect(calculateAnnotationScorePercentile(75, 50, 100)).toEqual(50);
      expect(calculateAnnotationScorePercentile(50, 50, 100)).toEqual(0);
      expect(calculateAnnotationScorePercentile(100, 50, 100)).toEqual(100);
    });
  });

  describe("with null min/max values", () => {
    it("uses default min of 0 when min is null", () => {
      expect(calculateAnnotationScorePercentile(0.5, null, 1)).toEqual(50);
    });

    it("uses default max of 1 when max is null", () => {
      expect(calculateAnnotationScorePercentile(0.5, 0, null)).toEqual(50);
    });

    it("uses default range when both are null", () => {
      expect(calculateAnnotationScorePercentile(0.5, null, null)).toEqual(50);
    });
  });

  describe("edge cases", () => {
    it("returns 0 when min === max === value === 0", () => {
      expect(calculateAnnotationScorePercentile(0, 0, 0)).toEqual(0);
    });

    it("returns 100 when min === max === value and value is non-zero", () => {
      expect(calculateAnnotationScorePercentile(1, 1, 1)).toEqual(100);
      expect(calculateAnnotationScorePercentile(5, 5, 5)).toEqual(100);
      expect(calculateAnnotationScorePercentile(-1, -1, -1)).toEqual(100);
    });
  });
});

describe("compareAnnotationMeanScores", () => {
  const baseExperiment = {
    annotationSummaries: [
      { annotationName: "correctness", meanScore: 0.75 },
      { annotationName: "unscored", meanScore: null },
    ],
  };

  it("keeps every scored base annotation when no experiments are compared", () => {
    expect(compareAnnotationMeanScores(baseExperiment, [])).toEqual([
      {
        annotationName: "correctness",
        baseExperimentMeanScore: 0.75,
        compareExperimentMeanScores: [],
      },
    ]);
  });

  it("pairs each compare experiment's score, null where the annotation is missing", () => {
    const compareExperiments = [
      {
        id: "exp-2",
        annotationSummaries: [
          { annotationName: "correctness", meanScore: 0.5 },
        ],
      },
      {
        id: "exp-3",
        annotationSummaries: [{ annotationName: "other", meanScore: 1 }],
      },
    ];
    expect(
      compareAnnotationMeanScores(baseExperiment, compareExperiments)
    ).toEqual([
      {
        annotationName: "correctness",
        baseExperimentMeanScore: 0.75,
        compareExperimentMeanScores: [
          { experimentId: "exp-2", meanScore: 0.5 },
          { experimentId: "exp-3", meanScore: null },
        ],
      },
    ]);
  });

  it("drops annotations that only compare experiments have", () => {
    const compareExperiments = [
      {
        id: "exp-2",
        annotationSummaries: [{ annotationName: "other", meanScore: 1 }],
      },
    ];
    expect(
      compareAnnotationMeanScores(baseExperiment, compareExperiments).map(
        (comparison) => comparison.annotationName
      )
    ).toEqual(["correctness"]);
  });
});
