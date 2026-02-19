#!/usr/bin/env tsx
/* eslint-disable no-console */

// Import instrumentation first (Phoenix must be initialized early)
/* prettier-ignore */
import { flush } from "../src/instrumentation.js";
import { createClient } from "@arizeai/phoenix-client";
import type { Example } from "@arizeai/phoenix-client/types/datasets";

import {
  phoenixTopicDataset,
  terminalFormatDataset,
} from "../evals/datasets/index.js";
import { agent } from "../src/agents/index.js";
import { runInteraction } from "../src/ui/interaction.js";

const DATASETS: Record<string, { name: string; examples: Example[] }> = {
  "terminal-format": terminalFormatDataset,
  "phoenix-topic": phoenixTopicDataset,
};

function parseArgs(): { datasetName: string | null; concurrency: number } {
  const args = process.argv.slice(2);

  const datasetIndex = args.indexOf("--dataset");
  const datasetName =
    datasetIndex !== -1 && args[datasetIndex + 1]
      ? args[datasetIndex + 1]
      : null;

  const concurrencyIndex = args.indexOf("--concurrency");
  const concurrency =
    concurrencyIndex !== -1 && args[concurrencyIndex + 1]
      ? parseInt(args[concurrencyIndex + 1], 10)
      : 3;

  return { datasetName, concurrency };
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function seedDataset({
  name,
  examples,
  concurrency,
}: {
  name: string;
  examples: Example[];
  concurrency: number;
}): Promise<void> {
  const shuffled = shuffle(examples);
  const total = shuffled.length;
  console.log(
    `\nSeeding dataset: ${name} (${total} examples, concurrency=${concurrency})\n`
  );

  let completed = 0;
  const queue = [...shuffled];

  async function worker() {
    while (queue.length > 0) {
      const example = queue.shift();
      if (!example) break;

      const prompt = example.input?.prompt;
      const slot = ++completed;

      if (typeof prompt !== "string") {
        console.warn(`  [${slot}/${total}] Skipping example with no prompt`);
        continue;
      }

      const preview = prompt.length > 60 ? prompt.slice(0, 60) + "..." : prompt;
      console.log(`  [${slot}/${total}] Running: "${preview}"`);

      try {
        await runInteraction({ input: prompt, agent });
      } catch (error) {
        console.error(`  [${slot}/${total}] Error:`, error);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
}

async function main() {
  const { datasetName, concurrency } = parseArgs();

  let datasetsToRun: Array<{
    key: string;
    dataset: { name: string; examples: Example[] };
  }>;

  const resolvedDatasetName = datasetName ?? "phoenix-topic";
  const dataset = DATASETS[resolvedDatasetName];
  if (!dataset) {
    console.error(`Unknown dataset: "${resolvedDatasetName}"`);
    console.error(`Available datasets: ${Object.keys(DATASETS).join(", ")}`);
    process.exit(1);
  }
  datasetsToRun = [{ key: resolvedDatasetName, dataset }];

  const totalExamples = datasetsToRun.reduce(
    (sum, { dataset }) => sum + dataset.examples.length,
    0
  );

  console.log("=".repeat(50));
  console.log(`Seed Traces`);
  console.log("=".repeat(50));
  console.log(`Datasets: ${datasetsToRun.map(({ key }) => key).join(", ")}`);
  console.log(`Total examples: ${totalExamples}`);
  console.log(`Concurrency: ${concurrency}`);

  for (const { dataset } of datasetsToRun) {
    await seedDataset({ ...dataset, concurrency });
  }

  await flush();

  const client = createClient();
  const baseUrl = client.config.baseUrl || "http://localhost:6006";

  console.log("\n" + "=".repeat(50));
  console.log(`\nDone! ${totalExamples} traces seeded.`);
  console.log(`\n→ View traces: ${baseUrl}/projects/cli-agent-starter-kit\n`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
