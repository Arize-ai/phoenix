import { createOrGetDataset } from "@arizeai/phoenix-client/datasets";
import {
  asEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";
import type { ExperimentTask } from "@arizeai/phoenix-client/types/experiments";

import { createHallucinationEvaluator } from "../src/llm";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const model = openai("gpt-4o-mini");

const main = async () => {
  // Create your evaluator
  const hallucinationEvaluator = createHallucinationEvaluator({
    model,
  });

  // Create a dataset for your experiment
  const dataset = await createOrGetDataset({
    name: "hallucination-eval",
    description: "Evaluate the hallucination of the model",
    examples: [
      {
        input: {
          question: "Is ArizeAI Phoenix Open-Source?",
          context: "Phoenix is Open-Source.",
        },
      },
      // ... more examples
    ],
  });

  // Define your experimental task
  const task: ExperimentTask = async (example) => {
    if (typeof example.input.question !== "string") {
      throw new Error("Invalid input: question must be a string");
    }
    if (typeof example.input.context !== "string") {
      throw new Error("Invalid input: context must be a string");
    }
    // Your AI system's response to the question
    return generateText({
      model,
      experimental_telemetry: {
        isEnabled: true,
      },
      prompt: [
        {
          role: "system",
          content: `You answer questions based on this context: ${example.input.context}`,
        },
        {
          role: "user",
          content: example.input.question,
        },
      ],
    }).then((response) => {
      if (response.text) {
        return response.text;
      }
      throw new Error("Invalid response: text is required");
    });
  };

  // Create a custom evaluator to validate results
  const hallucinationCheck = asEvaluator({
    name: "hallucination",
    kind: "LLM",
    evaluate: async ({ input, output }) => {
      if (typeof input.question !== "string") {
        throw new Error("Invalid input: question must be a string");
      }
      if (typeof input.context !== "string") {
        throw new Error("Invalid input: context must be a string");
      }
      if (typeof output !== "string") {
        throw new Error("Invalid output: must be a string");
      }
      // Use the hallucination evaluator from phoenix-evals
      const result = await hallucinationEvaluator.evaluate({
        input: input.question,
        context: input.context, // Note: uses 'context' not 'reference'
        output: output,
      });

      return result; // Return the evaluation result
    },
  });

  // Run the experiment with automatic tracing
  runExperiment({
    experimentName: "hallucination-eval",
    experimentDescription: "Evaluate the hallucination of the model",
    dataset: dataset,
    task,
    evaluators: [hallucinationCheck],
    repetitions: 3,
  });
};

main();
