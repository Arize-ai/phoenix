#!/usr/bin/env tsx
/* eslint-disable no-console */
import { createClient } from "@arizeai/phoenix-client";

import { flush } from "../src/instrumentation.js";

import { glob } from "glob";
import { spawn } from "node:child_process";
import path from "node:path";

async function discoverEvaluations(pattern?: string) {
  const searchPattern = pattern
    ? `evals/experiments/*${pattern}*.eval.ts`
    : "evals/experiments/*.eval.ts";

  const evalFiles = await glob(searchPattern, {
    cwd: process.cwd(),
    absolute: true,
  });

  return evalFiles.map((file) => ({
    id: path.basename(file, ".eval.ts"),
    file,
    name: path.basename(file, ".eval.ts"),
  }));
}

function runEvaluation(
  file: string
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn("tsx", [file], {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    child.on("exit", (code) => {
      resolve({
        success: code === 0,
        output: "",
      });
    });

    child.on("error", (error) => {
      console.error(`Failed to run ${file}:`, error);
      resolve({
        success: false,
        output: error.message,
      });
    });
  });
}

async function main() {
  const pattern = process.argv[2];

  console.log(
    pattern
      ? `\nRunning evaluations matching: ${pattern}\n`
      : "\nRunning all evaluations\n"
  );

  const evaluations = await discoverEvaluations(pattern);

  if (evaluations.length === 0) {
    console.error(
      pattern
        ? `No evaluations found matching: ${pattern}`
        : "No evaluations found in evals/experiments/"
    );
    process.exit(1);
  }

  console.log(`Found ${evaluations.length} evaluation(s):\n`);
  for (const evaluation of evaluations) {
    console.log(`  • ${evaluation.name}.eval.ts`);
  }
  console.log();

  let passed = 0;
  let failed = 0;

  for (const evaluation of evaluations) {
    console.log(`\n▶ Running: ${evaluation.name}\n`);

    const result = await runEvaluation(evaluation.file);

    if (result.success) {
      passed++;
      console.log(`\n✓ ${evaluation.name} completed\n`);
    } else {
      failed++;
      console.log(`\n✗ ${evaluation.name} failed (script error)\n`);
    }
  }

  await flush();

  // Get base URL from client
  const client = createClient();
  const baseUrl = client.config.baseUrl || "http://localhost:6006";

  console.log("\n" + "=".repeat(50));
  console.log(`\nCompleted: ${passed} successful, ${failed} failed`);
  console.log(`\n→ View evaluation results: ${baseUrl}/datasets\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
