import assert from "assert";
import { openai } from "@ai-sdk/openai";

/* eslint-disable no-console */
import { createFaithfulnessEvaluator } from "../src/llm";

const model = openai("gpt-4o-mini");

async function main() {
  const evaluator = createFaithfulnessEvaluator({
    model,
  });

  const result = await evaluator.evaluate({
    output: "Arize is not open source.",
    input: "Is Arize Phoenix Open Source?",
    context:
      "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
  });
  console.log(result);
  assert(result.label === "unfaithful");
  assert(result.score === 0);
}

main();
