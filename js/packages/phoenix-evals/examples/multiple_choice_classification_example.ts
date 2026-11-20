/* eslint-disable no-console */
import assert from "assert";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import { createClassificationEvaluator } from "../src";
import type { DecisionModel } from "../src";

/**
 * Multiple-criterion classification. One evaluator answers several independent
 * classification questions about the same input in a single request, returning
 * one result per criterion from `evaluateCriteria`.
 *
 * Here one piece of text is judged for both sentiment and toxicity, and the
 * same `gpt-6-luna` model is run two ways for a like-for-like comparison:
 *   - as a language model: one `generateObject` call, with an explanation per
 *     criterion;
 *   - as a decision model: one `experimental_decide` call, with per-label
 *     probabilities instead of an explanation.
 *
 * Requires an `OPENAI_API_KEY` with access to `gpt-6-luna`.
 * See https://developers.openai.com/api/docs/guides/decisions
 */

const decisionModel = openai.decisionModel("gpt-6-luna");
// The language model the Decisions API's `gpt-6-luna` is based on.
const languageModel = openai("gpt-6-luna");

// Rendered the same way for both kinds of model; a decision model receives the
// rendered prompt as plain text. The per-criterion questions live on each
// criterion's `instruction`, so the template only needs to present the text.
const promptTemplate = `
You are analyzing a single piece of user-generated text.

<text>{{text}}</text>

Answer each question about the text above.
`;

function createTextQualityEvaluator(model: LanguageModel | DecisionModel) {
  return createClassificationEvaluator({
    name: "text-quality",
    model,
    promptTemplate,
    // A list of criteria (instead of a single label-to-score map) makes this a
    // multi-criterion evaluator: one result per criterion.
    choices: [
      {
        name: "sentiment",
        instruction:
          "What is the overall sentiment of the text? Choose 'positive', 'negative', or 'neutral'.",
        choices: { positive: 1, neutral: 0.5, negative: 0 },
        optimizationDirection: "MAXIMIZE",
      },
      {
        name: "toxicity",
        instruction:
          "Is the text toxic (insulting, hateful, or harassing)? Choose 'toxic' or 'non_toxic'.",
        choices: { toxic: 1, non_toxic: 0 },
        optimizationDirection: "MINIMIZE",
      },
    ],
  });
}

// Render the decision model's per-label probabilities as a short string so
// `console.table` prints them in full instead of collapsing a wider object to
// `[Object]`.
function formatProbabilities(probabilities: unknown): string | undefined {
  if (!probabilities || typeof probabilities !== "object") {
    return undefined;
  }
  return Object.entries(probabilities as Record<string, number>)
    .map(([label, probability]) => `${label}: ${probability.toFixed(2)}`)
    .join(", ");
}

interface TextCase {
  text: string;
  expected: { sentiment: string; toxicity: string };
}

const examples: TextCase[] = [
  {
    text: "I absolutely love this product — it works beautifully and support was great!",
    expected: { sentiment: "positive", toxicity: "non_toxic" },
  },
  {
    text: "You are a complete idiot and everyone here is sick of your garbage.",
    expected: { sentiment: "negative", toxicity: "toxic" },
  },
];

async function runModel(
  label: string,
  model: LanguageModel | DecisionModel
): Promise<void> {
  console.log(`\n=== ${label} ===`);
  const evaluator = createTextQualityEvaluator(model);

  for (const [index, { text, expected }] of examples.entries()) {
    const results = await evaluator.evaluateCriteria({ text });

    console.log(`\nExample ${index + 1}: ${text}`);
    console.table(
      results.map((result) => ({
        criterion: result.name,
        label: result.label,
        score: result.score,
        // Present only for the language model; a decision model has none.
        explanation: result.explanation,
        // Present only for the decision model; language models have none.
        probabilities: formatProbabilities(result.metadata?.probabilities),
      }))
    );

    // Each criterion comes back once, keyed by its name.
    assert(results.length === 2);
    const byName = new Map(results.map((result) => [result.name, result]));
    assert(byName.get("sentiment")?.label === expected.sentiment);
    assert(byName.get("toxicity")?.label === expected.toxicity);
  }
}

async function main() {
  await runModel("gpt-6-luna (language model)", languageModel);
  await runModel("gpt-6-luna (decision model)", decisionModel);
}

main().catch(console.error);
