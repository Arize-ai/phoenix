import { createClient } from "@arizeai/phoenix-client";
import {
  asEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";
import type { Example } from "@arizeai/phoenix-client/types/datasets";
import OpenAI from "openai";
import { weatherAgent } from "../agents/weather-agent";

const phoenix = createClient();
const openai = new OpenAI();

/** Your AI Task  */
const task = async (example: Example) => {
  const response = await weatherAgent.generate([
    { role: "user", content: String(example.input.question) },
  ]);
  return response.text ?? "No response";
};

/** LLM Judge evaluator */
const correctnessEvaluator = asEvaluator({
  name: "Correctness",
  kind: "LLM",
  evaluate: async ({ input, output }) => {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an evaluator judging whether an AI assistant properly answered a user's question.
          Score the response from 0.0 to 1.0 based on:
          1. Did it directly address the user's question?
          2. Was the response accurate and helpful?
          3. Was the response complete?
          
          Respond in JSON format with:
          {
            "score": <float between 0.0 and 1.0>,
            "label": "correct" or "incorrect",
            "explanation": <brief explanation of your scoring>
          }`,
        },
        {
          role: "user",
          content: `User Question: ${input.question}\n\nAssistant Response: ${output}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const evaluation = JSON.parse(
      response.choices[0]?.message?.content ?? "{}",
    );

    return {
      score: evaluation.score ?? 0.0,
      label: evaluation.label ?? "not_answered",
      explanation: evaluation.explanation ?? "Failed to evaluate response",
      metadata: {},
    };
  },
});

await runExperiment({
  dataset: { datasetId: "RGF0YXNldDoxNw==" },
  experimentName: "experiment_name",
  client: phoenix,
  task,
  evaluators: [correctnessEvaluator],
});
