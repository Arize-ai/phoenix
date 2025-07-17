/* eslint-disable no-console */
import { createClient } from "../src";
import { Example } from "../src/types/datasets";
import { createDataset } from "../src/datasets/createDataset";
import { getDataset } from "../src/datasets/getDataset";

// Initialize Phoenix client
const client = createClient();

async function main() {
  try {
    // Get the dataset by name
    console.log("Getting dataset by name...");
    const dataset = await getDataset({
      client,
      dataset: { datasetName: "dataset-get-by-name" },
    });
    console.log("Retrieved dataset:", dataset.id);
    console.log("Retrieved dataset:", dataset.name);
    console.log("Retrieved dataset:", dataset.description);
    console.log("Retrieved dataset:", dataset.examples);
    console.log("Retrieved dataset:", dataset.metadata);
    return;
  } catch (e) {
    console.error(e);
  }

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
    name: "dataset-get-by-name",
    description: "Dataset for get-by-name example",
    examples: examples,
  });
  console.log("Created dataset with examples:", datasetId);
}

main();
