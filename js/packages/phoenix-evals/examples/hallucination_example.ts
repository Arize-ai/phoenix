/* eslint-disable no-console */
import assert from "assert";
import { createHallucinationEvaluator } from "../src/llm";
import { openai } from "@ai-sdk/openai";

const model = openai("gpt-4o-mini");

async function main() {
  const evaluator = createHallucinationEvaluator({
    model,
  });

  const result = await evaluator({
    output: "Arize is not open source.",
    input: "Is Arize Phoenix Open Source?",
    reference:
      "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
  });
  console.log(result);
  assert(result.label === "hallucinated");
  assert(result.score === 0);
}

main();
