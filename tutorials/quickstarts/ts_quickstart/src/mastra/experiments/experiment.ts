import "dotenv/config";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";
import assert from "assert";
import { getDataset } from "@arizeai/phoenix-client/datasets";
// import { asEvaluator, runExperiment } from "@phoenix/client/experiments";
import { Agent } from "@mastra/core/agent";

async function main() {
  const dataset = await getDataset({
    dataset: { datasetName: "ts-quickstart" },
  });
  console.log(dataset);
}

// need to change writer agent prompt
// rebuild agent system... (how?)
// create new agent structure as task
// import eval? / redefine eval
// run_experiment
// const experiment = await runExperiment({
//   dataset: "my-dataset",
//   task: async (example) => example.input,
//   evaluators: [
//     asEvaluator({
//       name: "my-evaluator",
//       kind: "LLM",
//       evaluate: async (params) => params.output,
//     }),
//   ],
// });

main().catch(() => {
  process.exit(1);
});
