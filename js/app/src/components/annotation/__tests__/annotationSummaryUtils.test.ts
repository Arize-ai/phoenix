import { describe, expect, it } from "vitest";

import {
  getAnnotationSummaryPositiveOptimization,
  getAnnotationSummaryTopLabel,
  sortAnnotationSummariesForTriage,
} from "../annotationSummaryUtils";
import type { AnnotationOptimizationConfig } from "../optimizationUtils";

const maximize: AnnotationOptimizationConfig = {
  annotationType: "CONTINUOUS",
  optimizationDirection: "MAXIMIZE",
  lowerBound: 0,
  upperBound: 1,
};

const minimize: AnnotationOptimizationConfig = {
  annotationType: "CATEGORICAL",
  optimizationDirection: "MINIMIZE",
  values: [
    { label: "hallucinated", score: 1 },
    { label: "factual", score: 0 },
  ],
};

describe("getAnnotationSummaryPositiveOptimization", () => {
  it("follows the config's optimization direction", () => {
    expect(
      getAnnotationSummaryPositiveOptimization({
        summary: { meanScore: 0.9 },
        annotationConfig: maximize,
      })
    ).toBe(true);
    expect(
      getAnnotationSummaryPositiveOptimization({
        summary: { meanScore: 0.9 },
        annotationConfig: minimize,
      })
    ).toBe(false);
  });

  it("is undecided without a config, a direction, or a score", () => {
    expect(
      getAnnotationSummaryPositiveOptimization({
        summary: { meanScore: 0.9 },
        annotationConfig: undefined,
      })
    ).toBeNull();
    expect(
      getAnnotationSummaryPositiveOptimization({
        summary: { meanScore: 0.9 },
        annotationConfig: { ...maximize, optimizationDirection: "NONE" },
      })
    ).toBeNull();
    expect(
      getAnnotationSummaryPositiveOptimization({
        summary: { meanScore: null },
        annotationConfig: maximize,
      })
    ).toBeNull();
  });
});

describe("getAnnotationSummaryTopLabel", () => {
  it("picks the most common label, or nothing without labels", () => {
    expect(
      getAnnotationSummaryTopLabel({
        labelFractions: [
          { label: "factual", fraction: 0.25 },
          { label: "hallucinated", fraction: 0.75 },
        ],
      })
    ).toBe("hallucinated");
    expect(getAnnotationSummaryTopLabel({ labelFractions: [] })).toBeNull();
  });
});

describe("sortAnnotationSummariesForTriage", () => {
  it("puts unfavorable summaries first and orders the rest by name", () => {
    const sorted = sortAnnotationSummariesForTriage(
      [
        { name: "relevance", meanScore: 1, labelFractions: [] },
        { name: "hallucination", meanScore: 1, labelFractions: [] },
        { name: "coherence", meanScore: 0.9, labelFractions: [] },
        { name: "unconfigured", meanScore: 0.1, labelFractions: [] },
      ],
      new Map([
        ["relevance", maximize],
        ["hallucination", minimize],
        ["coherence", maximize],
      ])
    );
    expect(sorted.map((summary) => summary.name)).toEqual([
      "hallucination",
      "coherence",
      "relevance",
      "unconfigured",
    ]);
  });
});
