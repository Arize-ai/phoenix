/**
 * Task eval: does the live agent format its answers for the terminal?
 *
 * START HERE if you're new to these evals — this is the simplest suite to read.
 * It is a plain Vitest test file: there is no runner script. `pnpm eval` hands
 * Vitest the `evals/**` glob (see vitest.config.ts), Vitest discovers every
 * `*.eval.ts` / `*.benchmark.ts` file, and the Phoenix reporter records each
 * case as an experiment run. So this file IS the entrypoint.
 *
 * The flow of one case:
 *   1. px.test.each(...)   — one dataset example per row (the agent's input)
 *   2. runInteraction(...) — call the real agent and capture its answer
 *   3. px.logOutput(...)   — record that answer as the run's output
 *   4. px.evaluate(judge)  — score the answer with the terminal-safe-format judge
 *   5. acceptanceCriteria  — after all cases, gate the suite on the aggregate
 *
 * We gate on aggregate criteria rather than asserting per case, because an LLM
 * occasionally slips — fail CI on a trend, not on a single imperfect response.
 *
 * Run this suite:
 *   pnpm eval:task        — just this file, recorded to Phoenix
 *   pnpm eval             — every eval + benchmark suite
 *   pnpm eval:offline     — run without recording (PHOENIX_TEST_TRACKING=false)
 */
import * as px from "@arizeai/phoenix-client/vitest";

import { agent } from "../../src/agents/index.js";
import { runInteraction } from "../../src/ui/interaction.js";
import { terminalFormatDataset } from "../datasets/index.js";
import { createTerminalSafeFormatEvaluator } from "../evaluators/index.js";

// The classification judge issues an LLM call per case, so build it once and
// reuse it across the suite.
const judge = createTerminalSafeFormatEvaluator();

// Each dataset example carries a prompt; the canned `output`/`metadata` belong
// to the benchmark and are ignored here — the agent generates a fresh answer.
const cases = terminalFormatDataset.examples.map((example, i) => ({
  id: `${(example.metadata?.category as string) ?? "case"}-${i}`,
  input: example.input as { prompt: string },
}));

px.describe(
  "cli-agent terminal format",
  () => {
    px.test.each(cases)(
      (row) => row.id ?? "case",
      async ({ input }) => {
        const start = performance.now();
        const { text } = await runInteraction({ input: input.prompt, agent });
        const latencyMs = performance.now() - start;

        px.logOutput({ response: text });

        px.logAnnotation({
          name: "latency_ms",
          score: latencyMs,
          annotatorKind: "CODE",
        });

        // The judge's prompt template interpolates {{output}} as a string, so
        // pass the response text explicitly rather than the logged object.
        await px.evaluate(await judge, { output: text });
      }
    );
  },
  {
    datasetName: terminalFormatDataset.name,
    description: terminalFormatDataset.description,
    acceptanceCriteria: [
      // At least 70% of answers must be terminal-safe (judged "compliant").
      // The agent reliably clears this; the recurring misses are indented "•"
      // bullets the judge sometimes over-flags (the benchmark measures that
      // judge noise), which leaves headroom for a real regression to fail CI
      // rather than passing silently.
      {
        annotationName: "terminal-safe-format",
        metric: "passRate",
        passFn: (a) => a.score === 1,
        minPassRate: 0.7,
      },
      // Keep the agent responsive: mean latency under 30s (LLM + MCP tool loop).
      {
        annotationName: "latency_ms",
        metric: "average",
        threshold: 30_000,
        direction: "minimize",
      },
    ],
  }
);
