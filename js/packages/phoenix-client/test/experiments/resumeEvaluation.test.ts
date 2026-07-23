import type * as PhoenixOtel from "@arizeai/phoenix-otel";
import { type componentsV1, createHttp } from "@arizeai/phoenix-testing";
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

import type { PhoenixClient } from "../../src/client";
import * as getExperimentInfoModule from "../../src/experiments/getExperimentInfo";
import { asExperimentEvaluator } from "../../src/experiments/helpers";
import { resumeEvaluation } from "../../src/experiments/resumeEvaluation";
import type { EvaluatorParams } from "../../src/types/experiments";
import { createTestClient } from "../testUtils";

/**
 * Reads a `text` field from a loosely-typed task output or expected value,
 * returning an empty string when absent.
 */
function textOf(value: unknown): string {
  if (typeof value === "object" && value !== null && "text" in value) {
    return String(value.text);
  }
  return "";
}

vi.mock("@arizeai/phoenix-otel", async (importOriginal) => ({
  ...(await importOriginal<typeof PhoenixOtel>()),
  attachGlobalTracerProvider: vi.fn(() => ({
    detach: vi.fn(),
  })),
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
    shutdown: vi.fn(() => Promise.resolve()),
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

type IncompleteExperimentEvaluation =
  componentsV1["schemas"]["IncompleteExperimentEvaluation"];
type UpsertExperimentEvaluationRequestBody =
  componentsV1["schemas"]["UpsertExperimentEvaluationRequestBody"];

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

const aliceIncompleteEvaluation: IncompleteExperimentEvaluation = {
  experiment_run: {
    id: "run-1",
    experiment_id: "exp-1",
    dataset_example_id: "ex-1",
    repetition_number: 1,
    output: { text: "Hello, Alice!" },
    start_time: new Date().toISOString(),
    end_time: new Date().toISOString(),
    error: null,
    trace_id: "task-trace-id-1",
  },
  dataset_example: {
    id: "ex-1",
    node_id: "ex-1",
    input: { name: "Alice" },
    output: { text: "Hello, Alice!" },
    metadata: {},
    updated_at: new Date().toISOString(),
  },
  evaluation_names: ["correctness", "relevance"],
};

const bobIncompleteEvaluation: IncompleteExperimentEvaluation = {
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
    node_id: "ex-2",
    input: { name: "Bob" },
    output: { text: "Hello, Bob!" },
    metadata: {},
    updated_at: new Date().toISOString(),
  },
  evaluation_names: ["correctness"],
};

const mockIncompleteEvaluations: IncompleteExperimentEvaluation[] = [
  aliceIncompleteEvaluation,
  bobIncompleteEvaluation,
];

/**
 * Serves incomplete-evaluations pages in order. Each page's `next_cursor` is
 * the index of the following page, so the handler can resolve any cursor the
 * client sends back. Captures the cursors and path params it receives.
 */
function serveIncompleteEvaluationPages(
  pages: readonly IncompleteExperimentEvaluation[][]
) {
  const receivedCursors: (string | null)[] = [];
  const receivedExperimentIds: string[] = [];
  server.use(
    http.get(
      "/v1/experiments/{experiment_id}/incomplete-evaluations",
      ({ params, query, response }) => {
        receivedExperimentIds.push(params.experiment_id);
        const cursor = query.get("cursor");
        receivedCursors.push(cursor);
        const pageIndex = cursor === null ? 0 : Number(cursor);
        const hasNextPage = pageIndex + 1 < pages.length;
        return response(200).json({
          data: pages[pageIndex] ?? [],
          next_cursor: hasNextPage ? String(pageIndex + 1) : null,
        });
      }
    )
  );
  return { receivedCursors, receivedExperimentIds };
}

/**
 * Captures every evaluation submission, echoing back a created evaluation.
 */
function captureEvaluationPosts() {
  const receivedBodies: UpsertExperimentEvaluationRequestBody[] = [];
  server.use(
    http.post("/v1/experiment_evaluations", async ({ request, response }) => {
      receivedBodies.push(await request.json());
      return response(200).json({ data: { id: "eval-123" } });
    })
  );
  return { receivedBodies };
}

describe("resumeEvaluation", () => {
  let client: PhoenixClient;
  let incompleteEvaluationRequests: ReturnType<
    typeof serveIncompleteEvaluationPages
  >;
  let evaluationPosts: ReturnType<typeof captureEvaluationPosts>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getExperimentInfo
    vi.spyOn(getExperimentInfoModule, "getExperimentInfo").mockResolvedValue(
      mockExperimentInfo
    );

    client = createTestClient();

    // Default handlers: a single page of incomplete evaluations and a capture
    // of submitted evaluation results. Tests can override with server.use().
    incompleteEvaluationRequests = serveIncompleteEvaluationPages([
      mockIncompleteEvaluations,
    ]);
    evaluationPosts = captureEvaluationPosts();
  });

  it("should resume incomplete evaluations with single-output evaluators", async () => {
    const correctnessFn = vi.fn(
      async ({ output, expected }: EvaluatorParams) => {
        const expectedText = textOf(expected);
        const outputText = textOf(output);
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

    const correctnessEvaluator = asExperimentEvaluator({
      name: "correctness",
      kind: "CODE",
      evaluate: correctnessFn,
    });

    const relevanceEvaluator = asExperimentEvaluator({
      name: "relevance",
      kind: "LLM",
      evaluate: relevanceFn,
    });

    await resumeEvaluation({
      experimentId: "exp-1",
      evaluators: [correctnessEvaluator, relevanceEvaluator],
      client,
    });

    // Each evaluator should be called exactly once per matching incomplete evaluation
    // correctness: 2 times (run-1 and run-2 both need it)
    // relevance: 1 time (only run-1 needs it)
    expect(correctnessFn).toHaveBeenCalledTimes(2);
    expect(relevanceFn).toHaveBeenCalledTimes(1);

    // Verify traceId is passed through to evaluators
    expect(correctnessFn).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: "task-trace-id-1" })
    );
    expect(relevanceFn).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: "task-trace-id-1" })
    );

    // Should fetch experiment info
    expect(getExperimentInfoModule.getExperimentInfo).toHaveBeenCalledWith({
      client,
      experimentId: "exp-1",
    });

    // Should fetch incomplete evaluations
    expect(incompleteEvaluationRequests.receivedExperimentIds).toEqual([
      "exp-1",
    ]);

    // Should submit evaluation results
    // run-1 needs: correctness, relevance (2 evals)
    // run-2 needs: correctness (1 eval)
    // Total: 3 evaluations
    expect(evaluationPosts.receivedBodies).toHaveLength(3);
    for (const receivedBody of evaluationPosts.receivedBodies) {
      expect(receivedBody).toEqual(
        expect.objectContaining({
          experiment_run_id: expect.any(String),
          name: expect.any(String),
          annotator_kind: expect.any(String),
        })
      );
    }
  });

  it("should handle pagination of incomplete evaluations", async () => {
    const evaluator = asExperimentEvaluator({
      name: "correctness",
      kind: "CODE",
      evaluate: async () => ({ score: 1, label: "correct" }),
    });

    // Pagination: first page returns a cursor, second returns no cursor
    const pagedRequests = serveIncompleteEvaluationPages([
      [aliceIncompleteEvaluation],
      [bobIncompleteEvaluation],
    ]);

    await resumeEvaluation({
      experimentId: "exp-1",
      evaluators: [evaluator],
      client,
    });

    // Should fetch incomplete evaluations twice (pagination)
    expect(pagedRequests.receivedCursors).toHaveLength(2);

    // Second call should include the cursor returned by the first page
    expect(pagedRequests.receivedCursors[1]).toBe("1");
  });

  it("should handle empty incomplete evaluations", async () => {
    const evaluator = asExperimentEvaluator({
      name: "correctness",
      kind: "CODE",
      evaluate: async () => ({ score: 1, label: "correct" }),
    });

    // No incomplete evaluations
    serveIncompleteEvaluationPages([[]]);

    await resumeEvaluation({
      experimentId: "exp-1",
      evaluators: [evaluator],
      client,
    });

    // Should not submit any evaluation results
    expect(evaluationPosts.receivedBodies).toHaveLength(0);
  });

  it("should handle evaluator failures gracefully", async () => {
    const failingFn = vi.fn(async ({ output }: EvaluatorParams) => {
      const outputText = textOf(output);
      if (outputText.includes("Alice")) {
        throw new Error("Evaluator failed for Alice");
      }
      return { score: 1, label: "correct" };
    });

    const failingEvaluator = asExperimentEvaluator({
      name: "correctness",
      kind: "CODE",
      evaluate: failingFn,
    });

    await resumeEvaluation({
      experimentId: "exp-1",
      evaluators: [failingEvaluator],
      client,
    });

    // Evaluator should be called exactly once per incomplete evaluation, even for failures
    // Both runs need correctness evaluation, so 2 calls total (1 fails, 1 succeeds)
    expect(failingFn).toHaveBeenCalledTimes(2);

    // Should still attempt all evaluations even if some fail
    expect(evaluationPosts.receivedBodies.length).toBeGreaterThan(0);
  });

  it("should validate inputs", async () => {
    // Empty evaluators array
    await expect(
      resumeEvaluation({
        experimentId: "exp-1",
        evaluators: [],
        client,
      })
    ).rejects.toThrow("Must specify at least one evaluator");
  });

  it("should respect custom concurrency", async () => {
    const evaluator = asExperimentEvaluator({
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
      client,
    });
    const endTime = Date.now();

    // With high concurrency, should complete faster than sequential
    // This is a rough test, but should generally hold
    expect(endTime - startTime).toBeLessThan(100);
  });

  describe("stopOnFirstError", () => {
    // Test helper: creates an evaluator that fails for Alice
    const createFailingEvaluator = (name = "correctness") => {
      const evaluateFn = vi.fn(async ({ output }: EvaluatorParams) => {
        const outputText = textOf(output);
        if (outputText.includes("Alice")) {
          throw new Error("Evaluator failed for Alice");
        }
        return { score: 1, label: "correct" };
      });

      return {
        evaluator: asExperimentEvaluator({
          name,
          kind: "CODE" as const,
          evaluate: evaluateFn,
        }),
        evaluateFn,
      };
    };

    it("should stop on first error when stopOnFirstError is true", async () => {
      const { evaluator, evaluateFn } = createFailingEvaluator();

      await expect(
        resumeEvaluation({
          experimentId: "exp-1",
          evaluators: [evaluator],
          stopOnFirstError: true,
          client,
        })
      ).rejects.toThrow("Evaluator failed for Alice");

      expect(evaluateFn).toHaveBeenCalled();
    });

    it("should continue processing when stopOnFirstError is false (default)", async () => {
      const { evaluator, evaluateFn } = createFailingEvaluator();

      await resumeEvaluation({
        experimentId: "exp-1",
        evaluators: [evaluator],
        stopOnFirstError: false,
        client,
      });

      expect(evaluateFn).toHaveBeenCalledTimes(2);
    });

    it("should stop fetching new pages when stopOnFirstError is triggered", async () => {
      // Create more data to ensure pagination
      const largeDataset: IncompleteExperimentEvaluation[] = Array.from(
        { length: 100 },
        (_unused, exampleIndex) => ({
          experiment_run: {
            id: `run-${exampleIndex}`,
            experiment_id: "exp-1",
            dataset_example_id: `ex-${exampleIndex}`,
            repetition_number: 1,
            output: {
              text: exampleIndex === 0 ? "Hello, Alice!" : "Hello, Bob!",
            },
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            error: null,
            trace_id: null,
          },
          dataset_example: {
            id: `ex-${exampleIndex}`,
            node_id: `ex-${exampleIndex}`,
            input: { name: exampleIndex === 0 ? "Alice" : "Bob" },
            output: {
              text: `Hello, ${exampleIndex === 0 ? "Alice" : "Bob"}!`,
            },
            metadata: {},
            updated_at: new Date().toISOString(),
          },
          evaluation_names: ["correctness"],
        })
      );

      // Pagination with multiple pages, sliced by the requested limit
      let pageCount = 0;
      server.use(
        http.get(
          "/v1/experiments/{experiment_id}/incomplete-evaluations",
          ({ query, response }) => {
            pageCount++;
            const limitParam = query.get("limit");
            const limit = limitParam === null ? 50 : Number(limitParam);
            const cursor = query.get("cursor");
            const startIndex = cursor === null ? 0 : Number(cursor);
            const endIndex = Math.min(startIndex + limit, largeDataset.length);

            return response(200).json({
              data: largeDataset.slice(startIndex, endIndex),
              next_cursor:
                endIndex < largeDataset.length ? String(endIndex) : null,
            });
          }
        )
      );

      const { evaluator } = createFailingEvaluator();

      await expect(
        resumeEvaluation({
          experimentId: "exp-1",
          evaluators: [evaluator],
          stopOnFirstError: true,
          client,
        })
      ).rejects.toThrow("Evaluator failed for Alice");

      expect(pageCount).toBeLessThan(3);
    });

    it("should record failed evaluations even when stopping early", async () => {
      const { evaluator } = createFailingEvaluator();

      await expect(
        resumeEvaluation({
          experimentId: "exp-1",
          evaluators: [evaluator],
          stopOnFirstError: true,
          client,
        })
      ).rejects.toThrow();

      expect(evaluationPosts.receivedBodies).toContainEqual(
        expect.objectContaining({
          error: "Evaluator failed for Alice",
        })
      );
    });

    it("should stop all concurrent workers when one fails", async () => {
      const evaluationOrder: string[] = [];

      const failingFn = vi.fn(async ({ output }: EvaluatorParams) => {
        const outputText = textOf(output);
        const runId = outputText.includes("Alice") ? "run-1" : "run-2";
        evaluationOrder.push(runId);

        // Add slight delay to ensure concurrency
        await new Promise((resolve) => setTimeout(resolve, 5));

        if (outputText.includes("Alice")) {
          throw new Error("Evaluator failed for Alice");
        }
        return { score: 1, label: "correct" };
      });

      const failingEvaluator = asExperimentEvaluator({
        name: "correctness",
        kind: "CODE",
        evaluate: failingFn,
      });

      try {
        await resumeEvaluation({
          experimentId: "exp-1",
          evaluators: [failingEvaluator],
          stopOnFirstError: true,
          concurrency: 5,
          client,
        });
      } catch {
        // Expected to throw
      }

      // Should not process all runs
      expect(evaluationOrder.length).toBeLessThanOrEqual(2);
    });

    it("should default to stopOnFirstError = false", async () => {
      const { evaluator, evaluateFn } = createFailingEvaluator();

      await resumeEvaluation({
        experimentId: "exp-1",
        evaluators: [evaluator],
        client,
      });

      expect(evaluateFn).toHaveBeenCalledTimes(2);
    });
  });
});
