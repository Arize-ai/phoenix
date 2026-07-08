/* eslint-disable no-console */
import { createDataset } from "../src/datasets";
import { asExperimentEvaluator, runExperiment } from "../src/experiments";

async function main() {
  const { datasetId } = await createDataset({
    name: `simple-dataset-${Date.now()}`,
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
  const experiment = await runExperiment({
    dataset: { datasetId },
    task: async (example) => `hello ${example.input.name}`,
    evaluators: [
      asExperimentEvaluator({
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
      asExperimentEvaluator({
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
  console.table(experiment.runs);
  console.table(experiment.evaluationRuns);
}

main().catch(console.error);
