/* eslint-disable no-console */
/**
 * Run the built-in hallucination evaluator side by side on TypeSafe's Jev
 * and an OpenAI chat model, then compare labels and latency.
 *
 * Jev is a decision-only model: it classifies without generating text, so it
 * is much cheaper and faster than a chat model for single-label evals. The
 * trade-off is that its results carry a label and score but no explanation.
 *
 * Requires TYPESAFE_AI_API_KEY and OPENAI_API_KEY to be set.
 *
 *   tsx examples/typesafe_jev_example.ts
 */
import { openai } from "@ai-sdk/openai";
import { typeSafeAi } from "@ai-sdk/typesafe-ai";

import { createHallucinationEvaluator } from "../src/llm";

const jev = typeSafeAi.evaluationModel("jev-latest");
const gpt = openai("gpt-4o-mini");

const jevEvaluator = createHallucinationEvaluator({ model: jev });
const gptEvaluator = createHallucinationEvaluator({ model: gpt });

// The hallucination evaluator reads `input` (everything the assistant had
// available, treated as the source of truth) and `output` (the response).
const phoenixContext =
  "Retrieved document: Arize Phoenix is an open-source platform for tracing and evaluating AI applications.";
const eiffelContext =
  "Retrieved document: The Eiffel Tower was completed in 1889 for the World's Fair.";

const examples = [
  {
    input: `${phoenixContext}\n\nUser: Is Arize Phoenix open source?`,
    output: "Yes, Arize Phoenix is open source.",
    expected: "grounded",
  },
  {
    input: `${phoenixContext}\n\nUser: Is Arize Phoenix open source?`,
    output: "No, Arize Phoenix is a closed-source commercial product.",
    expected: "hallucinated",
  },
  {
    input: `${eiffelContext}\n\nUser: What year was the Eiffel Tower completed?`,
    output: "It was completed in 1889.",
    expected: "grounded",
  },
  {
    input: `${eiffelContext}\n\nUser: What year was the Eiffel Tower completed?`,
    output: "It was completed in 1925 to celebrate the end of World War I.",
    expected: "hallucinated",
  },
];

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();
  const value = await fn();
  return [value, performance.now() - start];
}

function summarize(name: string, latenciesMs: number[], correct: number) {
  const total = latenciesMs.reduce((sum, ms) => sum + ms, 0);
  return {
    model: name,
    calls: latenciesMs.length,
    correct: `${correct}/${latenciesMs.length}`,
    "mean ms": Math.round(total / latenciesMs.length),
    "min ms": Math.round(Math.min(...latenciesMs)),
    "max ms": Math.round(Math.max(...latenciesMs)),
    "total ms": Math.round(total),
  };
}

async function main() {
  const rows = [];
  const jevLatencies: number[] = [];
  const gptLatencies: number[] = [];
  let jevCorrect = 0;
  let gptCorrect = 0;

  for (const { expected, ...example } of examples) {
    const [jevResult, jevMs] = await timed(() =>
      jevEvaluator.evaluate(example)
    );
    const [gptResult, gptMs] = await timed(() =>
      gptEvaluator.evaluate(example)
    );
    jevLatencies.push(jevMs);
    gptLatencies.push(gptMs);
    if (jevResult.label === expected) jevCorrect++;
    if (gptResult.label === expected) gptCorrect++;
    // Evaluation models report the full label distribution as metadata.
    const probabilities = jevResult.metadata?.probabilities as
      | Record<string, number>
      | undefined;
    rows.push({
      output: example.output,
      expected,
      [jev.modelId]: jevResult.label,
      "jev P(label)": probabilities?.[jevResult.label ?? ""],
      [gpt.modelId]: gptResult.label,
      "jev ms": Math.round(jevMs),
      "gpt ms": Math.round(gptMs),
    });
  }

  console.log("\nHallucination evaluator: labels\n");
  console.table(rows);

  console.log("\nLatency summary\n");
  console.table([
    summarize(jev.modelId, jevLatencies, jevCorrect),
    summarize(gpt.modelId, gptLatencies, gptCorrect),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
