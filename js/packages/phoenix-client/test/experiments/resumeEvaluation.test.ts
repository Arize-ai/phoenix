import { createClient, type PhoenixClient } from "../../src/client";
import * as getExperimentInfoModule from "../../src/experiments/getExperimentInfo";
import { resumeEvaluation } from "../../src/experiments/resumeEvaluation";
import { asEvaluator } from "../../src/experiments/runExperiment";
import type { EvaluatorParams } from "../../src/types/experiments";

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
  repetitions: 1,
  metadata: {},
  projectName: "test-project",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  exampleCount: 2,
  successfulRunCount: 2,
  failedRunCount: 0,
  missingRunCount: 0,
};

const mockIncompleteEvaluations = [
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
    },
    evaluation_names: ["correctness", "relevance"],
  },
  {
    experiment_run: {
      id: "run-2",
      experiment_id: "exp-1",
      dataset_example_id: "ex-2",
      repetition_number: 1,
      output: { text: "Hi, Bob!" },
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      error: null,
      trace_id: null,
    },
    dataset_example: {
      id: "ex-2",
      input: { name: "Bob" },
      output: { text: "Hello, Bob!" },
      metadata: {},
    },
    evaluation_names: ["correctness"],
  },
];

describe("resumeEvaluation", () => {
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

    // Mock client.GET for incomplete evaluations
    mockClient.GET.mockImplementation((url: string) => {
      if (url.includes("incomplete-evaluations")) {
        return Promise.resolve({
          data: {
            data: mockIncompleteEvaluations,
            next_cursor: null,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    // Mock client.POST for evaluation results
    mockClient.POST.mockResolvedValue({
      data: {
        id: "eval-123",
      },
    });

    vi.mocked(createClient).mockReturnValue(mockClient);
  });

  it("should resume incomplete evaluations with single-output evaluators", async () => {
    const correctnessFn = vi.fn(
      async ({ output, expected }: EvaluatorParams) => {
        const expectedText = (expected as { text?: string })?.text ?? "";
        const outputText = (output as { text?: string })?.text ?? "";
        return {
          score: outputText === expectedText ? 1 : 0,
          label: outputText === expectedText ? "correct" : "incorrect",
        };
      }
    );

    const relevanceFn = vi.fn(async () => ({
      score: 0.9,
      label: "relevant",
    }));

    const correctnessEvaluator = asEvaluator({
      name: "correctness",
      kind: "CODE",
      evaluate: correctnessFn,
    });

    const relevanceEvaluator = asEvaluator({
      name: "relevance",
      kind: "LLM",
      evaluate: relevanceFn,
    });

    await resumeEvaluation({
      experimentId: "exp-1",
      evaluators: [correctnessEvaluator, relevanceEvaluator],
      client: mockClient,
    });

    // Each evaluator should be called exactly once per matching incomplete evaluation
    // correctness: 2 times (run-1 and run-2 both need it)
    // relevance: 1 time (only run-1 needs it)
    expect(correctnessFn).toHaveBeenCalledTimes(2);
    expect(relevanceFn).toHaveBeenCalledTimes(1);

    // Should fetch experiment info
    expect(getExperimentInfoModule.getExperimentInfo).toHaveBeenCalledWith({
      client: mockClient,
      experimentId: "exp-1",
    });

    // Should fetch incomplete evaluations
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/experiments/{experiment_id}/incomplete-evaluations",
      expect.objectContaining({
        params: expect.objectContaining({
          path: { experiment_id: "exp-1" },
        }),
      })
    );

    // Should submit evaluation results
    // run-1 needs: correctness, relevance (2 evals)
    // run-2 needs: correctness (1 eval)
    // Total: 3 evaluations
    expect(mockClient.POST).toHaveBeenCalledTimes(3);
    expect(mockClient.POST).toHaveBeenCalledWith(
      "/v1/experiment_evaluations",
      expect.objectContaining({
        body: expect.objectContaining({
          experiment_run_id: expect.any(String),
          name: expect.any(String),
          annotator_kind: expect.any(String),
        }),
      })
    );
  });

  it("should handle multi-output evaluators", async () => {
    const multiMetricsFn = vi.fn(
      async ({ output, expected }: EvaluatorParams) => {
        const expectedText = (expected as { text?: string })?.text ?? "";
        const outputText = (output as { text?: string })?.text ?? "";
        // Return multiple evaluation results
        return [
          {
            name: "coherence",
            score: outputText === expectedText ? 1 : 0,
            label: "coherent",
          },
          {
            name: "relevance",
            score: 0.85,
            label: "relevant",
          },
        ];
      }
    );

    const multiMetricsEvaluator = asEvaluator({
      name: "llm-judge",
      kind: "LLM",
      evaluate: multiMetricsFn,
    });

    await resumeEvaluation({
      experimentId: "exp-1",
      evaluators: [multiMetricsEvaluator],
      evaluationNames: ["coherence", "relevance"],
      client: mockClient,
    });

    // Multi-output evaluator should be called exactly once per matching run
    // run-1 has ["correctness", "relevance"] - matches because of "relevance" -> 1 call
    // run-2 has ["correctness"] - doesn't match "coherence" or "relevance" -> 0 calls
    // Total: 1 call
    expect(multiMetricsFn).toHaveBeenCalledTimes(1);

    // Should fetch incomplete evaluations with evaluation_names
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/experiments/{experiment_id}/incomplete-evaluations",
      expect.objectContaining({
        params: expect.objectContaining({
          query: expect.objectContaining({
            evaluation_name: ["coherence", "relevance"],
          }),
        }),
      })
    );

    // Should submit evaluation results
    // Each run produces 2 evaluations (coherence, relevance)
    // run-1 has both incomplete, run-2 has only correctness incomplete
    // So we run the evaluator for both runs, producing 4 results total
    expect(mockClient.POST).toHaveBeenCalled();
  });

  it("should handle pagination of incomplete evaluations", async () => {
    const evaluator = asEvaluator({
      name: "correctness",
      kind: "CODE",
      evaluate: async () => ({ score: 1, label: "correct" }),
    });

    // Mock pagination: first call returns cursor, second returns no cursor
    mockClient.GET.mockImplementation(
      (url: string, options?: { params?: { query?: { cursor?: string } } }) => {
        if (url.includes("incomplete-evaluations")) {
          const cursor = options?.params?.query?.cursor;
          if (!cursor) {
            // First page
            return Promise.resolve({
              data: {
                data: [mockIncompleteEvaluations[0]],
                next_cursor: "cursor-1",
              },
            });
          } else {
            // Second page
            return Promise.resolve({
              data: {
                data: [mockIncompleteEvaluations[1]],
                next_cursor: null,
              },
            });
          }
        }
        return Promise.resolve({ data: {} });
      }
    );

    await resumeEvaluation({
      experimentId: "exp-1",
      evaluators: [evaluator],
      client: mockClient,
    });

    // Should fetch incomplete evaluations twice (pagination)
    const incompleteEvalsCalls = mockClient.GET.mock.calls.filter(
      (call: unknown[]) =>
        (call[0] as string).includes("incomplete-evaluations")
    );
    expect(incompleteEvalsCalls).toHaveLength(2);

    // Second call should include cursor
    expect(incompleteEvalsCalls[1][1]).toMatchObject({
      params: {
        query: expect.objectContaining({
          cursor: "cursor-1",
        }),
      },
    });
  });

  it("should handle empty incomplete evaluations", async () => {
    const evaluator = asEvaluator({
      name: "correctness",
      kind: "CODE",
      evaluate: async () => ({ score: 1, label: "correct" }),
    });

    // Mock no incomplete evaluations
    mockClient.GET.mockImplementation((url: string) => {
      if (url.includes("incomplete-evaluations")) {
        return Promise.resolve({
          data: {
            data: [],
            next_cursor: null,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    await resumeEvaluation({
      experimentId: "exp-1",
      evaluators: [evaluator],
      client: mockClient,
    });

    // Should not submit any evaluation results
    expect(mockClient.POST).not.toHaveBeenCalled();
  });

  it("should respect custom pageSize", async () => {
    const evaluator = asEvaluator({
      name: "correctness",
      kind: "CODE",
      evaluate: async () => ({ score: 1, label: "correct" }),
    });

    await resumeEvaluation({
      experimentId: "exp-1",
      evaluators: [evaluator],
      pageSize: 25,
      client: mockClient,
    });

    // Should use custom pageSize in the query
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/experiments/{experiment_id}/incomplete-evaluations",
      expect.objectContaining({
        params: expect.objectContaining({
          query: expect.objectContaining({
            limit: 25,
          }),
        }),
      })
    );
  });

  it("should handle evaluator failures gracefully", async () => {
    const failingFn = vi.fn(async ({ output }: EvaluatorParams) => {
      const outputText = (output as { text?: string })?.text ?? "";
      if (outputText.includes("Alice")) {
        throw new Error("Evaluator failed for Alice");
      }
      return { score: 1, label: "correct" };
    });

    const failingEvaluator = asEvaluator({
      name: "correctness",
      kind: "CODE",
      evaluate: failingFn,
    });

    await resumeEvaluation({
      experimentId: "exp-1",
      evaluators: [failingEvaluator],
      client: mockClient,
    });

    // Evaluator should be called exactly once per incomplete evaluation, even for failures
    // Both runs need correctness evaluation, so 2 calls total (1 fails, 1 succeeds)
    expect(failingFn).toHaveBeenCalledTimes(2);

    // Should still attempt all evaluations even if some fail
    expect(mockClient.POST).toHaveBeenCalled();
  });

  it("should validate inputs", async () => {
    const evaluator = asEvaluator({
      name: "correctness",
      kind: "CODE",
      evaluate: async () => ({ score: 1, label: "correct" }),
    });

    // Empty evaluators array
    await expect(
      resumeEvaluation({
        experimentId: "exp-1",
        evaluators: [],
        client: mockClient,
      })
    ).rejects.toThrow("Must specify at least one evaluator");

    // Invalid pageSize
    await expect(
      resumeEvaluation({
        experimentId: "exp-1",
        evaluators: [evaluator],
        pageSize: 0,
        client: mockClient,
      })
    ).rejects.toThrow("pageSize must be a positive integer greater than 0");

    await expect(
      resumeEvaluation({
        experimentId: "exp-1",
        evaluators: [evaluator],
        pageSize: -1,
        client: mockClient,
      })
    ).rejects.toThrow("pageSize must be a positive integer greater than 0");
  });

  it("should respect custom concurrency", async () => {
    const evaluator = asEvaluator({
      name: "correctness",
      kind: "CODE",
      evaluate: async () => {
        // Small delay to test concurrency
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { score: 1, label: "correct" };
      },
    });

    const startTime = Date.now();
    await resumeEvaluation({
      experimentId: "exp-1",
      evaluators: [evaluator],
      concurrency: 10,
      client: mockClient,
    });
    const endTime = Date.now();

    // With high concurrency, should complete faster than sequential
    // This is a rough test, but should generally hold
    expect(endTime - startTime).toBeLessThan(100);
  });
});
