import { defineConfig } from "vitest/config";

// Load .env into the main process so the Phoenix reporter (which runs here)
// picks up PHOENIX_COLLECTOR_ENDPOINT / PHOENIX_API_KEY; workers inherit it.
import "dotenv/config";

export default defineConfig({
  test: {
    // Both the task eval (*.eval.ts) and the evaluator benchmark
    // (*.benchmark.ts) are Phoenix eval suites recorded by the reporter.
    include: ["evals/**/*.eval.ts", "evals/**/*.benchmark.ts"],
    reporters: ["default", "@arizeai/phoenix-client/vitest/reporter"],
    // dotenv loads .env for the test workers; the setup file registers Phoenix
    // tracing and flushes spans after each suite.
    setupFiles: ["dotenv/config", "./evals/vitest.setup.ts"],
    // The task eval calls the real agent (LLM + MCP tool loop), so runs are
    // network-bound and can take several seconds each.
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
