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

  // Define the task function once
  const mathTask = async (
    example: { input: Record<string, unknown> },
    options?: { simulateFailure?: boolean }
  ) => {
    const question = example.input.question as string;
    if (options?.simulateFailure && Math.random() < 0.5) {
      // 50% failure rate to simulate incomplete runs
      throw new Error("Simulated task failure");
    }
    // Add random number to make outputs distinguishable in UI
    const randomValue = Math.floor(Math.random() * 100);
    return { answer: `${question.split("+").length} (run #${randomValue})` };
  };

  console.log("\nStep 2: Run initial experiment with 2 repetitions");
  const initialExperiment = await runExperiment({
    dataset: { datasetId },
    repetitions: 10,
    task: async (example) => mathTask(example, { simulateFailure: true }),
    evaluators: [
      asEvaluator({
        name: "accuracy-score",
        kind: "CODE",
        evaluate: async ({ output, expected }) => {
          // Simulate 50% evaluator failure rate
          if (Math.random() < 0.5) {
            throw new Error("Simulated evaluator failure");
          }

          // Simulate varied accuracy scores for visibility in UI
          const outputStr = String(output?.answer || "");
          const expectedStr = String(expected?.answer || "");
          const hasCorrectNumber = outputStr.includes(expectedStr);

          // Generate varied scores to make differences visible
          const score = hasCorrectNumber
            ? 0.7 + Math.random() * 0.3 // 0.7 to 1.0 for correct
            : 0.2 + Math.random() * 0.4; // 0.2 to 0.6 for incorrect

          return { score };
        },
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
      task: mathTask, // Reuse the same task function, this time without failures
      evaluators: [
        asEvaluator({
          name: "accuracy-score",
          kind: "CODE",
          evaluate: async ({ output, expected }) => {
            // Simulate varied accuracy scores for visibility in UI
            const outputStr = String(output?.answer || "");
            const expectedStr = String(expected?.answer || "");
            const hasCorrectNumber = outputStr.includes(expectedStr);

            // Generate varied scores to make differences visible
            const score = hasCorrectNumber
              ? 0.7 + Math.random() * 0.3 // 0.7 to 1.0 for correct
              : 0.2 + Math.random() * 0.4; // 0.2 to 0.6 for incorrect

            return { score };
          },
        }),
      ],
      pageSize: 5, // Fetch incomplete runs in smaller batches
      concurrency: 2, // Run 2 tasks in parallel
    });

    console.log("\n✅ Experiment resumed and completed!");
  } else {
    console.log("\n✅ All runs completed successfully on first attempt!");
  }
}

main().catch(console.error);
