
import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { movieAgent } from "../mastra/agents/movie-agent";
import { createOrGetDataset } from "@arizeai/phoenix-client/datasets";
import type { Example } from "@arizeai/phoenix-client/types/datasets";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";



// Step 1: define the task to run (we call the agent with the question)
export async function task(example: Example): Promise<string> {
    const question = example.input.question as string;

    // Call the movie agent with the question
    const result = await movieAgent.generate(question);

    // Extract the text response from the result
    return result.text || "";
}

// Step 2: define the dataset of questions to ask the agent
const DATASET = [
    "Which horror movie should I watch next?",
    "Give me a good comedy movie to watch tonight.",
    "Recommend a comedy that is also a musical",
    "Show me a popular movie that didn’t do well at the box office",
    "What horror movies are not too violent",
    "Name a feel-good holiday movie",
    "Recommend a musical with great songs",
    "Give me a classic drama from the 90s",
    "Name a movie that is a classic action movie",
    "Which Batman movie should I watch?"
]

export const dataset = await createOrGetDataset({
    name: "movie-rec-questions100001",
    description: "Questions to ask a movie recommendation agent",
    examples: DATASET.map(question => ({
      input: {
        question: question,
      },
    })),
  });

// Step 3: Define the evaluators
const RECOMMENDATION_RELEVANCE = `
  You are evaluating the relevance of movie recommendations provided by an LLM application.

  You will be given:
  1. The user input that initiated the trace
  2. The list of movie recommendations output by the system

  ##
  User Input:
  {{input.question}}

  Recommendations:
  {{output}}
  ##

  Respond with exactly one word: \`correct\` or \`incorrect\`.
  1. \`correct\` →
  - All recommended movies match the requested genre or criteria in the user input.
  - The recommendations should be relevant to the user's request and shouldn't be repetitive.
  - \`incorrect\` → one or more recommendations do not match the requested genre or criteria.
  `;

  
  export const recommendationRelevanceEvaluator = createClassificationEvaluator({
    name: "Relevance",
    model: openai("gpt-5"),
    promptTemplate: RECOMMENDATION_RELEVANCE,
    choices: {
      correct: 1,
      incorrect: 0,
    },
  });
    

