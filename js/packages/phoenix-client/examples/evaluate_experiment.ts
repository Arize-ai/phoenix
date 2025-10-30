/* eslint-disable no-console */
import { createDataset } from "../src/datasets";
import {
  asEvaluator,
  evaluateExperiment,
  getExperiment,
  runExperiment,
} from "../src/experiments";

async function main() {
  const { datasetId } = await createDataset({
    name: `simple-dataset-with-re-evaluations-${Date.now()}`,
    description: "a simple dataset",
    examples: [
      {
        input: { name: "John" },
        output: { text: "Hello, John!" },
        metadata: {},
      },
      {
        input: { name: "Jane" },
        output: { text: "Hello, Jane!" },
        metadata: {},
      },
      {
        input: { name: "Bill" },
        output: { text: "Hello, Bill!" },
        metadata: {},
      },
      {
        input: { name: "Alice" },
        output: { text: "Hello, Alice!" },
        metadata: {},
      },
      {
        input: { name: "Bob" },
        output: { text: "Hello, Bob!" },
        metadata: {},
      },
    ],
  });
  const _experiment = await runExperiment({
    dataset: { datasetId },
    task: async (example) => `hello ${example.input.name}`,
    evaluators: [
      asEvaluator({
        name: "matches",
        kind: "CODE",
        evaluate: async ({ output, expected }) => {
          const matches = output === expected?.text;
          return {
            label: matches ? "matches" : "does not match",
            score: matches ? 1 : 0,
            explanation: matches
              ? "output matches expected"
              : "output does not match expected",
            metadata: {},
          };
        },
      }),
    ],
  });

  // we can re-evaluate using the experiment above or re-fetch the experiment
  const experiment = await getExperiment({ experimentId: _experiment.id });

  console.log("re-evaluating experiment", experiment.id);

  // Now let's add more evaluations
  const evaluation = await evaluateExperiment({
    experiment,
    evaluators: [
      asEvaluator({
        name: "contains-hello",
        kind: "CODE",
        evaluate: async ({ output }) => {
          const matches =
            typeof output === "string" && output.includes("hello");
          return {
            label: matches ? "contains hello" : "does not contain hello",
            score: matches ? 1 : 0,
            explanation: matches
              ? "output contains hello"
              : "output does not contain hello",
            metadata: {},
          };
        },
      }),
    ],
  });
  console.table(evaluation.runs);
}

main().catch(console.error);
