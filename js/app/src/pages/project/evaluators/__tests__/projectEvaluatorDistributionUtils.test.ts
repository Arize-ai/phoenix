import { describe, expect, it } from "vitest";

import {
  getDistributionRows,
  getDistributionThresholdPosition,
  getDistributionView,
  type DistributionSide,
} from "../projectEvaluatorDistributionUtils";

const histogramSide: DistributionSide = {
  threshold: 0.5,
  allEvaluatedMeanScore: 0.4,
  scoreBinEdges: [0, 0.5, 1],
  scoreBinCounts: [5, 2],
  scoreValueCounts: null,
  labelCounts: null,
};

describe("evaluator distribution chart data", () => {
  it("maps histogram arrays to single counts with precise interval inclusivity", () => {
    const rows = getDistributionRows({ side: histogramSide, view: "scores" });
    expect(rows.map(({ count }) => count)).toEqual([5, 2]);
    expect(rows.map(({ description }) => description)).toEqual([
      "0 ≤ score < 0.5",
      "0.5 ≤ score ≤ 1",
    ]);
    expect(getDistributionThresholdPosition({ rows, threshold: 0.5 })).toBe(
      0.5
    );
    expect(
      getDistributionThresholdPosition({ rows, threshold: -1 })
    ).toBeNull();
  });

  it("falls back from an unavailable URL view", () => {
    expect(
      getDistributionView({ side: histogramSide, requested: "labels" })
    ).toBe("scores");
  });

  it("keeps exact discrete scores and supports the label view independently", () => {
    const mixed: DistributionSide = {
      threshold: null,
      allEvaluatedMeanScore: 0.5,
      scoreBinEdges: null,
      scoreBinCounts: null,
      scoreValueCounts: [
        { score: 0, count: 1 },
        { score: 1, count: 1 },
      ],
      labelCounts: [
        { label: "Other labels", score: null, isOther: false, count: 1 },
        { label: "Other labels", score: null, isOther: true, count: 2 },
      ],
    };
    expect(getDistributionView({ side: mixed, requested: null })).toBe(
      "labels"
    );
    expect(getDistributionView({ side: mixed, requested: "scores" })).toBe(
      "scores"
    );
    expect(
      getDistributionRows({ side: mixed, view: "scores" }).map(
        ({ label }) => label
      )
    ).toEqual(["0", "1"]);
    expect(
      getDistributionRows({ side: mixed, view: "labels" }).map(
        ({ label }) => label
      )
    ).toEqual(["Other labels", "Other labels (grouped)"]);
  });

  it("renders label-only data without requiring scores", () => {
    const labels: DistributionSide = {
      threshold: null,
      allEvaluatedMeanScore: null,
      scoreBinEdges: null,
      scoreBinCounts: null,
      scoreValueCounts: null,
      labelCounts: [{ label: "pass", score: null, isOther: false, count: 6 }],
    };
    expect(getDistributionView({ side: labels, requested: "scores" })).toBe(
      "labels"
    );
    expect(getDistributionRows({ side: labels, view: "labels" })).toEqual(
      labels.labelCounts
    );
  });
});
