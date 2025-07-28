import { createDocumentRelevancyEvaluator } from "../src/llm";
import { openai } from "@ai-sdk/openai";
import { createDataset } from "@arizeai/phoenix-client/datasets";
import {
  asEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";
const relevanceEvaluator = createDocumentRelevancyEvaluator({
  model: openai("gpt-4o-mini"),
});

const examples = [
  {
    documentText:
      "A partly submerged glacier cave on Perito Moreno Glacier . The ice facade is approximately 60 m high Ice formations in the Titlis glacier cave A glacier cave is a cave formed within the ice of a glacier . Glacier caves are often called ice caves , but this term is properly used to describe bedrock caves that contain year-round ice.",
    input: "how are glacier caves formed?",
    relevant: true,
  },
  {
    documentText:
      "The outdoor wood boiler is a variant of the classic wood stove adapted for set-up outdoors while still transferring the heat to interior buildings.",
    input: "how an outdoor wood boiler works",
    relevant: false,
  },
  {
    documentText:
      "The simplified internal structure of a chloroplast Overview of the Calvin cycle and carbon fixation The light-independent reactions of photosynthesis are chemical reactions that convert carbon dioxide and other compounds into glucose . These reactions occur in the stroma , the fluid-filled area of a chloroplast outside of the thylakoid membranes. These reactions take the light-dependent reactions and perform further chemical processes on them. There are three phases to the light-independent reactions, collectively called the Calvin cycle : carbon fixation, reduction reactions, and ribulose 1,5-bisphosphate (RuBP) regeneration. Despite its name, this process occurs only when light is available. Plants do not carry out the Calvin cycle by night. They, instead, release sucrose into the phloem from their starch reserves. This process happens when light is available independent of the kind of photosynthesis ( C3 carbon fixation , C4 carbon fixation , and Crassulacean Acid Metabolism ); CAM plants store malic acid in their vacuoles every night and release it by day in order to make this process work.",
    input: "what happens to the light independent reactions of photosynthesis?",
    relevant: true,
  },
];

type TaskOutput = {
  expected_label: "hallucinated" | "factual";
  label: "hallucinated" | "factual";
  score: number;
  explanation: string;
};

const correctEvaluator = asEvaluator({
  name: "correctness",
  kind: "CODE",
  evaluate: async (args) => {
    return {
      label:
        args.output.label === args.expected.label ? "correct" : "incorrect",
      score: args.output.label === args.expected.label ? 1 : 0,
      explanation: ``,
      metadata: {},
    };
  },
});

async function main() {
  const dataset = await createDataset({
    name: "document-relevancy-eval" + Math.random(),
    description: "Evaluate the relevancy of the model",
    examples: examples.map((example) => ({
      input: { question: example.input, documentText: example.documentText },
      output: {
        label: example.relevant ? "relevant" : "unrelated",
      },
      metadata: {},
    })),
  });

  const task = async (example) => {
    const evalResult = await relevanceEvaluator({
      input: example.input.question as string,
      documentText: example.input.documentText as string,
    });

    return {
      ...evalResult,
    };
  };
  runExperiment({
    experimentName: "document-relevancy-eval",
    experimentDescription: "Evaluate the relevancy of the model",
    concurrency: 8,
    dataset: dataset,
    task,
    evaluators: [correctEvaluator],
  });
}

main();
