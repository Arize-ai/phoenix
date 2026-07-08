#!/usr/bin/env tsx
import { runSuite } from "./runner.js";

runSuite({
  dir: "evals/benchmarks",
  ext: ".benchmark.ts",
  label: "benchmark",
  pattern: process.argv[2],
}).catch((error) => {
  console.error("Fatal error:", error); // eslint-disable-line no-console
  process.exit(1);
});
