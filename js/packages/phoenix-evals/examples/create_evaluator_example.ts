/* eslint-disable no-console */
import { createEvaluator } from "../src/helpers/createEvaluator";

/**
 * Example demonstrating how to use CreateEvaluator to create custom evaluators
 * from any function.
 */

async function main() {
  // Example 1: Simple accuracy evaluator (sync function returning a number)
  console.log("\n=== Example 1: Accuracy Evaluator ===");

  const accuracyEvaluator = createEvaluator(
    ({ output, expected }: { output: string; expected: string }) => {
      return output === expected ? 1 : 0;
    },
    {
      name: "accuracy",
      kind: "CODE",
      optimizationDirection: "MAXIMIZE",
    }
  );

  const result1 = await accuracyEvaluator.evaluate({
    output: "correct answer",
    expected: "correct answer",
  });
  console.log("Match:", result1); // { score: 1 }

  const result2 = await accuracyEvaluator.evaluate({
    output: "wrong answer",
    expected: "correct answer",
  });
  console.log("Mismatch:", result2); // { score: 0 }

  console.log("\n=== Example 2: Quality Evaluator ===");

  const qualityEvaluator = createEvaluator(
    ({ output }: { output: string }) => {
      const score = output.length > 50 ? 0.9 : output.length > 20 ? 0.7 : 0.4;
      return {
        score,
        label: score > 0.8 ? "high" : score > 0.5 ? "medium" : "low",
        explanation: `Output length: ${output.length} characters`,
      };
    },
    {
      name: "quality",
      optimizationDirection: "MAXIMIZE",
    }
  );

  const qualityResult = await qualityEvaluator.evaluate({
    output:
      "This is a very long output that exceeds fifty characters and should receive a high quality score.",
  });
  console.log("Quality result:", qualityResult);
  // { score: 0.9, label: "high", explanation: "Output length: 95 characters" }
}

main().catch(console.error);
