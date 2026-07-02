import { afterEach, describe, expect, it, vi } from "vitest";

import type * as ClassificationMetricsModule from "../../src/code/classificationMetrics";
import { createF1Evaluator } from "../../src/code/createF1Evaluator";
import { createFBetaEvaluator } from "../../src/code/createFBetaEvaluator";
import { createPrecisionEvaluator } from "../../src/code/createPrecisionEvaluator";
import { createPrecisionRecallFScoreEvaluator } from "../../src/code/createPrecisionRecallFScoreEvaluator";
import { createPrecisionRecallFScoreEvaluators } from "../../src/code/createPrecisionRecallFScoreEvaluators";
import { createRecallEvaluator } from "../../src/code/createRecallEvaluator";

vi.mock(
  "../../src/code/classificationMetrics",
  async (importOriginal: () => Promise<typeof ClassificationMetricsModule>) => {
    const actual = await importOriginal();
    return {
      ...actual,
      computePrecisionRecallFScore: vi.fn(actual.computePrecisionRecallFScore),
    };
  }
);

const multiClassExample = {
  expected: ["cat", "dog", "cat", "bird"],
  output: ["cat", "cat", "cat", "bird"],
};

describe("createPrecisionEvaluator", () => {
  it("computes macro precision by default and names the metric 'precision'", async () => {
    const evaluator = createPrecisionEvaluator();
    expect(evaluator.name).toBe("precision");
    expect(evaluator.kind).toBe("CODE");
    expect(evaluator.optimizationDirection).toBe("MAXIMIZE");

    const result = await evaluator.evaluate(multiClassExample);
    expect(result.score).toBeCloseTo(5 / 9, 10);
  });

  it("suffixes the metric name for non-macro averages", () => {
    const evaluator = createPrecisionEvaluator({ average: "micro" });
    expect(evaluator.name).toBe("precision_micro");
  });

  it("computes binary precision for a configured positive label", async () => {
    const evaluator = createPrecisionEvaluator({ positiveLabel: "spam" });
    expect(evaluator.name).toBe("precision");

    const result = await evaluator.evaluate({
      expected: ["spam", "ham", "spam"],
      output: ["spam", "spam", "ham"],
    });
    expect(result.score).toBeCloseTo(0.5, 10);
  });
});

describe("createRecallEvaluator", () => {
  it("computes macro recall by default and names the metric 'recall'", async () => {
    const evaluator = createRecallEvaluator();
    expect(evaluator.name).toBe("recall");

    const result = await evaluator.evaluate(multiClassExample);
    expect(result.score).toBeCloseTo(2 / 3, 10);
  });

  it("suffixes the metric name for non-macro averages", () => {
    const evaluator = createRecallEvaluator({ average: "weighted" });
    expect(evaluator.name).toBe("recall_weighted");
  });
});

describe("createFBetaEvaluator", () => {
  it("defaults to beta=1 and names the metric 'f1'", async () => {
    const evaluator = createFBetaEvaluator();
    expect(evaluator.name).toBe("f1");

    const result = await evaluator.evaluate(multiClassExample);
    expect(result.score).toBeCloseTo(0.6, 10);
  });

  it("names the metric using the configured beta and average", () => {
    const evaluator = createFBetaEvaluator({ beta: 0.5, average: "micro" });
    expect(evaluator.name).toBe("f0_5_micro");
  });

  it("computes the F-beta score for beta=2", async () => {
    const evaluator = createFBetaEvaluator({ beta: 2, average: "macro" });
    const result = await evaluator.evaluate(multiClassExample);
    expect(result.score).toBeCloseTo(7 / 11, 10);
  });
});

describe("createF1Evaluator", () => {
  it("is a shorthand for createFBetaEvaluator with beta=1", async () => {
    const evaluator = createF1Evaluator({ average: "weighted" });
    expect(evaluator.name).toBe("f1_weighted");

    const result = await evaluator.evaluate(multiClassExample);
    expect(result.score).toBeCloseTo(0.65, 10);
  });
});

