import { describe, expect, it } from "vitest";

import {
  getAnnotationLabelConsensus,
  getAnnotationSummaryPositiveOptimization,
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

describe("getAnnotationLabelConsensus", () => {
  it("names the label when every annotation agrees", () => {
    expect(
      getAnnotationLabelConsensus({
        labelFractions: [{ label: "correct", fraction: 1 }],
      })
    ).toEqual({ kind: "top", label: "correct", fraction: 1 });
  });

  it("names the most common label with its share", () => {
    expect(
      getAnnotationLabelConsensus({
        labelFractions: [
          { label: "factual", fraction: 1 / 3 },
          { label: "hallucinated", fraction: 2 / 3 },
        ],
      })
    ).toEqual({ kind: "top", label: "hallucinated", fraction: 2 / 3 });
  });

  it("is mixed when labels tie for most common", () => {
    expect(
      getAnnotationLabelConsensus({
        labelFractions: [
          { label: "correct", fraction: 0.5 },
          { label: "incorrect", fraction: 0.5 },
        ],
      })?.kind
    ).toBe("mixed");
  });

  it("is null without labels", () => {
    expect(getAnnotationLabelConsensus({ labelFractions: [] })).toBeNull();
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
