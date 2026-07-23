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
import { resumeExperiment } from "../../src/experiments/resumeExperiment";
import type { Example } from "../../src/types/datasets";
import { createTestClient } from "../testUtils";

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

type IncompleteExperimentRun =
  componentsV1["schemas"]["IncompleteExperimentRun"];
type IncompleteExperimentEvaluation =
  componentsV1["schemas"]["IncompleteExperimentEvaluation"];
type CreateExperimentRunRequestBody =
  componentsV1["schemas"]["CreateExperimentRunRequestBody"];
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

const aliceIncompleteRun: IncompleteExperimentRun = {
  dataset_example: {
    id: "ex-1",
    node_id: "ex-1",
    input: { name: "Alice" },
    output: { text: "Hello, Alice!" },
    metadata: {},
    updated_at: new Date().toISOString(),
  },
  repetition_numbers: [1, 2],
};

const bobIncompleteRun: IncompleteExperimentRun = {
  dataset_example: {
    id: "ex-2",
    node_id: "ex-2",
    input: { name: "Bob" },
    output: { text: "Hello, Bob!" },
    metadata: {},
    updated_at: new Date().toISOString(),
  },
  repetition_numbers: [1],
};

const mockIncompleteRuns: IncompleteExperimentRun[] = [
  aliceIncompleteRun,
  bobIncompleteRun,
];

/**
 * Serves incomplete-runs pages in order. Each page's `next_cursor` is the
 * index of the following page, so the handler can resolve any cursor the
 * client sends back. Captures the cursors and path params it receives.
 */