describe("createPrecisionRecallFScoreEvaluators", () => {
  it("creates precision, recall, and F-score evaluators sharing the same options", async () => {
    const { precision, recall, fScore } = createPrecisionRecallFScoreEvaluators(
      { average: "micro" }
    );

    expect(precision.name).toBe("precision_micro");
    expect(recall.name).toBe("recall_micro");
    expect(fScore.name).toBe("f1_micro");

    const [precisionResult, recallResult, fScoreResult] = await Promise.all([
      precision.evaluate(multiClassExample),
      recall.evaluate(multiClassExample),
      fScore.evaluate(multiClassExample),
    ]);
    expect(precisionResult.score).toBeCloseTo(0.75, 10);
    expect(recallResult.score).toBeCloseTo(0.75, 10);
    expect(fScoreResult.score).toBeCloseTo(0.75, 10);
  });

  it("computes the confusion matrix once and reuses it across all three evaluators for the same example", async () => {
    const { computePrecisionRecallFScore } =
      await import("../../src/code/classificationMetrics");
    const { precision, recall, fScore } =
      createPrecisionRecallFScoreEvaluators();

    await precision.evaluate(multiClassExample);
    await recall.evaluate(multiClassExample);
    await fScore.evaluate(multiClassExample);

    expect(computePrecisionRecallFScore).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});

describe("createPrecisionRecallFScoreEvaluator", () => {
  it("returns a single composed evaluator with all three metrics", async () => {
    const evaluator = createPrecisionRecallFScoreEvaluator();
    expect(evaluator.name).toBe("precision_recall_fscore");
    expect(evaluator.kind).toBe("CODE");
    expect(evaluator.optimizationDirection).toBe("MAXIMIZE");

    const result = await evaluator.evaluate({
      expected: ["cat", "dog", "cat", "bird", "dog"],
      output: ["cat", "cat", "cat", "bird", "dog"],
    });

    // Headline score is the F-beta (F1 by default).
    expect(result.score).toBeCloseTo(0.822222, 5);
    // All three metrics plus the resolved config live in metadata.
    expect(result.metadata?.precision).toBeCloseTo(0.888889, 5);
    expect(result.metadata?.recall).toBeCloseTo(0.833333, 5);
    expect(result.metadata?.fScore).toBeCloseTo(0.822222, 5);
    expect(result.metadata?.beta).toBe(1);
    expect(result.metadata?.average).toBe("macro");
    expect(result.metadata?.positiveLabel).toBeNull();
    expect(result.explanation).toContain("precision=");
    expect(result.explanation).toContain("recall=");
    expect(result.explanation).toContain("f1=");
  });

  it("reflects beta and average in the explanation and metadata", async () => {
    const evaluator = createPrecisionRecallFScoreEvaluator({
      beta: 2,
      average: "micro",
    });
    const result = await evaluator.evaluate({
      expected: ["a", "b", "a", "c"],
      output: ["a", "a", "a", "c"],
    });
    expect(result.metadata?.beta).toBe(2);
    expect(result.metadata?.average).toBe("micro");
    expect(result.explanation).toContain("precision_micro=");
    expect(result.explanation).toContain("f2_micro=");
  });

  it("computes binary one-vs-rest metrics for a configured positive label", async () => {
    const evaluator = createPrecisionRecallFScoreEvaluator({
      positiveLabel: "spam",
    });
    const result = await evaluator.evaluate({
      expected: ["spam", "ham", "spam", "ham", "spam"],
      output: ["spam", "spam", "ham", "ham", "spam"],
    });
    expect(result.score).toBeCloseTo(2 / 3, 10);
    expect(result.metadata?.precision).toBeCloseTo(2 / 3, 10);
    expect(result.metadata?.recall).toBeCloseTo(2 / 3, 10);
    expect(result.metadata?.positiveLabel).toBe("spam");
  });
});
