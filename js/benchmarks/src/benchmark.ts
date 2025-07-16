/* eslint-disable no-console */
import { createHallucinationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";
import { HallucinationDataset, HallucinationExample } from "./dataset";
import type { EvaluationResult } from "@arizeai/phoenix-evals/types/evals";

export interface BenchmarkResult {
  example: HallucinationExample;
  evaluation: EvaluationResult;
  correct: boolean;
  executionTime: number;
}

export interface BenchmarkSummary {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  averageExecutionTime: number;
  totalExamples: number;
  correctPredictions: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  results: BenchmarkResult[];
}

export class HallucinationBenchmark {
  private dataset: HallucinationDataset;
  private evaluator: any;

  constructor() {
    this.dataset = new HallucinationDataset();
  }

  async initialize() {
    const model = openai("gpt-4o-mini");
    this.evaluator = await createHallucinationEvaluator({ model });
    console.log("Hallucination evaluator initialized");
  }

  async runBenchmark(): Promise<BenchmarkSummary> {
    if (!this.evaluator) {
      throw new Error("Evaluator not initialized. Call initialize() first.");
    }

    const examples = this.dataset.getExamples();
    const results: BenchmarkResult[] = [];

    console.log(`Running benchmark on ${examples.length} examples...`);

    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      console.log(`Evaluating example ${i + 1}/${examples.length}`);

      const startTime = Date.now();

      try {
        const evaluation = await this.evaluator({
          output: example.response,
          input: `Please evaluate if this response contains hallucinated information.`,
          reference: example.context,
        });

        const executionTime = Date.now() - startTime;

        const predictedHallucination =
          evaluation.score === 0 || evaluation.label === "hallucinated";
        const correct = predictedHallucination === example.isHallucination;

        const result: BenchmarkResult = {
          example,
          evaluation,
          correct,
          executionTime,
        };

        results.push(result);

        console.log(
          `  Result: ${correct ? "✓" : "✗"} (${evaluation.label}, score: ${evaluation.score})`
        );
      } catch (error) {
        console.error(`Error evaluating example ${i + 1}:`, error);

        const result: BenchmarkResult = {
          example,
          evaluation: {
            score: undefined,
            label: "error",
            explanation: String(error),
          },
          correct: false,
          executionTime: Date.now() - startTime,
        };
        results.push(result);
      }
    }

    return this.calculateMetrics(results);
  }

  private calculateMetrics(results: BenchmarkResult[]): BenchmarkSummary {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;
    let correctPredictions = 0;
    let totalExecutionTime = 0;

    results.forEach((result) => {
      totalExecutionTime += result.executionTime;

      if (result.correct) {
        correctPredictions++;
      }

      const predictedHallucination =
        result.evaluation.score === 0 ||
        result.evaluation.label === "hallucinated";
      const actualHallucination = result.example.isHallucination;

      if (predictedHallucination && actualHallucination) {
        truePositives++;
      } else if (predictedHallucination && !actualHallucination) {
        falsePositives++;
      } else if (!predictedHallucination && !actualHallucination) {
        trueNegatives++;
      } else if (!predictedHallucination && actualHallucination) {
        falseNegatives++;
      }
    });

    const accuracy = correctPredictions / results.length;
    const precision =
      truePositives + falsePositives > 0
        ? truePositives / (truePositives + falsePositives)
        : 0;
    const recall =
      truePositives + falseNegatives > 0
        ? truePositives / (truePositives + falseNegatives)
        : 0;
    const f1Score =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;
    const averageExecutionTime = totalExecutionTime / results.length;

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      averageExecutionTime,
      totalExamples: results.length,
      correctPredictions,
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives,
      results,
    };
  }

  printSummary(summary: BenchmarkSummary) {
    console.log("\n=== HALLUCINATION EVALUATOR BENCHMARK RESULTS ===");
    console.log(`Total Examples: ${summary.totalExamples}`);
    console.log(`Correct Predictions: ${summary.correctPredictions}`);
    console.log(`Accuracy: ${(summary.accuracy * 100).toFixed(2)}%`);
    console.log(`Precision: ${(summary.precision * 100).toFixed(2)}%`);
    console.log(`Recall: ${(summary.recall * 100).toFixed(2)}%`);
    console.log(`F1 Score: ${(summary.f1Score * 100).toFixed(2)}%`);
    console.log(
      `Average Execution Time: ${summary.averageExecutionTime.toFixed(2)}ms`
    );

    console.log("\n=== CONFUSION MATRIX ===");
    console.log(
      `True Positives (Correctly identified hallucinations): ${summary.truePositives}`
    );
    console.log(
      `False Positives (Incorrectly flagged as hallucinations): ${summary.falsePositives}`
    );
    console.log(
      `True Negatives (Correctly identified factual): ${summary.trueNegatives}`
    );
    console.log(
      `False Negatives (Missed hallucinations): ${summary.falseNegatives}`
    );

    console.log("\n=== DETAILED RESULTS ===");
    summary.results.forEach((result, index) => {
      const status = result.correct ? "✓" : "✗";
      const predicted = result.evaluation.label || "unknown";
      const actual = result.example.isHallucination
        ? "hallucinated"
        : "factual";

      console.log(
        `${index + 1}. ${status} Predicted: ${predicted}, Actual: ${actual} (${result.executionTime}ms)`
      );
      if (result.evaluation.explanation) {
        console.log(`   Explanation: ${result.evaluation.explanation}`);
      }
    });
  }
}
