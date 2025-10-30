/* eslint-disable no-console */
import { createDataset } from "../src/datasets";
import {
  asEvaluator,
  resumeEvaluation,
  runExperiment,
} from "../src/experiments";

/**
 * This example demonstrates how to add evaluations to an already-completed experiment.
 *
 * Scenarios where this is useful:
 * 1. You want to add new evaluators to an existing experiment
 * 2. Some evaluations failed and you want to retry them
 */
async function main() {
  console.log("Step 1: Create a dataset with text generation examples");
  const { datasetId } = await createDataset({
    name: `resume-evaluation-demo-${Date.now()}`,
    description: "Dataset for demonstrating resume evaluation functionality",
    examples: [
      {
        input: { prompt: "Write a greeting" },
        output: { text: "Hello! How can I help you today?" },
      },
      {
        input: { prompt: "Write a farewell" },
        output: { text: "Goodbye! Have a great day!" },
      },
      {
        input: { prompt: "Write a thank you" },
        output: { text: "Thank you so much for your help!" },
      },
    ],
  });

  // Define the task function once
  const textGenerationTask = async (example: {
    input: Record<string, unknown>;
  }) => {
    // Simulate a text generation task with varied outputs
    const prompt = example.input.prompt as string;
    const randomId = Math.floor(Math.random() * 1000);
    return {
      text: `Response to: ${prompt} [ID:${randomId}]`,
    };
  };

  console.log("\nStep 2: Run experiment with basic task (no evaluators yet)");
  const experiment = await runExperiment({
    dataset: { datasetId },
    repetitions: 10,
    task: textGenerationTask,
    // No evaluators - we'll add them later using resumeEvaluation
    evaluators: [],
  });

  console.log("\n✅ Experiment completed (task runs only, no evaluations)");
  console.log(`   Experiment ID: ${experiment.id}`);
  console.log(`   Total runs: ${experiment.successfulRunCount}`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Step 3: Add evaluations using resumeEvaluation");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await resumeEvaluation({
    experimentId: experiment.id,
    evaluators: [
      // Single-output evaluator: simulates response quality check with variation
      asEvaluator({
        name: "contains-response",
        kind: "CODE",
        evaluate: async ({ output }) => {
          const text = (output as { text?: string })?.text || "";
          const hasResponse = text.toLowerCase().includes("response");
          // Generate varied scores to make them visible in UI
          const score = hasResponse
            ? 0.6 + Math.random() * 0.4
            : Math.random() * 0.3;
          return {
            score,
            label: hasResponse ? "contains 'response'" : "missing 'response'",
          };
        },
      }),

      // Multi-output evaluator: produces multiple metrics with visible variation
      asEvaluator({
        name: "text-quality-metrics",
        kind: "CODE",
        evaluate: async ({ output }) => {
          const text = (output as { text?: string })?.text || "";

          // Generate varied scores to demonstrate different quality aspects
          return [
            {
              name: "length-score",
              score: 0.5 + Math.random() * 0.5, // 0.5 to 1.0
              metadata: { length: text.length },
            },
            {
              name: "punctuation-score",
              score: 0.3 + Math.random() * 0.7, // 0.3 to 1.0
              label: /[.!?]$/.test(text) ? "has punctuation" : "no punctuation",
            },
            {
              name: "word-count-score",
              score: 0.4 + Math.random() * 0.6, // 0.4 to 1.0
              metadata: { wordCount: text.split(/\s+/).length },
            },
          ];
        },
      }),

      // Another single-output evaluator: simulates subjective politeness assessment
      asEvaluator({
        name: "politeness-check",
        kind: "CODE",
        evaluate: async ({ output }) => {
          const text = (output as { text?: string })?.text?.toLowerCase() || "";
          const politeWords = ["please", "thank", "hello", "goodbye", "help"];
          const hasPoliteWord = politeWords.some((word) => text.includes(word));

          // Generate varied scores to simulate subjective assessment
          const score = hasPoliteWord
            ? 0.7 + Math.random() * 0.3
            : 0.2 + Math.random() * 0.5;

          return {
            score,
            label: hasPoliteWord ? "polite" : "neutral",
            explanation: hasPoliteWord
              ? "Contains polite language"
              : "Subjective politeness assessment",
          };
        },
      }),
    ],
    pageSize: 2, // Fetch incomplete evaluations in smaller batches
    concurrency: 2, // Run 2 evaluations in parallel
  });

  console.log("\n✅ Evaluations completed!");
  console.log(
    "   - Single-output evaluators: contains-response, politeness-check"
  );
  console.log("   - Multi-output evaluator: text-quality-metrics");
  console.log(
    "     (produces: length-score, punctuation-score, word-count-score)"
  );

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💡 Key Takeaway:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("resumeEvaluation allows you to:");
  console.log("  • Add new evaluators to completed experiments");
  console.log("  • Use multi-output evaluators for comprehensive analysis");
  console.log("  • Retry failed evaluations");
  console.log("  • Iterate on evaluation strategies without re-running tasks");
}

main().catch(console.error);
