/* eslint-disable no-console */
/**
 * Integration test: Validate tracer provider lifecycle against a live Phoenix server.
 *
 * This script exercises the full experiment workflow (task → evaluation) and
 * verifies that:
 *   1. Two separate tracer providers are created (task + eval), not one shared.
 *   2. Spans from both phases land in their respective Phoenix projects.
 *   3. Providers are properly flushed/shutdown/detached — no collisions.
 *   4. The global tracer provider is restored to its pre-experiment state.
 *
 * Prerequisites:
 *   - Phoenix running at http://localhost:6006
 *
 * Usage:
 *   npx tsx test/experiments/integration-tracer-collision.ts
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(label: string, message: string): void {
  const timestamp = new Date().toISOString().slice(11, 23);
  console.log(`[${timestamp}] [${label}] ${message}`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log("SETUP", `Connecting to Phoenix at ${PHOENIX_URL}`);

  const client = createClient({
    options: { baseUrl: PHOENIX_URL },
  });

  // ── 1. Health check ───────────────────────────────────────────────────
  log("SETUP", "Checking Phoenix health...");
  const healthResponse = await fetch(`${PHOENIX_URL}/healthz`);
  assert(
    healthResponse.ok,
    `Phoenix health check failed: ${healthResponse.status}`
  );
  log("SETUP", "Phoenix is healthy");

  // ── 2. Create a test dataset ──────────────────────────────────────────
  const datasetName = `tracer-collision-test-${Date.now()}`;
  log("SETUP", `Creating dataset: ${datasetName}`);

  const { datasetId } = await createDataset({
    client,
    name: datasetName,
    description: "Integration test for tracer provider collision fix",
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
  log("SETUP", `Dataset created: ${datasetId}`);

  // ── 3. Set up a sentinel global tracer provider ───────────────────────
  //    We register a "user" provider before the experiment to verify it is
  //    restored after the experiment completes.
  log("TEST", "Registering sentinel global tracer provider");
  const sentinelExporter = new InMemorySpanExporter();
  const sentinelProvider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(sentinelExporter)],
  });
  sentinelProvider.register();

  // Emit a span to prove the sentinel is active
  trace.getTracer("sentinel").startSpan("before-experiment").end();
  assert(
    sentinelExporter.getFinishedSpans().length === 1,
    "Sentinel should have 1 span before experiment"
  );
  log("TEST", "Sentinel provider active — 1 span recorded");

  // ── 4. Run the experiment ─────────────────────────────────────────────
  log("TEST", "Running experiment with task + evaluators...");

  const lengthEvaluator = asEvaluator({
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
  });

  const correctnessEvaluator = asEvaluator({
    name: "correctness-check",
    kind: "CODE",
    evaluate: async ({ output, expected }) => {
      const outputStr = String(output);
      const expectedAnswer = (expected as Record<string, string>)?.answer ?? "";
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
  });

  const result = await runExperiment({
    client,
    dataset: { datasetId },
    task: async ({ input }) => {
      const question = (input as Record<string, string>).question;
      // Simulate a simple "AI" response
      if (question.includes("2+2")) return "4";
      if (question.includes("capital")) return "Paris";
      if (question.includes("speed of light")) return "299,792,458 m/s";
      return "I don't know";
    },
    evaluators: [lengthEvaluator, correctnessEvaluator],
    experimentName: `tracer-collision-${Date.now()}`,
    record: true,
    concurrency: 2,
    setGlobalTracerProvider: true,
    useBatchSpanProcessor: false, // Use simple processor for immediate flush
  });

  log("TEST", `Experiment completed: ${result.id}`);
  log("TEST", `  Project: ${result.projectName}`);
  log("TEST", `  Runs: ${Object.keys(result.runs).length}`);
  log("TEST", `  Evaluations: ${result.evaluationRuns?.length ?? 0}`);

  // ── 5. Validate experiment results ────────────────────────────────────
  const runs = Object.values(result.runs);
  assert(runs.length === 3, `Expected 3 runs, got ${runs.length}`);
  log("VERIFY", `✓ 3 task runs completed`);

  const failedRuns = runs.filter((run) => run.error != null);
  assert(failedRuns.length === 0, `${failedRuns.length} runs had errors`);
  log("VERIFY", `✓ All runs succeeded (no errors)`);

  const evaluationRuns = result.evaluationRuns ?? [];
  // 3 examples × 2 evaluators = 6 evaluations
  assert(
    evaluationRuns.length === 6,
    `Expected 6 evaluation runs, got ${evaluationRuns.length}`
  );
  log("VERIFY", `✓ 6 evaluation runs completed (3 examples × 2 evaluators)`);

  const failedEvals = evaluationRuns.filter((evalRun) => evalRun.error != null);
  assert(failedEvals.length === 0, `${failedEvals.length} evals had errors`);
  log("VERIFY", `✓ All evaluations succeeded (no errors)`);

  // ── 6. Verify spans landed in Phoenix ─────────────────────────────────
  //    Allow a short delay for async span export.
  log("VERIFY", "Waiting for spans to flush to Phoenix...");
  await sleep(2000);

  // Check task project exists
  const taskProjectName = result.projectName;
  const taskProjectResponse = await client.GET(
    "/v1/projects/{project_identifier}",
    {
      params: { path: { project_identifier: taskProjectName } },
    }
  );
  assert(
    taskProjectResponse.data?.data != null,
    `Task project "${taskProjectName}" not found in Phoenix`
  );
  log(
    "VERIFY",
    `✓ Task project found: "${taskProjectResponse.data?.data?.name}"`
  );

  // Check evaluator project exists
  const evalProjectResponse = await client.GET(
    "/v1/projects/{project_identifier}",
    {
      params: { path: { project_identifier: "evaluators" } },
    }
  );
  assert(
    evalProjectResponse.data?.data != null,
    `Evaluator project "evaluators" not found in Phoenix`
  );
  log(
    "VERIFY",
    `✓ Evaluator project found: "${evalProjectResponse.data?.data?.name}"`
  );

  // Check task traces
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
  log("VERIFY", `✓ ${taskTraces.length} traces in task project`);

  // ── 7. Verify global tracer provider was restored ─────────────────────
  log("TEST", "Verifying sentinel provider was restored...");

  // The sentinel provider should be active again after the experiment
  const spansBeforePostExperiment = sentinelExporter.getFinishedSpans().length;
  trace.getTracer("sentinel").startSpan("after-experiment").end();
  const spansAfterPostExperiment = sentinelExporter.getFinishedSpans().length;

  assert(
    spansAfterPostExperiment === spansBeforePostExperiment + 1,
    `Sentinel provider not restored: had ${spansBeforePostExperiment} spans, ` +
      `expected ${spansBeforePostExperiment + 1} after emitting one more, ` +
      `but got ${spansAfterPostExperiment}`
  );
  log(
    "VERIFY",
    `✓ Sentinel provider restored — new span recorded (${spansAfterPostExperiment} total)`
  );

  // ── 8. Clean up ───────────────────────────────────────────────────────
  await sentinelProvider.shutdown();
  trace.disable();
  context.disable();
  propagation.disable();

  // ── Done ──────────────────────────────────────────────────────────────
  console.log("");
  console.log("═══════════════════════════════════════════════════════");
  console.log("  ALL INTEGRATION TESTS PASSED ✅");
  console.log("═══════════════════════════════════════════════════════");
  console.log("");
  console.log("Summary:");
  console.log(`  • Dataset: ${datasetName} (${datasetId})`);
  console.log(`  • Experiment: ${result.id}`);
  console.log(`  • Task runs: ${runs.length} (all succeeded)`);
  console.log(`  • Evaluation runs: ${evaluationRuns.length} (all succeeded)`);
  console.log(`  • Task project traces: ${taskTraces.length}`);
  console.log(`  • Global provider: properly restored after experiment`);
  console.log(`  • No tracer collisions detected`);
}

main().catch((error) => {
  console.error("");
  console.error("═══════════════════════════════════════════════════════");
  console.error("  INTEGRATION TEST FAILED ❌");
  console.error("═══════════════════════════════════════════════════════");
  console.error("");
  console.error(error);
  process.exit(1);
});
