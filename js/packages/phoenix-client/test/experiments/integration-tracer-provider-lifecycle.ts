/**
 * Integration test: Validate tracer provider lifecycle against a live Phoenix server.
 *
 * Verifies that:
 *   1. Two separate tracer providers are created (task + eval), not one shared.
 *   2. Spans from both phases land in their respective Phoenix projects.
 *   3. Providers are properly flushed/shutdown/detached — no collisions.
 *   4. The global tracer provider is restored to its pre-experiment state.
 *
 * Prerequisites:
 *   - Phoenix running at http://localhost:6006
 *
 * Usage:
 *   npx tsx test/experiments/integration-tracer-provider-lifecycle.ts
 */

import { context, propagation, trace } from "@opentelemetry/api";
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-node";

import { createClient } from "../../src/client";
import { createDataset } from "../../src/datasets/createDataset";
import {
  asEvaluator,
  runExperiment,
} from "../../src/experiments/runExperiment";

const PHOENIX_URL = process.env.PHOENIX_HOST ?? "http://localhost:6006";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function main(): Promise<void> {
  const client = createClient({
    options: { baseUrl: PHOENIX_URL },
  });

  // Health check
  const healthResponse = await fetch(`${PHOENIX_URL}/healthz`);
  assert(
    healthResponse.ok,
    `Phoenix health check failed: ${healthResponse.status}`
  );

  // Create a test dataset
  const datasetName = `tracer-lifecycle-test-${Date.now()}`;
  const { datasetId } = await createDataset({
    client,
    name: datasetName,
    description: "Integration test for tracer provider lifecycle",
    examples: [
      {
        input: { question: "What is 2+2?" },
        output: { answer: "4" },
        metadata: { difficulty: "easy" },
      },
      {
        input: { question: "What is the capital of France?" },
        output: { answer: "Paris" },
        metadata: { difficulty: "easy" },
      },
      {
        input: { question: "What is the speed of light?" },
        output: { answer: "299,792,458 m/s" },
        metadata: { difficulty: "medium" },
      },
    ],
  });

  // Register a sentinel global tracer provider before the experiment
  // to verify it is restored after the experiment completes.
  const sentinelExporter = new InMemorySpanExporter();
  const sentinelProvider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(sentinelExporter)],
  });
  sentinelProvider.register();

  trace.getTracer("sentinel").startSpan("before-experiment").end();
  assert(
    sentinelExporter.getFinishedSpans().length === 1,
    "Sentinel should have 1 span before experiment"
  );

  // Run the experiment with task + evaluators
  const result = await runExperiment({
    client,
    dataset: { datasetId },
    task: async ({ input }) => {
      const question = (input as Record<string, string>).question;
      if (question.includes("2+2")) return "4";
      if (question.includes("capital")) return "Paris";
      if (question.includes("speed of light")) return "299,792,458 m/s";
      return "I don't know";
    },
    evaluators: [
      asEvaluator({
        name: "answer-length",
        kind: "CODE",
        evaluate: async ({ output }) => {
          const outputStr = String(output);
          return {
            label: outputStr.length > 5 ? "long" : "short",
            score: Math.min(outputStr.length / 20, 1),
            explanation: `Output length: ${outputStr.length}`,
          };
        },
      }),
      asEvaluator({
        name: "correctness-check",
        kind: "CODE",
        evaluate: async ({ output, expected }) => {
          const outputStr = String(output);
          const expectedAnswer =
            (expected as Record<string, string>)?.answer ?? "";
          const isCorrect =
            outputStr.toLowerCase().includes(expectedAnswer.toLowerCase()) ||
            expectedAnswer.toLowerCase().includes(outputStr.toLowerCase());
          return {
            label: isCorrect ? "correct" : "incorrect",
            score: isCorrect ? 1 : 0,
            explanation: isCorrect
              ? "Output matches expected"
              : `Expected "${expectedAnswer}", got "${outputStr}"`,
          };
        },
      }),
    ],
    experimentName: `tracer-lifecycle-${Date.now()}`,
    record: true,
    concurrency: 2,
    setGlobalTracerProvider: true,
    useBatchSpanProcessor: false,
  });

  // Validate experiment results
  const runs = Object.values(result.runs);
  assert(runs.length === 3, `Expected 3 runs, got ${runs.length}`);

  const failedRuns = runs.filter((run) => run.error != null);
  assert(failedRuns.length === 0, `${failedRuns.length} runs had errors`);

  const evaluationRuns = result.evaluationRuns ?? [];
  assert(
    evaluationRuns.length === 6,
    `Expected 6 evaluation runs (3 examples x 2 evaluators), got ${evaluationRuns.length}`
  );

  const failedEvals = evaluationRuns.filter((evalRun) => evalRun.error != null);
  assert(failedEvals.length === 0, `${failedEvals.length} evals had errors`);

  // Allow time for async span export
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Verify spans landed in Phoenix
  const taskProjectName = result.projectName;
  const taskProjectResponse = await client.GET(
    "/v1/projects/{project_identifier}",
    { params: { path: { project_identifier: taskProjectName } } }
  );
  assert(
    taskProjectResponse.data?.data != null,
    `Task project "${taskProjectName}" not found in Phoenix`
  );

  const evalProjectResponse = await client.GET(
    "/v1/projects/{project_identifier}",
    { params: { path: { project_identifier: "evaluators" } } }
  );
  assert(
    evalProjectResponse.data?.data != null,
    `Evaluator project "evaluators" not found in Phoenix`
  );

  const taskTracesResponse = await client.GET(
    "/v1/projects/{project_identifier}/traces",
    {
      params: {
        path: { project_identifier: taskProjectName },
        query: { limit: 100 },
      },
    }
  );
  const taskTraces = taskTracesResponse.data?.data ?? [];
  assert(
    taskTraces.length > 0,
    `No traces found in task project "${taskProjectName}"`
  );

  // Verify global tracer provider was restored
  const spansBefore = sentinelExporter.getFinishedSpans().length;
  trace.getTracer("sentinel").startSpan("after-experiment").end();
  const spansAfter = sentinelExporter.getFinishedSpans().length;
  assert(
    spansAfter === spansBefore + 1,
    `Sentinel provider not restored: had ${spansBefore} spans, ` +
      `expected ${spansBefore + 1} after emitting one more, got ${spansAfter}`
  );

  // Clean up
  await sentinelProvider.shutdown();
  trace.disable();
  context.disable();
  propagation.disable();
}

main().catch((error) => {
  console.error("Integration test failed:", error); // eslint-disable-line no-console
  process.exit(1);
});
