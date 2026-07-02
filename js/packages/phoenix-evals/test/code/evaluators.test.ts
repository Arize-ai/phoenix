import { describe, expect, it } from "vitest";

import { createF1Evaluator } from "../../src/code/createF1Evaluator";
import { createFBetaEvaluator } from "../../src/code/createFBetaEvaluator";
import { createPrecisionEvaluator } from "../../src/code/createPrecisionEvaluator";
import { createPrecisionRecallFScoreEvaluators } from "../../src/code/createPrecisionRecallFScoreEvaluators";
import { createRecallEvaluator } from "../../src/code/createRecallEvaluator";

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
});
