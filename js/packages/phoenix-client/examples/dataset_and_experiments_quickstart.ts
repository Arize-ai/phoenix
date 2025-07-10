/* eslint-disable no-console */
import { OpenAI } from "openai";
import { createClient } from "../src";
import {
  runExperiment,
  asEvaluator,
  RunExperimentParams,
} from "../src/experiments";
import { AnnotatorKind } from "../src/types/annotations";
import { Example } from "../src/types/datasets";
import { createDataset } from "../src/datasets/createDataset";

// Replace with your actual OpenAI API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Please set the OPENAI_API_KEY environment variable");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Initialize Phoenix client
const client = createClient();

// Launch Phoenix app in browser - Note: In a script, you would need to use a web server
// or the user would need to open the Phoenix UI separately
console.log("Access Phoenix UI at http://localhost:6006");

async function main() {
  // First, create a dataset via the API
  console.log("Creating dataset...");

  // Create examples without id field since it's not expected in the Example type
  const examples = [
    {
      input: { question: "What is Paul Graham known for?" },
      output: {
        answer:
          "Co-founding Y Combinator and writing on startups and techology.",
      },
      metadata: { topic: "tech" },
    },
    {
      input: { question: "What companies did Elon Musk found?" },
      output: {
        answer:
          "Tesla, SpaceX, Neuralink, The Boring Company, and co-founded PayPal.",
      },
      metadata: { topic: "entrepreneurs" },
    },
    {
      input: { question: "What is Moore's Law?" },
      output: {
        answer:
          "The observation that the number of transistors in a dense integrated circuit doubles about every two years.",
      },
      metadata: { topic: "computing" },
    },
  ] satisfies Example[];

  // Create a dataset with the examples
  console.log("Creating dataset with examples...");
  const { datasetId } = await createDataset({
    client,
    name: `quickstart-dataset-${Date.now()}`,
    description: "Dataset for quickstart example",
    examples: examples,
  });

  // Define task function that will be evaluated
  const taskPromptTemplate = "Answer in a few words: {question}";

  const task: RunExperimentParams["task"] = async (example: Example) => {
    // Safely access question with a type assertion
    const question =
      (example.input.question as string) || "No question provided";
    const messageContent = taskPromptTemplate.replace("{question}", question);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: messageContent }],
    });

    return { answer: response.choices[0]?.message?.content || "" };
  };

  // Define evaluators for the experiment

  // 1. Code-based evaluator that checks if response contains specific keywords
  const containsKeyword = asEvaluator({
    name: "contains_keyword",
    kind: "CODE" as AnnotatorKind,
    evaluate: async ({ output }) => {
      const keywords = ["Y Combinator", "YC"];
      const outputStr = String(output).toLowerCase();
      const contains = keywords.some((keyword) =>
        outputStr.toLowerCase().includes(keyword.toLowerCase())
      );

      return {
        score: contains ? 1.0 : 0.0,
        label: contains ? "contains_keyword" : "missing_keyword",
        metadata: { keywords },
        explanation: contains
          ? `Output contains one of the keywords: ${keywords.join(", ")}`
          : `Output does not contain any of the keywords: ${keywords.join(", ")}`,
      };
    },
  });

  // 2. LLM-based evaluator for conciseness
  const conciseness = asEvaluator({
    name: "conciseness",
    kind: "LLM" as AnnotatorKind,
    evaluate: async ({ output }) => {
      const prompt = `
        Rate the following text on a scale of 0.0 to 1.0 for conciseness (where 1.0 is perfectly concise).
        
        TEXT: ${output}
        
        Return only a number between 0.0 and 1.0.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
      });

      const scoreText = response.choices[0]?.message?.content?.trim() || "0";
      const score = parseFloat(scoreText);

      return {
        score: isNaN(score) ? 0.5 : score,
        label: score > 0.7 ? "concise" : "verbose",
        metadata: {},
        explanation: `Conciseness score: ${score}`,
      };
    },
  });

  // 3. Custom Jaccard similarity evaluator
  const jaccardSimilarity = asEvaluator({
    name: "jaccard_similarity",
    kind: "CODE" as AnnotatorKind,
    evaluate: async ({ output, expected }) => {
      const actualWords = new Set(String(output).toLowerCase().split(" "));
      const expectedAnswer = (expected?.answer as string) || "";
      const expectedWords = new Set(expectedAnswer.toLowerCase().split(" "));

      const wordsInCommon = new Set(
        [...actualWords].filter((word) => expectedWords.has(word))
      );

      const allWords = new Set([...actualWords, ...expectedWords]);
      const score = wordsInCommon.size / allWords.size;

      return {
        score,
        label: score > 0.5 ? "similar" : "dissimilar",
        metadata: {
          actualWordsCount: actualWords.size,
          expectedWordsCount: expectedWords.size,
          commonWordsCount: wordsInCommon.size,
          allWordsCount: allWords.size,
        },
        explanation: `Jaccard similarity: ${score}`,
      };
    },
  });

  // 4. LLM-based accuracy evaluator
  const accuracy = asEvaluator({
    name: "accuracy",
    kind: "LLM" as AnnotatorKind,
    evaluate: async ({ input, output, expected }) => {
      // Safely access question and answer with type assertions and fallbacks
      const question = (input.question as string) || "No question provided";
      const referenceAnswer =
        (expected?.answer as string) || "No reference answer provided";

      const evalPromptTemplate = `
        Given the QUESTION and REFERENCE_ANSWER, determine whether the ANSWER is accurate.
        Output only a single word (accurate or inaccurate).
        
        QUESTION: {question}
        
        REFERENCE_ANSWER: {reference_answer}
        
        ANSWER: {answer}
        
        ACCURACY (accurate / inaccurate):
      `;

      const messageContent = evalPromptTemplate
        .replace("{question}", question)
        .replace("{reference_answer}", referenceAnswer)
        .replace("{answer}", String(output));

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: messageContent }],
      });

      const responseContent =
        response.choices[0]?.message?.content?.toLowerCase().trim() || "";
      const isAccurate = responseContent === "accurate";

      return {
        score: isAccurate ? 1.0 : 0.0,
        label: isAccurate ? "accurate" : "inaccurate",
        metadata: {},
        explanation: `LLM determined the answer is ${isAccurate ? "accurate" : "inaccurate"}`,
      };
    },
  });

  // Run the experiment with selected evaluators
  console.log("Running experiment...");

  // Use datasetId instead of the array of examples
  const experiment = await runExperiment({
    client,
    experimentName: "initial-experiment",
    dataset: { datasetId }, // Use the string dataset ID
    task,
    evaluators: [jaccardSimilarity, accuracy, containsKeyword, conciseness],
    logger: console,
  });

  console.log("Experiment completed with ID:", experiment.id);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
