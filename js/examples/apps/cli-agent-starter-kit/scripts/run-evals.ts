#!/usr/bin/env tsx
import { createClient } from "@arizeai/phoenix-client";

import { flush } from "../src/instrumentation.js";

import { cancel,intro, outro, select, spinner } from "@clack/prompts";
import { glob } from "glob";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface EvalModule {
  metadata: {
    name: string;
    description: string;
    hint?: string;
  };
  [key: string]: unknown; // The evaluation function (e.g., runTerminalFormatEval)
}

async function discoverEvaluations() {
  // Find all .eval.ts files in evals/experiments/
  const evalFiles = await glob("evals/experiments/*.eval.ts", {
    cwd: process.cwd(),
    absolute: true,
  });

  const evaluations = await Promise.all(
    evalFiles.map(async (file) => {
      const fileUrl = pathToFileURL(file).href;
      const module = (await import(fileUrl)) as EvalModule;

      if (!module.metadata) {
        // eslint-disable-next-line no-console
        console.warn(`Warning: ${file} missing metadata export, skipping`);
        return null;
      }

      // Find the evaluation function (assumes it's the first non-metadata export)
      const evalFnName = Object.keys(module).find((key) => key !== "metadata");
      if (!evalFnName) {
        // eslint-disable-next-line no-console
        console.warn(`Warning: ${file} missing evaluation function, skipping`);
        return null;
      }

      return {
        id: path.basename(file, ".eval.ts"),
        name: module.metadata.name,
        description: module.metadata.description,
        hint: module.metadata.hint,
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
  intro("Phoenix Agent Evaluations");

  // Discover evaluations
  const evaluations = await discoverEvaluations();

  if (evaluations.length === 0) {
    cancel("No evaluations found in evals/experiments/");
    return;
  }

  const experiment = await select({
    message: "Select an experiment to run:",
    options: [
      ...evaluations.map((e) => ({
        value: e.id,
        label: e.name,
        hint: e.hint || e.description,
      })),
      { value: "cancel", label: "Cancel" },
    ],
  });

  if (experiment === "cancel" || !experiment) {
    cancel("Evaluation cancelled");
    return;
  }

  const selectedEval = evaluations.find((e) => e.id === experiment);
  if (!selectedEval) {
    cancel(`Evaluation not found: ${experiment}`);
    return;
  }

  const s = spinner();
  s.start(`Running ${selectedEval.name}...`);

  try {
    const client = createClient();

    await selectedEval.evalFn({
      client,
      logger: {
        log: (message: string) => s.message(message),
        error: (message: string) => s.message(message),
      },
    });

    s.stop("Evaluation complete");
    outro("View results in Phoenix UI at http://localhost:6006");
  } catch (error) {
    s.stop("Evaluation failed");
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  } finally {
    await flush();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error:", error);
  process.exit(1);
});
