import type * as PhoenixOtel from "@arizeai/phoenix-otel";
import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@arizeai/phoenix-otel", async (importOriginal) => ({
  ...(await importOriginal<typeof PhoenixOtel>()),
  attachGlobalTracerProvider: vi.fn(() => ({
    detach: vi.fn(),
  })),
  createNoOpProvider: vi.fn(() => ({
    getTracer: vi.fn(() => ({
      startActiveSpan: vi.fn((name, fn) =>
        fn({
          end: vi.fn(),
          setStatus: vi.fn(),
          setAttributes: vi.fn(),
          spanContext: vi.fn(() => ({
            traceId: "noop-trace-id",
            spanId: "noop-span-id",
          })),
        })
      ),
    })),
  })),
  objectAsAttributes: vi.fn((value) => value),
  register: vi.fn(({ projectName }: { projectName: string }) => ({
    getTracer: vi.fn(() => ({
      startActiveSpan: vi.fn((name, fn) =>
        fn({
          end: vi.fn(),
          setStatus: vi.fn(),
          setAttributes: vi.fn(),
          spanContext: vi.fn(() => ({
            traceId: `trace-${projectName}-${name}`,
            spanId: `span-${projectName}`,
          })),
        })
      ),
    })),
    forceFlush: vi.fn(() => Promise.resolve()),
    shutdown: vi.fn(() => Promise.resolve()),
  })),
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
}));

import * as phoenixOtel from "@arizeai/phoenix-otel";

import * as getDatasetModule from "../../src/datasets/getDataset";
import * as getExperimentInfoModule from "../../src/experiments/getExperimentInfo";
import {
  asEvaluator,
  runExperiment,
} from "../../src/experiments/runExperiment";
import { createTestClient } from "../testUtils";

const http = createHttp();

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
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
      output: { answer: "world" },
      metadata: {},
      updatedAt: new Date(),
    },
  ],
};

describe("runExperiment tracing", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(getDatasetModule, "getDataset").mockResolvedValue(mockDataset);
    vi.spyOn(getExperimentInfoModule, "getExperimentInfo").mockResolvedValue({
      id: "exp-1",
      datasetId: mockDataset.id,
      datasetVersionId: mockDataset.versionId,
      datasetSplits: [],
      projectName: "experiment-project",
      repetitions: 1,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      exampleCount: 1,
      successfulRunCount: 1,
      failedRunCount: 0,
      missingRunCount: 0,
    });

    server.use(
      http.post("/v1/datasets/{dataset_id}/experiments", ({ response }) =>
        response(200).json({
          data: {
            id: "exp-1",
            dataset_id: mockDataset.id,
            dataset_version_id: mockDataset.versionId,
            project_name: "experiment-project",
            repetitions: 1,
            metadata: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            example_count: 1,
            successful_run_count: 0,
            failed_run_count: 0,
            missing_run_count: 1,
          },
        })
      ),
      http.post("/v1/experiments/{experiment_id}/runs", ({ response }) =>
        response(200).json({ data: { id: "run-1" } })
      ),
      http.post("/v1/experiment_evaluations", ({ response }) =>
        response(200).json({ data: { id: "eval-1" } })
      )
    );
  });

  it("uses separate tracer providers for task and evaluation tracing", async () => {
    const evaluator = asEvaluator({
      name: "correctness",
      kind: "CODE",
      evaluate: async () => ({
        score: 1,
        label: "correct",
      }),
    });

    await runExperiment({
      client: createTestClient(),
      dataset: { datasetId: mockDataset.id },
      task: async ({ input }) => input,
      evaluators: [evaluator],
      setGlobalTracerProvider: true,
    });

    expect(vi.mocked(phoenixOtel.register)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(phoenixOtel.register)).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        projectName: "experiment-project",
        global: false,
      })
    );
    expect(vi.mocked(phoenixOtel.register)).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        projectName: "evaluators",
        global: false,
      })
    );
    expect(
      vi.mocked(phoenixOtel.attachGlobalTracerProvider)
    ).toHaveBeenCalledTimes(2);

    const globalRegistrations = vi
      .mocked(phoenixOtel.attachGlobalTracerProvider)
      .mock.results.map((result) => result.value);
    expect(globalRegistrations).toHaveLength(2);
    for (const registration of globalRegistrations) {
      expect(registration.detach).toHaveBeenCalledTimes(1);
    }
  });
});
