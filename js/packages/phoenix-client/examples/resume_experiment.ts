/* eslint-disable no-console */
import { createDataset } from "../src/datasets";
import {
  asEvaluator,
  resumeExperiment,
  runExperiment,
} from "../src/experiments";

/**
 * This example demonstrates how to resume an experiment that has incomplete runs.
 *
 * Scenarios where this is useful:
 * 1. An experiment was interrupted (e.g., process crashed, network issues)
 * 2. Some runs failed and you want to retry them
 */
async function main() {
  console.log("Step 1: Create a dataset with examples");
  const { datasetId } = await createDataset({
    name: `resume-experiment-demo-${Date.now()}`,
    description: "Dataset for demonstrating resume experiment functionality",
    examples: [
      { input: { question: "What is 2+2?" }, output: { answer: "4" } },
      { input: { question: "What is 3+3?" }, output: { answer: "6" } },
      { input: { question: "What is 5+5?" }, output: { answer: "10" } },
    ],
  });

  console.log("\nStep 2: Run initial experiment with 2 repetitions");
  const initialExperiment = await runExperiment({
    dataset: { datasetId },
    repetitions: 10,
    task: async (example) => {
      // Simulate a task that might fail occasionally
      const question = example.input.question as string;
      if (Math.random() < 0.7) {
        // 70% failure rate to simulate incomplete runs
        throw new Error("Simulated task failure");
      }
      return { answer: question.split("+").length.toString() };
    },
    evaluators: [
      asEvaluator({
        name: "exact-match",
        kind: "CODE",
        evaluate: async ({ output, expected }) => ({
          score: output === expected?.answer ? 1 : 0,
        }),
      }),
    ],
  });

  console.log("\n✅ Initial experiment completed");
  console.log(`   Experiment ID: ${initialExperiment.id}`);
  console.log(`   Successful runs: ${initialExperiment.successfulRunCount}`);
  console.log(`   Failed runs: ${initialExperiment.failedRunCount}`);
  console.log(`   Missing runs: ${initialExperiment.missingRunCount}`);

  if (
    initialExperiment.missingRunCount > 0 ||
    initialExperiment.failedRunCount > 0
  ) {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(
      "Step 3: Resume the experiment to complete missing/failed runs"
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    await resumeExperiment({
      experimentId: initialExperiment.id,
      task: async (example) => {
        // This time, let's make the task more reliable
        const question = example.input.question as string;
        return { answer: question.split("+").length.toString() };
      },
      evaluators: [
        asEvaluator({
          name: "exact-match",
          kind: "CODE",
          evaluate: async ({ output, expected }) => ({
            score: output === expected?.answer ? 1 : 0,
          }),
        }),
      ],
    });

    console.log("\n✅ Experiment resumed and completed!");
  } else {
    console.log("\n✅ All runs completed successfully on first attempt!");
  }
}

main().catch(console.error);
