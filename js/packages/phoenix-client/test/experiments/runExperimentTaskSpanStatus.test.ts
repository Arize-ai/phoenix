import { SpanStatusCode } from "@opentelemetry/api";
import {
  type ReadableSpan,
  type SpanProcessor,
  NodeTracerProvider,
} from "@opentelemetry/sdk-trace-node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as getDatasetModule from "../../src/datasets/getDataset";
import { runExperiment } from "../../src/experiments/runExperiment";
import type { PhoenixClient } from "../../src/types/core";

const finishedSpans: ReadableSpan[] = [];

vi.mock("@arizeai/phoenix-otel", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@arizeai/phoenix-otel")>();
  return {
    ...original,
    register: () => {
      const processor: SpanProcessor = {
        onStart: () => {},
        onEnd: (span) => {
          finishedSpans.push(span);
        },
        forceFlush: async () => {},
        shutdown: async () => {},
      };
      return new NodeTracerProvider({ spanProcessors: [processor] });
    },
  };
});

const mockDataset = {
  id: "dataset-1",
  name: "mock-dataset",
  description: "A mock dataset",
  versionId: "v1",
  metadata: {},
  examples: [
    {
      id: "ex-1",
      input: { question: "hello" },
      output: { text: "hi" },
      metadata: {},
      updatedAt: new Date(),
    },
  ],
};

const experimentResponse = {
  id: "experiment-1",
  dataset_id: "dataset-1",
  dataset_version_id: "v1",
  repetitions: 1,
  metadata: {},
  project_name: "mock-project",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  example_count: 1,
  successful_run_count: 0,
  failed_run_count: 0,
  missing_run_count: 0,
};

function makeClient(): PhoenixClient {
  return {
    config: { baseUrl: "http://localhost:6006" },
    POST: vi.fn(async (path: string) => ({
      data: {
        data:
          path === "/v1/experiments/{experiment_id}/runs"
            ? { id: "run-1" }
            : experimentResponse,
      },
    })),
    GET: vi.fn(async () => ({ data: { data: experimentResponse } })),
  } as unknown as PhoenixClient;
}

function taskSpan() {
  const span = finishedSpans.find((s) => s.name.startsWith("Task: "));
  expect(span).toBeDefined();
  return span as ReadableSpan;
}

describe("runExperiment task span status", () => {
  beforeEach(() => {
    finishedSpans.length = 0;
    vi.spyOn(getDatasetModule, "getDataset").mockResolvedValue(mockDataset);
  });

  it("marks the task span OK when the task succeeds", async () => {
    await runExperiment({
      client: makeClient(),
      dataset: { datasetId: mockDataset.id },
      task: async function succeedingTask() {
        return "hi";
      },
      setGlobalTracerProvider: false,
      useBatchSpanProcessor: false,
    });

    expect(taskSpan().status.code).toBe(SpanStatusCode.OK);
  });

  it.each([
    ["a message", new Error("task failed")],
    ["an empty message", new Error("")],
  ])(
    "marks the task span ERROR when the task throws an error with %s",
    async (_label, error) => {
      const experiment = await runExperiment({
        client: makeClient(),
        dataset: { datasetId: mockDataset.id },
        task: async function failingTask() {
          throw error;
        },
        setGlobalTracerProvider: false,
        useBatchSpanProcessor: false,
      });

      expect(Object.values(experiment.runs)[0]?.error).not.toBeNull();
      expect(taskSpan().status.code).toBe(SpanStatusCode.ERROR);
    }
  );
});
