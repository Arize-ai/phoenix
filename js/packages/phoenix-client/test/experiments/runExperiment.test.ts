import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runExperiment,
  asEvaluator,
} from "../../src/experiments/runExperiment";
import * as getDatasetModule from "../../src/datasets/getDataset";
import type { Example } from "../../src/types/datasets";
import type { EvaluatorParams } from "../../src/types/experiments";

const mockDataset = {
  id: "dataset-1",
  name: "mock-dataset",
  description: "A mock dataset",
  versionId: "v1",
  metadata: {},
  examples: [
    {
      id: "ex-1",
      input: { name: "Alice" },
      output: { text: "Hello, Alice!" },
      metadata: {},
      updatedAt: new Date(),
    },
    {
      id: "ex-2",
      input: { name: "Bob" },
      output: { text: "Hello, Bob!" },
      metadata: {},
      updatedAt: new Date(),
    },
  ],
};

describe("runExperiment (dryRun)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(getDatasetModule, "getDataset").mockResolvedValue(mockDataset);
  });

  it("runs the task and evaluators in dryRun mode", async () => {
    const task = async (example: Example) => `Hello, ${example.input.name}!`;
    const matchesEvaluator = asEvaluator({
      name: "matches",
      kind: "CODE",
      evaluate: async ({ output, expected }: EvaluatorParams) => {
        const expectedText = (expected as { text?: string })?.text ?? "";
        const outputStr = typeof output === "string" ? output : String(output);
        return {
          label: outputStr === expectedText ? "match" : "no match",
          score: outputStr === expectedText ? 1 : 0,
          explanation:
            outputStr === expectedText ? "matches" : "does not match",
          metadata: {},
        };
      },
    });
    const containsHelloEvaluator = asEvaluator({
      name: "contains-hello",
      kind: "CODE",
      evaluate: async ({ output }: EvaluatorParams) => {
        const outputStr = typeof output === "string" ? output : String(output);
        return {
          label: outputStr.includes("Hello")
            ? "contains hello"
            : "does not contain hello",
          score: outputStr.includes("Hello") ? 1 : 0,
          explanation: outputStr.includes("Hello")
            ? "contains hello"
            : "does not contain hello",
          metadata: {},
        };
      },
    });

    const experiment = await runExperiment({
      dataset: { datasetId: mockDataset.id },
      task,
      evaluators: [matchesEvaluator, containsHelloEvaluator],
      dryRun: true,
    });

    expect(experiment).toBeDefined();
    expect(experiment.runs).toBeDefined();
    expect(Object.keys(experiment.runs)).toHaveLength(2);
    expect(experiment.evaluationRuns).toBeDefined();
    if (experiment.evaluationRuns) {
      expect(Array.isArray(experiment.evaluationRuns)).toBe(true);
      // There should be 2 runs * 2 evaluators = 4 evaluation runs
      expect(experiment.evaluationRuns.length).toBe(4);
      // Check that the evaluation results are as expected
      for (const evalRun of experiment.evaluationRuns) {
        expect(evalRun.result).toHaveProperty("label");
        expect(evalRun.result).toHaveProperty("score");
      }
    }
  });

  it("respects dryRun count", async () => {
    const task = (example: Example) => `Hi, ${example.input.name}`;
    const evaluator = asEvaluator({
      name: "dummy",
      kind: "CODE",
      evaluate: async () => ({
        label: "ok",
        score: 1,
        explanation: "",
        metadata: {},
      }),
    });
    // Only run 1 example
    const experiment = await runExperiment({
      dataset: { datasetId: mockDataset.id },
      task,
      evaluators: [evaluator],
      dryRun: 1,
    });
    expect(Object.keys(experiment.runs)).toHaveLength(1);
    if (experiment.evaluationRuns) {
      expect(experiment.evaluationRuns.length).toBe(1);
    }
  });
});
