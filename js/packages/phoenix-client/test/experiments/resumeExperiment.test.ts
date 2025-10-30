import { createClient, type PhoenixClient } from "../../src/client";
import * as getExperimentInfoModule from "../../src/experiments/getExperimentInfo";
import { resumeExperiment } from "../../src/experiments/resumeExperiment";
import type { Example } from "../../src/types/datasets";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client");
vi.mock("@arizeai/phoenix-otel", () => ({
  register: vi.fn(() => ({
    getTracer: vi.fn(() => ({
      startSpan: vi.fn(() => ({
        end: vi.fn(),
        setStatus: vi.fn(),
        setAttribute: vi.fn(),
        recordException: vi.fn(),
      })),
      startActiveSpan: vi.fn((name, fn) => {
        // Execute the callback synchronously with a mock span
        return fn({
          end: vi.fn(),
          setStatus: vi.fn(),
          setAttribute: vi.fn(),
          setAttributes: vi.fn(),
          recordException: vi.fn(),
          spanContext: vi.fn(() => ({
            traceId: "mock-trace-id",
            spanId: "mock-span-id",
          })),
        });
      }),
    })),
    forceFlush: vi.fn(() => Promise.resolve()),
  })),
  trace: {
    getTracer: vi.fn(() => ({
      startSpan: vi.fn(() => ({
        end: vi.fn(),
        setStatus: vi.fn(),
        setAttribute: vi.fn(),
        recordException: vi.fn(),
      })),
      startActiveSpan: vi.fn((name, fn) => {
        return fn({
          end: vi.fn(),
          setStatus: vi.fn(),
          setAttribute: vi.fn(),
          recordException: vi.fn(),
        });
      }),
    })),
  },
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
  objectAsAttributes: vi.fn((obj) => obj),
  createNoOpProvider: vi.fn(),
  NodeTracerProvider: vi.fn(),
  Tracer: vi.fn(),
}));

const mockExperimentInfo = {
  id: "exp-1",
  datasetId: "dataset-1",
  datasetVersionId: "v1",
  repetitions: 2,
  metadata: {},
  projectName: "test-project",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  exampleCount: 3,
  successfulRunCount: 2,
  failedRunCount: 2,
  missingRunCount: 2,
};

const mockIncompleteRuns = [
  {
    dataset_example: {
      id: "ex-1",
      input: { name: "Alice" },
      output: { text: "Hello, Alice!" },
      metadata: {},
    },
    repetition_numbers: [1, 2],
  },
  {
    dataset_example: {
      id: "ex-2",
      input: { name: "Bob" },
      output: { text: "Hello, Bob!" },
      metadata: {},
    },
    repetition_numbers: [1],
  },
];

