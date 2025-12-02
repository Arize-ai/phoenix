/* eslint-disable no-console */
import { bindEvaluator, createHallucinationEvaluator } from "../src";

import { openai } from "@ai-sdk/openai";

const model = openai("gpt-4o-mini");

type ExampleType = {
  question: string;
  context: string;
  answer: string;
};
const examples: ExampleType[] = [
  {
    question: "Is Arize Phoenix Open Source?",
    context:
      "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    answer: "Arize is not open source.",
  },
  {
    question: "Does Arize Phoenix cost money?",
    context:
      "Arize Phoenix is a platform for building and deploying AI applications. It is free to use.",
    answer: "No, Arize Phoenix is free to use.",
  },
];
async function main() {
  const evaluator = bindEvaluator<ExampleType>(
    createHallucinationEvaluator({
      model,
    }),
    {
      inputMapping: {
        input: "question",
        reference: "context",
        output: "answer",
      },
    }
  );

  for (const example of examples) {
    const result = await evaluator.evaluate(example);
    console.log(result);
  }
}

main().catch(console.error);
