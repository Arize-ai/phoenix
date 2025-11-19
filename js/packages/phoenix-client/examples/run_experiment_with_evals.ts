import { createOrGetDataset } from "@arizeai/phoenix-client/datasets";
import { runExperiment } from "@arizeai/phoenix-client/experiments";
import type { ExperimentTask } from "@arizeai/phoenix-client/types/experiments";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const model = openai("gpt-4o-mini");

const main = async () => {
  // Create your evaluator
  const answersQuestion = createClassificationEvaluator({
    name: "answersQuestion",
    model,
    promptTemplate:
      "Does the following answer the user's question: <question>{{input.question}}</question><answer>{{output}}</answer>",
    choices: {
      correct: 1,
      incorrect: 0,
    },
  });

  // Create a dataset for your experiment
  const dataset = await createOrGetDataset({
    name: "correctness-eval",
    description: "Evaluate the correctness of the model",
    examples: [
      {
        input: {
          question: "Is ArizeAI Phoenix Open-Source?",
          context: "ArizeAI Phoenix is Open-Source.",
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

  // Run the experiment with automatic tracing
  runExperiment({
    experimentName: "answers-question-eval",
    experimentDescription:
      "Evaluate the ability of the model to answer questions based on the context",
    dataset: dataset,
    task,
    evaluators: [answersQuestion],
    repetitions: 3,
  });
};

main();
