/* eslint-disable no-console */
import { createDataset } from "../src/datasets";
import {
  asEvaluator,
  createExperiment,
  resumeEvaluation,
  resumeExperiment,
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
      {
        input: { prompt: "Write an apology" },
        output: { text: "I apologize for the inconvenience." },
      },
      {
        input: { prompt: "Write a welcome message" },
        output: { text: "Welcome to our service!" },
      },
      {
        input: { prompt: "Write a congratulations message" },
        output: { text: "Congratulations on your achievement!" },
      },
      {
        input: { prompt: "Write a request for help" },
        output: { text: "Could you please assist me with this?" },
      },
      {
        input: { prompt: "Write an introduction" },
        output: { text: "My name is Alex, nice to meet you." },
      },
      {
        input: { prompt: "Write a confirmation" },
        output: { text: "Yes, I can confirm that." },
      },
      {
        input: { prompt: "Write an encouragement" },
        output: { text: "You're doing great, keep it up!" },
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

  console.log("\nStep 2: Create experiment and run task (no evaluators yet)");
  const experiment = await createExperiment({
    datasetId,
    repetitions: 10,
  });

  await resumeExperiment({
    experimentId: experiment.id,
    task: textGenerationTask,
    // No evaluators - we'll add them later using resumeEvaluation
  });

  console.log("\n✅ Experiment completed (task runs only, no evaluations)");
  console.log(`   Experiment ID: ${experiment.id}`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Step 3: Add evaluations using resumeEvaluation");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await resumeEvaluation({
    experimentId: experiment.id,
    evaluators: [
      // Evaluator 1: simulates response quality check with variation
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

      // Evaluator 2: simulates length quality assessment
      asEvaluator({
        name: "length-score",
        kind: "CODE",
        evaluate: async ({ output }) => {
          const text = (output as { text?: string })?.text || "";
          const score = 0.5 + Math.random() * 0.5; // 0.5 to 1.0
          return {
            score,
            metadata: { length: text.length },
          };
        },
      }),

      // Evaluator 3: simulates punctuation check
      asEvaluator({
        name: "punctuation-score",
        kind: "CODE",
        evaluate: async ({ output }) => {
          const text = (output as { text?: string })?.text || "";
          const score = 0.3 + Math.random() * 0.7; // 0.3 to 1.0
          return {
            score,
            label: /[.!?]$/.test(text) ? "has punctuation" : "no punctuation",
          };
        },
      }),

      // Evaluator 4: simulates subjective politeness assessment
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
    concurrency: 10, // Run 10 evaluations in parallel
  });

  console.log("\n✅ Evaluations completed!");
  console.log(
    "   Evaluators: contains-response, length-score, punctuation-score, politeness-check"
  );

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💡 Key Takeaway:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("resumeEvaluation allows you to:");
  console.log("  • Add new evaluators to completed experiments");
  console.log("  • Retry failed evaluations");
  console.log("  • Iterate on evaluation strategies without re-running tasks");
  console.log(
    "\nNote: Multi-output evaluators (that return arrays) are not supported"
  );
  console.log(
    "      for resume operations. Use separate evaluators for each metric."
  );
}

main().catch(console.error);