function serveIncompleteRunPages(pages: readonly IncompleteExperimentRun[][]) {
  const receivedCursors: (string | null)[] = [];
  const receivedExperimentIds: string[] = [];
  server.use(
    http.get(
      "/v1/experiments/{experiment_id}/incomplete-runs",
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
 * Captures every experiment run submission, echoing back a created run.
 */
function captureExperimentRunPosts() {
  const receivedBodies: CreateExperimentRunRequestBody[] = [];
  const receivedExperimentIds: string[] = [];
  server.use(
    http.post(
      "/v1/experiments/{experiment_id}/runs",
      async ({ params, request, response }) => {
        receivedExperimentIds.push(params.experiment_id);
        receivedBodies.push(await request.json());
        return response(200).json({ data: { id: "run-123" } });
      }
    )
  );
  return { receivedBodies, receivedExperimentIds };
}

/**
 * Serves a single page of incomplete evaluations and counts how many times
 * the endpoint is fetched.
 */
function serveIncompleteEvaluations(
  incompleteEvaluations: readonly IncompleteExperimentEvaluation[]
) {
  let fetchCount = 0;
  server.use(
    http.get(
      "/v1/experiments/{experiment_id}/incomplete-evaluations",
      ({ response }) => {
        fetchCount++;
        return response(200).json({
          data: [...incompleteEvaluations],
          next_cursor: null,
        });
      }
    )
  );
  return { getFetchCount: () => fetchCount };
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

describe("resumeExperiment", () => {
  let client: PhoenixClient;
  let incompleteRunRequests: ReturnType<typeof serveIncompleteRunPages>;
  let experimentRunPosts: ReturnType<typeof captureExperimentRunPosts>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getExperimentInfo
    vi.spyOn(getExperimentInfoModule, "getExperimentInfo").mockResolvedValue(
      mockExperimentInfo
    );

    client = createTestClient();

    // Default handlers: a single page of incomplete runs and a capture of
    // submitted experiment runs. Tests can override with server.use().
    incompleteRunRequests = serveIncompleteRunPages([mockIncompleteRuns]);
    experimentRunPosts = captureExperimentRunPosts();
  });

  it("should resume incomplete runs with a simple task", async () => {
    const taskFn = vi.fn(
      async (example: Example) => `Hello, ${example.input.name}!`
    );

    await resumeExperiment({
      experimentId: "exp-1",
      task: taskFn,
      client,
    });

    // Task should be called exactly once per incomplete run (3 total)
    expect(taskFn).toHaveBeenCalledTimes(3);

    // Should fetch experiment info
    expect(getExperimentInfoModule.getExperimentInfo).toHaveBeenCalledWith({
      client,
      experimentId: "exp-1",
    });

    // Should fetch incomplete runs
    expect(incompleteRunRequests.receivedExperimentIds).toEqual(["exp-1"]);

    // Should submit experiment runs (3 total: 2 for ex-1, 1 for ex-2)
    expect(experimentRunPosts.receivedBodies).toHaveLength(3);
    expect(experimentRunPosts.receivedExperimentIds).toEqual([
      "exp-1",
      "exp-1",
      "exp-1",
    ]);
  });

  it("should handle pagination of incomplete runs", async () => {
    const taskFn = vi.fn(
      async (example: Example) => `Hello, ${example.input.name}!`
    );

    // Pagination: first page returns a cursor, second returns no cursor
    const pagedRequests = serveIncompleteRunPages([
      [aliceIncompleteRun],
      [bobIncompleteRun],
    ]);

    await resumeExperiment({
      experimentId: "exp-1",
      task: taskFn,
      client,
    });

    // Task should be called exactly once per incomplete run (3 total)
    expect(taskFn).toHaveBeenCalledTimes(3);

    // Should fetch incomplete runs twice (pagination)
    expect(pagedRequests.receivedCursors).toHaveLength(2);

    // Second call should include the cursor returned by the first page
    expect(pagedRequests.receivedCursors[1]).toBe("1");
  });

  it("should handle empty incomplete runs", async () => {
    const taskFn = vi.fn(
      async (example: Example) => `Hello, ${example.input.name}!`
    );

    // No incomplete runs
    serveIncompleteRunPages([[]]);

    await resumeExperiment({
      experimentId: "exp-1",
      task: taskFn,
      client,
    });

    // Task should never be called when there are no incomplete runs
    expect(taskFn).not.toHaveBeenCalled();

    // Should not submit any experiment runs
    expect(experimentRunPosts.receivedBodies).toHaveLength(0);
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
      client,
    });

    // Task should be called exactly once per incomplete run, even for failures (3 total)
    expect(taskFn).toHaveBeenCalledTimes(3);

    // Should still attempt all runs even if some fail
    expect(experimentRunPosts.receivedBodies.length).toBeGreaterThan(0);
  });

  it("should only evaluate incomplete evaluations, not all runs", async () => {
    const taskFn = vi.fn(async (example: Example) => ({
      text: `Hello, ${example.input.name}!`,
    }));
    const evaluatorFn = vi.fn(async ({ output, expected }) => ({
      score: output === expected ? 1 : 0,
      label: output === expected ? "correct" : "incorrect",
    }));

    // Incomplete evaluations: only 1 out of 3 completed runs needs evaluation
    const incompleteEvaluationRequests = serveIncompleteEvaluations([
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
          node_id: "ex-1",
          input: { name: "Alice" },
          output: { text: "Hello, Alice!" },
          metadata: {},
          updated_at: new Date().toISOString(),
        },
        evaluation_names: ["correctness"],
      },
    ]);
    const evaluationPosts = captureEvaluationPosts();

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
      client,
    });

    // Task should be called for all 3 incomplete runs
    expect(taskFn).toHaveBeenCalledTimes(3);

    // Evaluator should only be called for 1 incomplete evaluation, not all 3 runs
    // This proves we're using resumeEvaluation, not evaluateExperiment
    expect(evaluatorFn).toHaveBeenCalledTimes(1);

    // Should fetch incomplete evaluations (confirms resumeEvaluation was called)
    expect(incompleteEvaluationRequests.getFetchCount()).toBe(1);

    // Should post the evaluation result for the 1 incomplete evaluation
    expect(evaluationPosts.receivedBodies).toHaveLength(1);
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
          client,
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
        client,
      });

      expect(taskFn).toHaveBeenCalledTimes(3);
    });

    it("should stop fetching new pages when stopOnFirstError is triggered", async () => {
      // Create more data to ensure pagination
      const largeDataset: IncompleteExperimentRun[] = Array.from(
        { length: 100 },
        (_unused, exampleIndex) => ({
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
          repetition_numbers: [1],
        })
      );

      // Pagination with multiple pages, sliced by the requested limit
      let pageCount = 0;
      server.use(
        http.get(
          "/v1/experiments/{experiment_id}/incomplete-runs",
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

      const taskFn = createFailingTask();

      await expect(
        resumeExperiment({
          experimentId: "exp-1",
          task: taskFn,
          stopOnFirstError: true,
          client,
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
          client,
        })
      ).rejects.toThrow();

      expect(experimentRunPosts.receivedBodies).toContainEqual(
        expect.objectContaining({
          error: "Task failed for Alice",
        })
      );
    });

    it("should stop all concurrent workers when one fails", async () => {
      const taskOrder: string[] = [];

      const taskFn = vi.fn(async (example: Example) => {
        // resumeExperiment always passes examples that carry an id
        if (example.id != null) {
          taskOrder.push(example.id);
        }

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
          client,
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

      const incompleteEvaluationRequests = serveIncompleteEvaluations([]);
      captureEvaluationPosts();

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
          client,
        })
      ).rejects.toThrow();

      expect(evaluatorFn).not.toHaveBeenCalled();

      // Should never fetch incomplete evaluations
      expect(incompleteEvaluationRequests.getFetchCount()).toBe(0);
    });

    it("should default to stopOnFirstError = false", async () => {
      const taskFn = createFailingTask();

      await resumeExperiment({
        experimentId: "exp-1",
        task: taskFn,
        client,
      });

      expect(taskFn).toHaveBeenCalledTimes(3);
    });
  });
});
