#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import path from "node:path";
/* eslint-disable no-console */
import { createClient } from "@arizeai/phoenix-client";
import { glob } from "glob";

import { flush } from "../src/instrumentation.js";

async function discoverBenchmarks(pattern?: string) {
  const searchPattern = pattern
    ? `evals/benchmarks/*${pattern}*.benchmark.ts`
    : "evals/benchmarks/*.benchmark.ts";

  const benchmarkFiles = await glob(searchPattern, {
    cwd: process.cwd(),
    absolute: true,
  });

  return benchmarkFiles.map((file) => ({
    id: path.basename(file, ".benchmark.ts"),
    file,
    name: path.basename(file, ".benchmark.ts"),
  }));
}

function runBenchmark(
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
      ? `\nRunning benchmarks matching: ${pattern}\n`
      : "\nRunning all benchmarks\n"
  );

  const benchmarks = await discoverBenchmarks(pattern);

  if (benchmarks.length === 0) {
    console.error(
      pattern
        ? `No benchmarks found matching: ${pattern}`
        : "No benchmarks found in evals/benchmarks/"
    );
    process.exit(1);
  }

  console.log(`Found ${benchmarks.length} benchmark(s):\n`);
  for (const benchmark of benchmarks) {
    console.log(`  • ${benchmark.name}.benchmark.ts`);
  }
  console.log();

  let passed = 0;
  let failed = 0;

  for (const benchmark of benchmarks) {
    console.log(`\n▶ Running: ${benchmark.name}\n`);

    const result = await runBenchmark(benchmark.file);

    if (result.success) {
      passed++;
      console.log(`\n✓ ${benchmark.name} completed\n`);
    } else {
      failed++;
      console.log(`\n✗ ${benchmark.name} failed (script error)\n`);
    }
  }

  await flush();

  const client = createClient();
  const baseUrl = client.config.baseUrl || "http://localhost:6006";

  console.log("\n" + "=".repeat(50));
  console.log(`\nCompleted: ${passed} successful, ${failed} failed`);
  console.log(`\n→ View benchmark results: ${baseUrl}/datasets\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
