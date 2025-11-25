import { createDataset } from "@arizeai/phoenix-client/datasets";
import {
  asExperimentEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";
import { createDocumentRelevancyEvaluator } from "@arizeai/phoenix-evals/llm/createDocumentRelevancyEvaluator";

import "dotenv/config";

import { spaceKnowledgeApplication } from "./app";

import { openai } from "@ai-sdk/openai";

const DATASET = [
  "Which moon might harbor life due to its unique geological features?",
  "What theoretical region marks the outer boundary of the Solar System?",
  "Which planet defies the typical rotation pattern observed in most celestial bodies?",
  "Where in the Solar System would you experience the most extreme atmospheric conditions?",
  "How dominant is the Sun's gravitational influence compared to all other objects in our solar system?",
  "What region of the Solar System contains remnants from its early formation beyond the gas giants?",
  "What significant change occurred in our understanding of planetary classification in 2006?",
  "What environmental challenge would explorers face during certain seasons on Mars?",
  "What makes Venus one of the most hostile environments for robotic exploration?",
  "What unique liquid features exist on Saturn's largest moon?",
  "What is the duration of the longest-observed storm in our Solar System?",
  "Which celestial body experiences the most intense geological activity?",
  "Which planet experiences the most dramatic temperature swings between day and night?",
  "What region separates the inner and outer planets in our Solar System?",
  "What unusual orbital characteristic makes Uranus unique among the planets?",
];

async function main() {
  async function task(example) {
    const question = example.input.question;
    const result = await spaceKnowledgeApplication(question);
    return result.context || "";
  }

  const dataset = await createDataset({
    name: "document-relevancy-eval",
    description:
      "Queries that are answered by extracting context from the space knowledge base",
    examples: DATASET.map((question) => ({
      input: {
        question: question,
      },
    })),
  });

  const documentRelevancyEvaluator = createDocumentRelevancyEvaluator({
    model: openai("gpt-5"),
  });

  const documentRelevancyCheck = asExperimentEvaluator({
    name: "document-relevancy",
    kind: "LLM",
    evaluate: async ({ input, output }) => {
      // Use the document relevancy evaluator from phoenix-evals
      const result = await documentRelevancyEvaluator.evaluate({
        input: String(input.question),
        documentText: String(output),
      });

      return result;
    },
  });

  await runExperiment({
    experimentName: "document-relevancy-experiment",
    experimentDescription:
      "Evaluate the relevancy of extracted context from a knowledge base",
    dataset: dataset,
    task,
    evaluators: [documentRelevancyCheck],
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