describe("resumeExperiment", () => {
  let mockClient: PhoenixClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getExperimentInfo
    vi.spyOn(getExperimentInfoModule, "getExperimentInfo").mockResolvedValue(
      mockExperimentInfo
    );

    // Create mock client
    mockClient = {
      GET: vi.fn(),
      POST: vi.fn(),
      config: {
        baseUrl: "http://localhost:6006",
      },
    };

    // Mock client.GET for incomplete runs
    mockClient.GET.mockImplementation((url: string) => {
      if (url.includes("incomplete-runs")) {
        return Promise.resolve({
          data: {
            data: mockIncompleteRuns,
            next_cursor: null,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    // Mock client.POST for experiment runs
    mockClient.POST.mockResolvedValue({
      data: {
        id: "run-123",
      },
    });

    vi.mocked(createClient).mockReturnValue(mockClient);
  });

  it("should resume incomplete runs with a simple task", async () => {
    const taskFn = vi.fn(
      async (example: Example) => `Hello, ${example.input.name}!`
    );

    await resumeExperiment({
      experimentId: "exp-1",
      task: taskFn,
      client: mockClient,
    });

    // Task should be called exactly once per incomplete run (3 total)
    expect(taskFn).toHaveBeenCalledTimes(3);

    // Should fetch experiment info
    expect(getExperimentInfoModule.getExperimentInfo).toHaveBeenCalledWith({
      client: mockClient,
      experimentId: "exp-1",
    });

    // Should fetch incomplete runs
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/experiments/{experiment_id}/incomplete-runs",
      expect.objectContaining({
        params: expect.objectContaining({
          path: { experiment_id: "exp-1" },
        }),
      })
    );

    // Should submit experiment runs (3 total: 2 for ex-1, 1 for ex-2)
    expect(mockClient.POST).toHaveBeenCalledTimes(3);
    expect(mockClient.POST).toHaveBeenCalledWith(
      "/v1/experiments/{experiment_id}/runs",
      expect.objectContaining({
        params: expect.objectContaining({
          path: expect.objectContaining({
            experiment_id: "exp-1",
          }),
        }),
      })
    );
  });

  it("should handle pagination of incomplete runs", async () => {
    const taskFn = vi.fn(
      async (example: Example) => `Hello, ${example.input.name}!`
    );

    // Mock pagination: first call returns cursor, second returns no cursor
    mockClient.GET.mockImplementation(
      (url: string, options?: { params?: { query?: { cursor?: string } } }) => {
        if (url.includes("incomplete-runs")) {
          const cursor = options?.params?.query?.cursor;
          if (!cursor) {
            // First page
            return Promise.resolve({
              data: {
                data: [mockIncompleteRuns[0]],
                next_cursor: "cursor-1",
              },
            });
          } else {
            // Second page
            return Promise.resolve({
              data: {
                data: [mockIncompleteRuns[1]],
                next_cursor: null,
              },
            });
          }
        }
        return Promise.resolve({ data: {} });
      }
    );

    await resumeExperiment({
      experimentId: "exp-1",
      task: taskFn,
      client: mockClient,
    });

    // Task should be called exactly once per incomplete run (3 total)
    expect(taskFn).toHaveBeenCalledTimes(3);

    // Should fetch incomplete runs twice (pagination)
    const incompleteRunsCalls = mockClient.GET.mock.calls.filter(
      (call: unknown[]) => (call[0] as string).includes("incomplete-runs")
    );
    expect(incompleteRunsCalls).toHaveLength(2);

    // Second call should include cursor
    expect(incompleteRunsCalls[1][1]).toMatchObject({
      params: {
        query: expect.objectContaining({
          cursor: "cursor-1",
        }),
      },
    });
  });

  it("should handle empty incomplete runs", async () => {
    const taskFn = vi.fn(
      async (example: Example) => `Hello, ${example.input.name}!`
    );

    // Mock no incomplete runs
    mockClient.GET.mockImplementation((url: string) => {
      if (url.includes("incomplete-runs")) {
        return Promise.resolve({
          data: {
            data: [],
            next_cursor: null,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    await resumeExperiment({
      experimentId: "exp-1",
      task: taskFn,
      client: mockClient,
    });

    // Task should never be called when there are no incomplete runs
    expect(taskFn).not.toHaveBeenCalled();

    // Should not submit any experiment runs
    expect(mockClient.POST).not.toHaveBeenCalled();
  });

  it("should respect custom pageSize", async () => {
    const task = async (example: Example) => `Hello, ${example.input.name}!`;

    await resumeExperiment({
      experimentId: "exp-1",
      task,
      pageSize: 10,
      client: mockClient,
    });

    // Should use custom pageSize in the query
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/experiments/{experiment_id}/incomplete-runs",
      expect.objectContaining({
        params: expect.objectContaining({
          query: expect.objectContaining({
            limit: 10,
          }),
        }),
      })
    );
  });

  it("should handle task failures gracefully", async () => {
    const taskFn = vi.fn(async (example: Example) => {
      if (example.input.name === "Alice") {
        throw new Error("Task failed for Alice");
      }
      return `Hello, ${example.input.name}!`;
    });

    await resumeExperiment({
      experimentId: "exp-1",
      task: taskFn,
      client: mockClient,
    });

    // Task should be called exactly once per incomplete run, even for failures (3 total)
    expect(taskFn).toHaveBeenCalledTimes(3);

    // Should still attempt all runs even if some fail
    expect(mockClient.POST).toHaveBeenCalled();
  });

  it("should validate pageSize", async () => {
    const task = async (example: Example) => `Hello, ${example.input.name}!`;

    await expect(
      resumeExperiment({
        experimentId: "exp-1",
        task,
        pageSize: 0,
        client: mockClient,
      })
    ).rejects.toThrow("pageSize must be a positive integer greater than 0");

    await expect(
      resumeExperiment({
        experimentId: "exp-1",
        task,
        pageSize: -1,
        client: mockClient,
      })
    ).rejects.toThrow("pageSize must be a positive integer greater than 0");

    await expect(
      resumeExperiment({
        experimentId: "exp-1",
        task,
        pageSize: 1.5,
        client: mockClient,
      })
    ).rejects.toThrow("pageSize must be a positive integer greater than 0");
  });

  it("should only evaluate incomplete evaluations, not all runs", async () => {
    const taskFn = vi.fn(async (example: Example) => ({
      text: `Hello, ${example.input.name}!`,
    }));
    const evaluatorFn = vi.fn(async ({ output, expected }) => ({
      score: output === expected ? 1 : 0,
      label: output === expected ? "correct" : "incorrect",
    }));

    // Mock incomplete runs (3 runs need to be executed)
    mockClient.GET.mockImplementation((url: string) => {
      if (url.includes("incomplete-runs")) {
        return Promise.resolve({
          data: {
            data: mockIncompleteRuns,
            next_cursor: null,
          },
        });
      }
      // Mock incomplete evaluations: only 1 out of 3 completed runs needs evaluation
      if (url.includes("incomplete-evaluations")) {
        return Promise.resolve({
          data: {
            data: [
              {
                experiment_run: {
                  id: "run-1",
                  experiment_id: "exp-1",
                  dataset_example_id: "ex-1",
                  repetition_number: 1,
                  output: { text: "Hello, Alice!" },
                  start_time: new Date().toISOString(),
                  end_time: new Date().toISOString(),
                  error: null,
                  trace_id: null,
                },
                dataset_example: {
                  id: "ex-1",
                  input: { name: "Alice" },
                  output: { text: "Hello, Alice!" },
                  metadata: {},
                  updated_at: new Date().toISOString(),
                },
                evaluation_names: ["correctness"],
              },
            ],
            next_cursor: null,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    await resumeExperiment({
      experimentId: "exp-1",
      task: taskFn,
      evaluators: [
        {
          name: "correctness",
          kind: "CODE" as const,
          evaluate: evaluatorFn,
        },
      ],
      client: mockClient,
    });

    // Task should be called for all 3 incomplete runs
    expect(taskFn).toHaveBeenCalledTimes(3);

    // Evaluator should only be called for 1 incomplete evaluation, not all 3 runs
    // This proves we're using resumeEvaluation, not evaluateExperiment
    expect(evaluatorFn).toHaveBeenCalledTimes(1);

    // Should fetch incomplete evaluations (confirms resumeEvaluation was called)
    const incompleteEvaluationsCalls = mockClient.GET.mock.calls.filter(
      (call: unknown[]) =>
        (call[0] as string).includes("incomplete-evaluations")
    );
    expect(incompleteEvaluationsCalls).toHaveLength(1);

    // Should post the evaluation result for the 1 incomplete evaluation
    const evaluationPosts = mockClient.POST.mock.calls.filter(
      (call: unknown[]) =>
        (call[0] as string).includes("experiment_evaluations")
    );
    expect(evaluationPosts).toHaveLength(1);
  });
});
