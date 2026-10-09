/* eslint-disable no-console */
import assert from "assert";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import {
  createClassificationEvaluator,
  createCorrectnessEvaluator,
} from "../src";
import type { DecisionModel } from "../src";

/**
 * Classification evaluators on an AI SDK decision model. A decision model
 * picks a label directly and returns a probability for each, instead of
 * generating text. Any classification evaluator, including every built-in,
 * accepts one as its `model`.
 *
 * Requires an `OPENAI_API_KEY` with access to `gpt-6-luna`.
 * See https://developers.openai.com/api/docs/guides/decisions
 */

const decisionModel = openai.decisionModel("gpt-6-luna");
const languageModel = openai("gpt-4o-mini");

// The text around the `<data>` block becomes the question's instructions
// and the block becomes the content being judged. Without one, the whole
// prompt is sent as the content with generic instructions.
const hallucinationTemplate = `
You are checking whether an answer to a question is supported by a reference
text. An answer is "hallucinated" if it states anything that the reference
text does not support, or contradicts it. An answer is "factual" if every
claim it makes is supported by the reference text.

<data>
<question>{{input}}</question>
<reference>{{reference}}</reference>
<answer>{{output}}</answer>
</data>

Is the answer factual or hallucinated based on the reference text?
`;

function createHallucinationEvaluator(model: LanguageModel | DecisionModel) {
  return createClassificationEvaluator({
    name: "hallucination",
    model,
    choices: { factual: 1, hallucinated: 0 },
    promptTemplate: hallucinationTemplate,
  });
}

async function builtInEvaluatorExample() {
  console.log("\n=== Built-in evaluator on a decision model ===");

  const correctness = createCorrectnessEvaluator({ model: decisionModel });

  const result = await correctness.evaluate({
    input: "What is the capital of Australia?",
    output: "Sydney.",
  });
  console.log(result);

  assert(result.label === "incorrect");
  assert(result.score === 0);
  // No explanation; label probabilities and confidence are in `metadata`.
  assert(result.explanation === undefined);
  console.log("probabilities:", result.metadata?.probabilities);
  console.log("confidence:", result.metadata?.confidence);
}

async function customTemplateExample() {
  console.log("\n=== Custom template on a decision model ===");

  const hallucination = createHallucinationEvaluator(decisionModel);
  const result = await hallucination.evaluate({
    input: "Is Arize Phoenix open source?",
    reference:
      "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    output: "Arize Phoenix is not open source.",
  });
  console.log(result);

  assert(result.label === "hallucinated");
  assert(result.score === 0);
}

async function sideBySideExample() {
  console.log("\n=== Decision model vs. language model ===");

  // The same evaluator, built once per model.
  const judges = {
    [decisionModel.modelId]: createHallucinationEvaluator(decisionModel),
    [languageModel.modelId]: createHallucinationEvaluator(languageModel),
  };

  const examples = [
    {
      expected: "factual",
      input: "Can I get a refund after 45 days?",
      reference: "Refunds are available within 30 days of delivery.",
      output: "No, refunds are only available within 30 days of delivery.",
    },
    {
      expected: "hallucinated",
      input: "When was the Eiffel Tower completed?",
      reference:
        "The Eiffel Tower is 330 metres tall and was completed in 1889.",
      output: "It was completed in 1901.",
    },
    {
      expected: "factual",
      input: "Which languages does the SDK support?",
      reference: "The SDK is available for Python and TypeScript.",
      output: "Python and TypeScript.",
    },
  ];

  const rows = [];
  for (const [index, { expected, ...example }] of examples.entries()) {
    // Run both judges on the example at the same time.
    const results = await Promise.all(
      Object.entries(judges).map(async ([model, judge]) => {
        const start = performance.now();
        const result = await judge.evaluate(example);
        return { model, result, ms: performance.now() - start };
      })
    );
    for (const { model, result, ms } of results) {
      assert(result.label === expected);
      rows.push({
        example: index + 1,
        model,
        label: result.label,
        "latency (ms)": Math.round(ms),
      });
    }
  }
  console.table(rows);
}

async function main() {
  await builtInEvaluatorExample();
  await customTemplateExample();
  await sideBySideExample();
}

main().catch(console.error);
