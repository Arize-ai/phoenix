import { createClassificationEvaluator } from "@arizeai/phoenix-evals";

import * as getDatasetModule from "../../src/datasets/getDataset";
import {
  asEvaluator,
  runExperiment,
} from "../../src/experiments/runExperiment";
import type { Example } from "../../src/types/datasets";
import type { EvaluatorParams } from "../../src/types/experiments";

import { MockLanguageModelV2 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("runs experiments with repetitions", async () => {
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

    const experiment = await runExperiment({
      dataset: { datasetId: mockDataset.id },
      task,
      evaluators: [evaluator],
      dryRun: true,
      repetitions: 3,
    });

    // Should have 2 examples * 3 repetitions = 6 runs
    expect(Object.keys(experiment.runs)).toHaveLength(6);
    if (experiment.evaluationRuns) {
      // Should have 6 runs * 1 evaluator = 6 evaluation runs
      expect(experiment.evaluationRuns.length).toBe(6);
    }
  });

  it("defaults to 1 repetition when not specified", async () => {
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

    const experiment = await runExperiment({
      dataset: { datasetId: mockDataset.id },
      task,
      evaluators: [evaluator],
      dryRun: true,
    });

    // Should have 2 examples * 1 repetition = 2 runs
    expect(Object.keys(experiment.runs)).toHaveLength(2);
    if (experiment.evaluationRuns) {
      expect(experiment.evaluationRuns.length).toBe(2);
    }
  });
  it("should throw an error if repetitions is invalid", async () => {
    await expect(
      runExperiment({
        dataset: { datasetId: mockDataset.id },
        task: () => "",
        dryRun: true,
        repetitions: 0,
      })
    ).rejects.toThrow("repetitions must be an integer greater than 0");
    await expect(
      runExperiment({
        dataset: { datasetId: mockDataset.id },
        task: () => "",
        dryRun: true,
        repetitions: -1,
      })
    ).rejects.toThrow("repetitions must be an integer greater than 0");
  });
  it("should work with phoenix-evals evaluators", async () => {
    const task = (example: Example) => `Hi, ${example.input.name}`;
    const correctnessEvaluator = createClassificationEvaluator({
      name: "correctness",
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: "text",
              text: `{"label": "correct", "explanation": "because" }`,
            },
          ],
          warnings: [],
        }),
      }),
      promptTemplate: "Is the following text correct: {{output}}",
      choices: { correct: 1, incorrect: 0 },
    });
    const experiment = await runExperiment({
      dataset: { datasetId: mockDataset.id },
      task,
      evaluators: [correctnessEvaluator],
      dryRun: true,
    });
    expect(experiment).toBeDefined();
    expect(experiment.runs).toBeDefined();
    expect(Object.keys(experiment.runs)).toHaveLength(2);
    expect(experiment.evaluationRuns).toHaveLength(2);
    expect(experiment.evaluationRuns?.[0].annotatorKind).toBe("LLM");
    expect(experiment.evaluationRuns?.[0].name).toBe("correctness");
    expect(experiment.evaluationRuns?.[0].result).toBeDefined();
    expect(experiment.evaluationRuns?.[0].result?.label).toBe("correct");
    expect(experiment.evaluationRuns?.[0].result?.score).toBe(1);
    expect(experiment.evaluationRuns?.[0].result?.explanation).toBe("because");
  });
});
