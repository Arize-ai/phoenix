// Evaluate Your Agent: a dataset, an LLM judge, and two experiments.

// docs:start main
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { createClient } from "@arizeai/phoenix-client";
import { createDataset } from "@arizeai/phoenix-client/datasets";
import { asExperimentEvaluator, runExperiment } from "@arizeai/phoenix-client/experiments";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals/llm/createClassificationEvaluator";

const client = createClient(); // reads PHOENIX_ENDPOINT, default http://localhost:6006
const model = openai("gpt-4o-mini");

const dataset = await createDataset({
  client,
  name: "travel-support",
  description: "Questions about a fictional airline's Basic fare.",
  examples: [
    {
      input: { question: "How long do I have to cancel a Basic fare for a full refund?" },
      output: { expected_answer: "Basic fares can be cancelled for a full refund within 48 hours of booking." },
    },
    {
      input: { question: "Can I change the date on a Basic fare, and what does it cost?" },
      output: { expected_answer: "Basic fares can be changed once for a 40 dollar fee, plus any difference in price." },
    },
    {
      input: { question: "How many checked bags come with a Basic fare, and what does a second bag cost?" },
      output: { expected_answer: "Basic fares include one checked bag. A second bag is 45 dollars." },
    },
  ],
});

const judge = createClassificationEvaluator({
  name: "correctness",
  model,
  choices: { true: 1, false: 0 },
  promptTemplate: `Compare the provided answer to the reference answer. Label true if it states the same policy: same time windows, fees, and quantities, in any wording. Label false if it contradicts the reference, hedges, or leaves out a fee, limit, or condition.

Reference answer: {{reference}}
Provided answer: {{output}}`,
});

const correctness = asExperimentEvaluator({
  name: "correctness",
  kind: "LLM",
  evaluate: ({ output, expected }) =>
    judge.evaluate({
      reference: (expected as { expected_answer: string }).expected_answer,
      output: String(output),
    }),
});

async function run(prompt: string, experimentName: string) {
  await runExperiment({
    client,
    dataset,
    experimentName,
    evaluators: [correctness],
    task: async (example) => {
      const { question } = example.input as { question: string };
      const { text } = await generateText({ model, prompt: prompt.replace("{question}", question) });
      return text;
    },
  });
}

const BASELINE = "You are a travel support agent. Answer the customer's question.\n\nQuestion: {question}";
const POLICY = `You are a travel support agent. Answer the customer's question using this policy.

Basic fare policy:
- Full refund if cancelled within 48 hours of booking.
- Can be changed once for a 40 dollar fee, plus any price difference.
- Includes one checked bag. A second bag is 45 dollars.

Question: {question}`;

await run(BASELINE, "baseline");
await run(POLICY, "with-policy");
// docs:end main
