/* eslint-disable no-console */
import { openai } from "@ai-sdk/openai";
import { createOrGetDataset } from "@arizeai/phoenix-client/datasets";
import {
  asExperimentEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";

import { createFaithfulnessEvaluator } from "../src";

const model = openai("gpt-4o-mini");

async function main() {
  const dataset = await createOrGetDataset({
    name: "phoenix-evals-integration-example",
    description: "A small dataset for TypeScript package docs",
    examples: [
      {
        input: {
          question: "Is Phoenix open source?",
          context: "Phoenix is open source.",
        },
        output: {
          answer: "Phoenix is open source.",
        },
      },
    ],
  });

  const faithfulness = createFaithfulnessEvaluator({
    model,
  });

  const experiment = await runExperiment({
    experimentName: "phoenix-evals-integration-example",
    dataset,
    task: async ({ question, context }) =>
      `${question} Answer using only this context: ${context}`,
    evaluators: [
      asExperimentEvaluator({
        name: "faithfulness",
        kind: "LLM",
        evaluate: async ({ input, output }) => {
          const question =
            typeof input.question === "string" ? input.question : "";
          const context =
            typeof input.context === "string" ? input.context : "";

          return faithfulness.evaluate({
            input: question,
            context,
            output:
              typeof output === "string" ? output : JSON.stringify(output),
          });
        },
      }),
    ],
  });

  console.log(experiment.id);
}

main().catch(console.error);
