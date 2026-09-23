import {
  computeConfusionMatrix,
  createConfusionMatrixDensityScale,
  getConfusionQuadrantLabels,
} from "../confusionMatrix/confusionMatrixUtils";

describe("computeConfusionMatrix", () => {
  const data = [
    { actual: "hallucinated", predicted: "hallucinated", count: 94 },
    { actual: "hallucinated", predicted: "factual", count: 34 },
    { actual: "factual", predicted: "hallucinated", count: 41 },
    { actual: "factual", predicted: "factual", count: 1078 },
  ];

  it("pivots flat records into a matrix with totals", () => {
    const matrix = computeConfusionMatrix({ data });
    expect(matrix.actualLabels).toEqual(["hallucinated", "factual"]);
    expect(matrix.predictedLabels).toEqual(["hallucinated", "factual"]);
    expect(matrix.counts).toEqual([
      [94, 34],
      [41, 1078],
    ]);
    expect(matrix.rowTotals).toEqual([128, 1119]);
    expect(matrix.columnTotals).toEqual([135, 1112]);
    expect(matrix.total).toBe(1247);
    expect(matrix.maxCount).toBe(1078);
  });

  it("derives independent label sets per axis in first-seen order", () => {
    const matrix = computeConfusionMatrix({
      data: [
        { actual: "b", predicted: "unparseable", count: 1 },
        { actual: "a", predicted: "a", count: 2 },
        { actual: "b", predicted: "b", count: 3 },
      ],
    });
    expect(matrix.actualLabels).toEqual(["b", "a"]);
    expect(matrix.predictedLabels).toEqual(["unparseable", "a", "b"]);
    expect(matrix.counts).toEqual([
      [1, 0, 3],
      [0, 2, 0],
    ]);
  });

  it("honors explicit labels for membership and order, zero-filling missing pairs", () => {
    const matrix = computeConfusionMatrix({
      data,
      actualLabels: ["factual", "hallucinated"],
      predictedLabels: ["factual", "hallucinated", "unparseable"],
    });
    expect(matrix.counts).toEqual([
      [1078, 41, 0],
      [34, 94, 0],
    ]);
    expect(matrix.columnTotals).toEqual([1112, 135, 0]);
  });

  it("collapses duplicate explicit labels to their first occurrence", () => {
    const matrix = computeConfusionMatrix({
      data: [{ actual: "a", predicted: "a", count: 3 }],
      actualLabels: ["a", "a"],
      predictedLabels: ["a", "b", "a"],
    });
    expect(matrix.actualLabels).toEqual(["a"]);
    expect(matrix.predictedLabels).toEqual(["a", "b"]);
    expect(matrix.counts).toEqual([[3, 0]]);
  });

  it("drops data outside explicit labels and accumulates duplicate pairs", () => {
    const matrix = computeConfusionMatrix({
      data: [
        { actual: "a", predicted: "a", count: 1 },
        { actual: "a", predicted: "a", count: 2 },
        { actual: "rogue", predicted: "a", count: 100 },
      ],
      actualLabels: ["a"],
      predictedLabels: ["a"],
    });
    expect(matrix.counts).toEqual([[3]]);
    expect(matrix.total).toBe(3);
  });
});

describe("createConfusionMatrixDensityScale", () => {
  it("maps zero counts and empty scales to zero", () => {
    const logScale = createConfusionMatrixDensityScale({
      maxCount: 10,
      scaleType: "log",
    });
    expect(logScale(0)).toBe(0);
    const emptyScale = createConfusionMatrixDensityScale({
      maxCount: 0,
      scaleType: "linear",
    });
    expect(emptyScale(5)).toBe(0);
  });

  it("maps the max count to 1 on both scales", () => {
    expect(
      createConfusionMatrixDensityScale({ maxCount: 10, scaleType: "log" })(10)
    ).toBe(1);
    expect(
      createConfusionMatrixDensityScale({ maxCount: 10, scaleType: "linear" })(
        10
      )
    ).toBe(1);
  });

  it("clamps to 1 when the count exceeds a pinned maxCount on both scales", () => {
    expect(
      createConfusionMatrixDensityScale({ maxCount: 100, scaleType: "log" })(
        500
      )
    ).toBe(1);
    expect(
      createConfusionMatrixDensityScale({ maxCount: 100, scaleType: "linear" })(
        500
      )
    ).toBe(1);
  });

  it("keeps sparse cells more visible on the log scale", () => {
    const log = createConfusionMatrixDensityScale({
      maxCount: 1000,
      scaleType: "log",
    })(10);
    const linear = createConfusionMatrixDensityScale({
      maxCount: 1000,
      scaleType: "linear",
    })(10);
    expect(log).toBeGreaterThan(linear);
    expect(log).toBeGreaterThan(0.3);
    expect(linear).toBe(0.01);
  });
});

describe("getConfusionQuadrantLabels", () => {
  it("tags cells by the positive label's position on each axis", () => {
    expect(
      getConfusionQuadrantLabels({
        actualLabels: ["hallucinated", "factual"],
        predictedLabels: ["hallucinated", "factual"],
        positiveLabel: "hallucinated",
      })
    ).toEqual([
      ["TP", "FN"],
      ["FP", "TN"],
    ]);
  });

  it("is independent of axis order", () => {
    expect(
      getConfusionQuadrantLabels({
        actualLabels: ["factual", "hallucinated"],
        predictedLabels: ["hallucinated", "factual"],
        positiveLabel: "hallucinated",
      })
    ).toEqual([
      ["FP", "TN"],
      ["TP", "FN"],
    ]);
  });

  it("returns null for multiclass or mismatched label sets", () => {
    expect(
      getConfusionQuadrantLabels({
        actualLabels: ["a", "b", "c"],
        predictedLabels: ["a", "b", "c"],
        positiveLabel: "a",
      })
    ).toBeNull();
    expect(
      getConfusionQuadrantLabels({
        actualLabels: ["a", "b"],
        predictedLabels: ["a", "c"],
        positiveLabel: "a",
      })
    ).toBeNull();
  });

  it("returns null when the positive label is missing from an axis", () => {
    expect(
      getConfusionQuadrantLabels({
        actualLabels: ["a", "b"],
        predictedLabels: ["a", "b"],
        positiveLabel: "c",
      })
    ).toBeNull();
  });
});
