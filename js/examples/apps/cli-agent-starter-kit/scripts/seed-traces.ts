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

function parseArgs(): { datasetName: string | null } {
  const args = process.argv.slice(2);
  const datasetIndex = args.indexOf("--dataset");
  if (datasetIndex !== -1 && args[datasetIndex + 1]) {
    return { datasetName: args[datasetIndex + 1] };
  }
  return { datasetName: null };
}

async function seedDataset({
  name,
  examples,
}: {
  name: string;
  examples: Example[];
}): Promise<void> {
  const total = examples.length;
  console.log(`\nSeeding dataset: ${name} (${total} examples)\n`);

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    const prompt = example.input?.prompt;
    if (typeof prompt !== "string") {
      console.warn(`  [${i + 1}/${total}] Skipping example with no prompt`);
      continue;
    }

    const preview = prompt.length > 60 ? prompt.slice(0, 60) + "..." : prompt;
    console.log(`  [${i + 1}/${total}] Running: "${preview}"`);

    try {
      await runInteraction({ input: prompt, agent });
    } catch (error) {
      console.error(`  [${i + 1}/${total}] Error:`, error);
    }
  }
}

async function main() {
  const { datasetName } = parseArgs();

  let datasetsToRun: Array<{
    key: string;
    dataset: { name: string; examples: Example[] };
  }>;

  if (datasetName) {
    const dataset = DATASETS[datasetName];
    if (!dataset) {
      console.error(`Unknown dataset: "${datasetName}"`);
      console.error(`Available datasets: ${Object.keys(DATASETS).join(", ")}`);
      process.exit(1);
    }
    datasetsToRun = [{ key: datasetName, dataset }];
  } else {
    datasetsToRun = Object.entries(DATASETS).map(([key, dataset]) => ({
      key,
      dataset,
    }));
  }

  const totalExamples = datasetsToRun.reduce(
    (sum, { dataset }) => sum + dataset.examples.length,
    0
  );

  console.log("=".repeat(50));
  console.log(`Seed Traces`);
  console.log("=".repeat(50));
  console.log(`Datasets: ${datasetsToRun.map(({ key }) => key).join(", ")}`);
  console.log(`Total examples: ${totalExamples}`);

  for (const { dataset } of datasetsToRun) {
    await seedDataset(dataset);
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
