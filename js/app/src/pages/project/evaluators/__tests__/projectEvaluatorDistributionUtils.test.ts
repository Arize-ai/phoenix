import { describe, expect, it } from "vitest";

import {
  formatScoreValue,
  getDistributionRows,
  getDistributionScope,
  getDistributionThresholdPosition,
  getDistributionView,
  getScoreRowOptimalities,
  orderLabelRowsByOptimality,
  type DistributionSide,
} from "../projectEvaluatorDistributionUtils";

const histogramSide: DistributionSide = {
  threshold: 0.5,
  evaluatedCount: 7,
  meanScore: 0.4,
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
      evaluatedCount: 3,
      meanScore: 0.5,
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
      evaluatedCount: 6,
      meanScore: null,
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

describe("orderLabelRowsByOptimality", () => {
  const rows = [
    { label: "hallucinated", score: 1, count: 6 },
    { label: "grounded", score: 0, count: 15 },
    { label: "unscored", score: null, count: 1 },
    { label: "Other labels (grouped)", isOther: true, count: 2 },
  ];

  it("puts the most optimal label first and Other last", () => {
    const ordered = orderLabelRowsByOptimality({
      rows,
      direction: "MINIMIZE",
    });
    expect(ordered.rows.map(({ label }) => label)).toEqual([
      "grounded",
      "hallucinated",
      "unscored",
      "Other labels (grouped)",
    ]);
    expect(ordered.optimalities).toEqual([1, 0, null, null]);
  });

  it("keeps the original order without a direction", () => {
    const ordered = orderLabelRowsByOptimality({ rows, direction: "NONE" });
    expect(ordered.rows).toEqual(rows);
    expect(ordered.optimalities).toBeNull();
  });
});

describe("getScoreRowOptimalities", () => {
  it("ranks exact scores along the direction without reordering", () => {
    const rows = [
      { label: "0", score: 0, count: 13 },
      { label: "1", score: 1, count: 5 },
    ];
    expect(getScoreRowOptimalities({ rows, direction: "MINIMIZE" })).toEqual([
      1, 0,
    ]);
    expect(getScoreRowOptimalities({ rows, direction: "MAXIMIZE" })).toEqual([
      0, 1,
    ]);
  });

  it("ranks histogram bins by midpoint", () => {
    const rows = [
      { label: "0–0.5", count: 1, lowerBound: 0, upperBound: 0.5 },
      { label: "0.5–1", count: 1, lowerBound: 0.5, upperBound: 1 },
    ];
    expect(getScoreRowOptimalities({ rows, direction: "MAXIMIZE" })).toEqual([
      0, 1,
    ]);
  });

  it("is null without a direction", () => {
    expect(
      getScoreRowOptimalities({
        rows: [{ label: "0", score: 0, count: 1 }],
        direction: "NONE",
      })
    ).toBeNull();
  });
});

describe("getDistributionScope", () => {
  it("defaults to overlap and honors a request for all", () => {
    expect(getDistributionScope({ requested: null, evaluatedByBoth: 3 })).toBe(
      "overlap"
    );
    expect(getDistributionScope({ requested: "all", evaluatedByBoth: 3 })).toBe(
      "all"
    );
  });

  it("falls back to all when nothing overlaps", () => {
    expect(
      getDistributionScope({ requested: "overlap", evaluatedByBoth: 0 })
    ).toBe("all");
  });
});

describe("formatScoreValue", () => {
  it("drops floating-point noise and padding zeros", () => {
    expect(formatScoreValue(65.74000000000001)).toBe("65.74");
    expect(formatScoreValue(110.68)).toBe("110.68");
    expect(formatScoreValue(1)).toBe("1");
    expect(formatScoreValue(0.5)).toBe("0.5");
    expect(formatScoreValue(0.333)).toBe("0.33");
    expect(formatScoreValue(0)).toBe("0");
  });

  it("keeps compact notation for very large and small values", () => {
    expect(formatScoreValue(2500)).toBe("2.5k");
    expect(formatScoreValue(0.005)).toBe("5.00e-3");
  });
});
