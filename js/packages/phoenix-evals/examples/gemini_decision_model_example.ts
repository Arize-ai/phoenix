/* eslint-disable no-console */
import assert from "assert";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

import {
  createClassificationEvaluator,
  createCorrectnessEvaluator,
} from "../src";
import type { DecisionModel } from "../src";

/**
 * Classification evaluators on the Gemini Decisions API. A decision model
 * picks a label directly and returns a probability for each, instead of
 * generating text. Any classification evaluator, including every built-in,
 * accepts one as its `model`.
 *
 * `google.decisionModel("gemini-decision-1")` routes to Google's native
 * `/decisions` endpoint in `@ai-sdk/google` >= 4.0.118. Requires a
 * `GOOGLE_GENERATIVE_AI_API_KEY` with Decisions EAP access.
 * See https://aistudio.google.com/docs/decisions-api
 */

const decisionModel = google.decisionModel("gemini-decision-1");

// Templates are rendered the same way for both kinds of model. A decision
// model receives the rendered prompt as plain text.
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
  console.log("\n=== Built-in evaluator on a Gemini decision model ===");

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
  console.log("\n=== Custom template on a Gemini decision model ===");

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

async function main() {
  await builtInEvaluatorExample();
  await customTemplateExample();
}

main().catch(console.error);
