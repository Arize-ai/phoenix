import { beforeEach, describe, expect, it, vi } from "vitest";

import * as getDatasetModule from "../../src/datasets/getDataset";
import { asExperimentEvaluator } from "../../src/experiments/helpers/asExperimentEvaluator";
import { evaluateExperiment } from "../../src/experiments/runExperiment";
import type {
  EvaluatorParams,
  RanExperiment,
} from "../../src/types/experiments";

// A dataset uploaded with custom example ids: "id" carries the custom id
// while "nodeId" carries the server-generated node GlobalID.
const mockDataset = {
  id: "dataset-1",
  name: "mock-dataset",
  description: "A mock dataset",
  versionId: "v1",
  metadata: {},
  examples: [
    {
      id: "custom-1",
      nodeId: "RGF0YXNldEV4YW1wbGU6MQ==",
      input: { name: "Alice" },
      output: { text: "Hello, Alice!" },
      metadata: {},
      updatedAt: new Date(),
    },
    {
      id: "custom-2",
      nodeId: "RGF0YXNldEV4YW1wbGU6Mg==",
      input: { name: "Bob" },
      output: { text: "Hello, Bob!" },
      metadata: {},
      updatedAt: new Date(),
    },
  ],
};

function makeRanExperiment(
  runs: Record<string, { id: string; datasetExampleId: string }>
): RanExperiment {
  return {
    id: "experiment-1",
    datasetId: mockDataset.id,
    datasetVersionId: mockDataset.versionId,
    repetitions: 1,
    metadata: {},
    projectName: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exampleCount: Object.keys(runs).length,
    successfulRunCount: Object.keys(runs).length,
    failedRunCount: 0,
    missingRunCount: 0,
    runs: Object.fromEntries(
      Object.entries(runs).map(([runId, run]) => [
        runId,
        {
          ...run,
          experimentId: "experiment-1",
          startTime: new Date(),
          endTime: new Date(),
          output: "Hello!",
          error: null,
          traceId: null,
        },
      ])
    ),
  };
}

describe("evaluateExperiment (dryRun)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(getDatasetModule, "getDataset").mockResolvedValue(mockDataset);
  });

  it("matches runs that reference examples by node GlobalID", async () => {
    // Runs fetched from the server identify examples by node GlobalID,
    // not by the custom example id.
    const experiment = makeRanExperiment({
      "run-1": { id: "run-1", datasetExampleId: "RGF0YXNldEV4YW1wbGU6MQ==" },
      "run-2": { id: "run-2", datasetExampleId: "RGF0YXNldEV4YW1wbGU6Mg==" },
    });
    const evaluateFn = vi.fn(async ({ input }: EvaluatorParams) => ({
      label: "ok",
      score: 1,
      explanation: `input name was ${(input as { name?: string }).name}`,
      metadata: {},
    }));
    const evaluator = asExperimentEvaluator({
      name: "dummy",
      kind: "CODE",
      evaluate: evaluateFn,
    });

    const result = await evaluateExperiment({
      experiment,
      evaluators: [evaluator],
      dryRun: true,
    });

    expect(result.evaluationRuns).toHaveLength(2);
    expect(result.evaluationRuns?.every((run) => run.error === null)).toBe(
      true
    );
    const evaluatedNames = evaluateFn.mock.calls
      .map((call) => (call[0].input as { name?: string }).name)
      .sort();
    expect(evaluatedNames).toEqual(["Alice", "Bob"]);
  });

  it("matches runs against servers that predate node ids", async () => {
    // Older servers omit nodeId from the examples response and deliver the
    // GlobalID in the id field; runs recorded against them carry that value.
    const legacyDataset = {
      ...mockDataset,
      examples: mockDataset.examples.map(({ nodeId: _nodeId, ...example }) => ({
        ...example,
        id: _nodeId,
      })),
    };
    vi.spyOn(getDatasetModule, "getDataset").mockResolvedValue(legacyDataset);
    const experiment = makeRanExperiment({
      "run-1": { id: "run-1", datasetExampleId: "RGF0YXNldEV4YW1wbGU6MQ==" },
      "run-2": { id: "run-2", datasetExampleId: "RGF0YXNldEV4YW1wbGU6Mg==" },
    });
    const evaluator = asExperimentEvaluator({
      name: "dummy",
      kind: "CODE",
      evaluate: async () => ({
        label: "ok",
        score: 1,
        explanation: "",
        metadata: {},
      }),
    });

    const result = await evaluateExperiment({
      experiment,
      evaluators: [evaluator],
      dryRun: true,
    });

    expect(result.evaluationRuns).toHaveLength(2);
    expect(result.evaluationRuns?.every((run) => run.error === null)).toBe(
      true
    );
  });
});
