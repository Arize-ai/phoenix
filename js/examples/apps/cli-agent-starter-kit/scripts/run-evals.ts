#!/usr/bin/env tsx
import { createClient } from "@arizeai/phoenix-client";

import { flush } from "../src/instrumentation.js";

import { glob } from "glob";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface EvalModule {
  metadata?: {
    name: string;
    description: string;
    hint?: string;
  };
  [key: string]: unknown;
}

async function discoverEvaluations(pattern?: string) {
  const searchPattern = pattern
    ? `evals/experiments/*${pattern}*.eval.ts`
    : "evals/experiments/*.eval.ts";

  const evalFiles = await glob(searchPattern, {
    cwd: process.cwd(),
    absolute: true,
  });

  const evaluations = await Promise.all(
    evalFiles.map(async (file) => {
      const fileUrl = pathToFileURL(file).href;
      const module = (await import(fileUrl)) as EvalModule;

      const evalFnName = Object.keys(module).find(
        (key) => key !== "metadata" && key !== "default"
      );
      if (!evalFnName) {
        return null;
      }

      return {
        id: path.basename(file, ".eval.ts"),
        file,
        name: module.metadata?.name || path.basename(file),
        evalFn: module[evalFnName] as (params: {
          client: ReturnType<typeof createClient>;
          logger: Pick<Console, "log" | "error">;
        }) => Promise<unknown>,
      };
    })
  );

  return evaluations.filter(Boolean) as NonNullable<
    (typeof evaluations)[number]
  >[];
}

async function main() {
  const pattern = process.argv[2];

  // eslint-disable-next-line no-console
  console.log(
    pattern
      ? `\nRunning evaluations matching: ${pattern}\n`
      : "\nRunning all evaluations\n"
  );

  const evaluations = await discoverEvaluations(pattern);

  if (evaluations.length === 0) {
    // eslint-disable-next-line no-console
    console.error(
      pattern
        ? `No evaluations found matching: ${pattern}`
        : "No evaluations found in evals/experiments/"
    );
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`Found ${evaluations.length} evaluation(s):\n`);
  for (const evaluation of evaluations) {
    // eslint-disable-next-line no-console
    console.log(`  • ${evaluation.name} (${evaluation.id}.eval.ts)`);
  }
  // eslint-disable-next-line no-console
  console.log();

  const client = createClient();
  let passed = 0;
  let failed = 0;

  for (const evaluation of evaluations) {
    // eslint-disable-next-line no-console
    console.log(`\n▶ Running: ${evaluation.name}\n`);

    try {
      await evaluation.evalFn({
        client,
        logger: console,
      });
      passed++;
      // eslint-disable-next-line no-console
      console.log(`\n✓ ${evaluation.name} passed\n`);
    } catch (error) {
      failed++;
      // eslint-disable-next-line no-console
      console.error(`\n✗ ${evaluation.name} failed:`);
      // eslint-disable-next-line no-console
      console.error(error);
      // eslint-disable-next-line no-console
      console.log();
    }
  }

  await flush();

  // eslint-disable-next-line no-console
  console.log("\n" + "=".repeat(50));
  // eslint-disable-next-line no-console
  console.log(`\nEvaluations: ${passed} passed, ${failed} failed`);
  // eslint-disable-next-line no-console
  console.log(`View results: http://localhost:6006/datasets\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error:", error);
  process.exit(1);
});
