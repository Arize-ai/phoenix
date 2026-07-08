#!/usr/bin/env tsx
import { runSuite } from "./runner.js";

runSuite({
  dir: "evals/experiments",
  ext: ".eval.ts",
  label: "evaluation",
  pattern: process.argv[2],
}).catch((error) => {
  console.error("Fatal error:", error); // eslint-disable-line no-console
  process.exit(1);
});
