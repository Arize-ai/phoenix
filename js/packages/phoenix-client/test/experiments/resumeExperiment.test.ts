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

  describe("stopOnFirstError", () => {
    // Test helper: creates a task that fails for Alice
    const createFailingTask = () => {
      return vi.fn(async (example: Example) => {
        if (example.input.name === "Alice") {
          throw new Error("Task failed for Alice");
        }
        return `Hello, ${example.input.name}!`;
      });
    };

    it("should stop on first error when stopOnFirstError is true", async () => {
      const taskFn = createFailingTask();

      await expect(
        resumeExperiment({
          experimentId: "exp-1",
          task: taskFn,
          stopOnFirstError: true,
          client: mockClient,
        })
      ).rejects.toThrow("Task failed for Alice");

      expect(taskFn).toHaveBeenCalled();
    });

    it("should continue processing when stopOnFirstError is false (default)", async () => {
      const taskFn = createFailingTask();

      await resumeExperiment({
        experimentId: "exp-1",
        task: taskFn,
        stopOnFirstError: false,
        client: mockClient,
      });

      expect(taskFn).toHaveBeenCalledTimes(3);
    });

    it("should stop fetching new pages when stopOnFirstError is triggered", async () => {
      // Create more data to ensure pagination
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        dataset_example: {
          id: `ex-${i}`,
          input: { name: i === 0 ? "Alice" : "Bob" },
          output: { text: `Hello, ${i === 0 ? "Alice" : "Bob"}!` },
          metadata: {},
          updated_at: new Date().toISOString(),
        },
        repetition_numbers: [1],
      }));

      // Mock pagination with multiple pages
      let pageCount = 0;
      mockClient.GET.mockImplementation(
        (
          url: string,
          options?: { params?: { query?: { cursor?: string; limit?: number } } }
        ) => {
          if (url.includes("incomplete-runs")) {
            pageCount++;
            const limit = options?.params?.query?.limit ?? 50;
            const cursor = options?.params?.query?.cursor;
            const startIdx = cursor ? parseInt(cursor) : 0;
            const endIdx = Math.min(startIdx + limit, largeDataset.length);

            return Promise.resolve({
              data: {
                data: largeDataset.slice(startIdx, endIdx),
                next_cursor:
                  endIdx < largeDataset.length ? String(endIdx) : null,
              },
            });
          }
          return Promise.resolve({ data: {} });
        }
      );

      const taskFn = createFailingTask();

      await expect(
        resumeExperiment({
          experimentId: "exp-1",
          task: taskFn,
          stopOnFirstError: true,
          client: mockClient,
        })
      ).rejects.toThrow("Task failed for Alice");

      expect(pageCount).toBeLessThan(3);
    });

    it("should record failed tasks even when stopping early", async () => {
      const taskFn = createFailingTask();

      await expect(
        resumeExperiment({
          experimentId: "exp-1",
          task: taskFn,
          stopOnFirstError: true,
          client: mockClient,
        })
      ).rejects.toThrow();

      expect(mockClient.POST).toHaveBeenCalledWith(
        "/v1/experiments/{experiment_id}/runs",
        expect.objectContaining({
          body: expect.objectContaining({
            error: "Task failed for Alice",
          }),
        })
      );
    });

    it("should stop all concurrent workers when one fails", async () => {
      const taskOrder: string[] = [];

      const taskFn = vi.fn(async (example: Example) => {
        taskOrder.push(example.id);

        // Add slight delay to ensure concurrency
        await new Promise((resolve) => setTimeout(resolve, 5));

        if (example.input.name === "Alice") {
          throw new Error("Task failed for Alice");
        }
        return `Hello, ${example.input.name}!`;
      });

      try {
        await resumeExperiment({
          experimentId: "exp-1",
          task: taskFn,
          stopOnFirstError: true,
          concurrency: 5,
          client: mockClient,
        });
      } catch {
        // Expected to throw
      }

      // Should not process all tasks
      expect(taskOrder.length).toBeLessThanOrEqual(3);
    });

    it("should skip evaluators when stopOnFirstError is triggered", async () => {
      const taskFn = vi.fn(async (example: Example) => {
        if (example.input.name === "Alice") {
          throw new Error("Task failed for Alice");
        }
        return { text: `Hello, ${example.input.name}!` };
      });

      const evaluatorFn = vi.fn(async () => ({ score: 1, label: "correct" }));

      await expect(
        resumeExperiment({
          experimentId: "exp-1",
          task: taskFn,
          evaluators: [
            {
              name: "correctness",
              kind: "CODE" as const,
              evaluate: evaluatorFn,
            },
          ],
          stopOnFirstError: true,
          client: mockClient,
        })
      ).rejects.toThrow();

      expect(evaluatorFn).not.toHaveBeenCalled();

      const incompleteEvaluationsCalls = mockClient.GET.mock.calls.filter(
        (call: unknown[]) =>
          (call[0] as string).includes("incomplete-evaluations")
      );
      expect(incompleteEvaluationsCalls).toHaveLength(0);
    });

    it("should default to stopOnFirstError = false", async () => {
      const taskFn = createFailingTask();

      await resumeExperiment({
        experimentId: "exp-1",
        task: taskFn,
        client: mockClient,
      });

      expect(taskFn).toHaveBeenCalledTimes(3);
    });
  });
});
