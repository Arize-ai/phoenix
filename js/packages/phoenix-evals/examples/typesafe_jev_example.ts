/* eslint-disable no-console */
/**
 * Run classification evaluators on TypeSafe's Jev, a decision-only model.
 *
 * Jev classifies without generating text, so it is far cheaper than a chat
 * model for single-label evals. The trade-off is that results carry a label
 * and score but no explanation.
 *
 * Requires TYPESAFE_AI_API_KEY to be set.
 *
 *   tsx examples/typesafe_jev_example.ts
 */
import { typeSafeAi } from "@ai-sdk/typesafe-ai";

import {
  createClassificationEvaluator,
  createHallucinationEvaluator,
} from "../src/llm";

const model = typeSafeAi.evaluationModel("jev-latest");

// 1. A built-in evaluator: every pre-built evaluator accepts an evaluation model.
const hallucinationEvaluator = createHallucinationEvaluator({ model });

// The built-in hallucination evaluator reads `input` (everything the
// assistant had available, treated as the source of truth) and `output`.
const phoenixContext =
  "Retrieved document: Arize Phoenix is an open-source platform for tracing and evaluating AI applications.";
const eiffelContext =
  "Retrieved document: The Eiffel Tower was completed in 1889 for the World's Fair.";

const hallucinationExamples = [
  {
    input: `${phoenixContext}\n\nUser: Is Arize Phoenix open source?`,
    output: "Yes, Arize Phoenix is open source.",
  },
  {
    input: `${phoenixContext}\n\nUser: Is Arize Phoenix open source?`,
    output: "No, Arize Phoenix is a closed-source commercial product.",
  },
  {
    input: `${eiffelContext}\n\nUser: What year was the Eiffel Tower completed?`,
    output: "It was completed in 1889.",
  },
  {
    input: `${eiffelContext}\n\nUser: What year was the Eiffel Tower completed?`,
    output: "It was completed in 1925 to celebrate the end of World War I.",
  },
];

// 2. A custom multi-class evaluator.
const routingEvaluator = createClassificationEvaluator({
  name: "support_department",
  model,
  promptTemplate: `You are triaging customer support messages.
Which team should handle the following message?

- billing: charges, invoices, refunds, payment methods
- technical: bugs, errors, outages, integration problems
- account: login, password, profile, permissions
- other: anything else

[Message]: {{message}}`,
  choices: { billing: 0, technical: 1, account: 2, other: 3 },
});

const routingExamples = [
  { message: "I was charged twice this month. Please refund the duplicate." },
  { message: "The OTLP exporter returns a 502 every time I send traces." },
  { message: "I can't log in after resetting my password." },
  { message: "Do you have a booth at the conference next week?" },
];

async function main() {
  console.log(`\nHallucination (built-in evaluator) on ${model.modelId}\n`);
  const hallucinationRows = [];
  for (const example of hallucinationExamples) {
    const result = await hallucinationEvaluator.evaluate(example);
    hallucinationRows.push({
      output: example.output,
      label: result.label,
      score: result.score,
      explanation: result.explanation ?? "(none: Jev does not generate text)",
    });
  }
  console.table(hallucinationRows);

  console.log(`\nSupport routing (custom 4-way classifier)\n`);
  const routingRows = [];
  for (const example of routingExamples) {
    const result = await routingEvaluator.evaluate(example);
    routingRows.push({
      message: example.message,
      label: result.label,
      score: result.score,
    });
  }
  console.table(routingRows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
