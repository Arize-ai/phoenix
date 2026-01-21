/* eslint-disable no-console */
/**
 * Example: Create a dataset from spans with span ID links
 *
 * This example demonstrates how to:
 * 1. Fetch spans from a Phoenix project
 * 2. Extract input/output data from span attributes
 * 3. Create a dataset where each example is linked back to its source span
 *
 * Prerequisites:
 *   - Phoenix server running (default: http://localhost:6006)
 *   - A project with LLM spans containing input/output attributes
 *
 * Usage:
 *   npx tsx examples/create_dataset_from_spans.ts
 */

import { createClient } from "../src/client";
import { createDataset } from "../src/datasets/createDataset";
import { getSpans } from "../src/spans/getSpans";
import { Example } from "../src/types/datasets";

// Configuration
const PHOENIX_BASE_URL = "http://localhost:6006";
const PROJECT_NAME = "llm-dataset-example";
const DATASET_NAME = `qa-from-spans-${Date.now()}`;

/**
 * Parse a JSON string value, returning the parsed object or the original value
 */
function parseJsonValue(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Extract input value from span attributes
 */
function extractInput(
  attributes: Record<string, unknown>
): Record<string, unknown> {
  // OpenInference stores input in 'input.value' attribute
  const inputValue = attributes["input.value"];
  if (inputValue) {
    const parsed = parseJsonValue(inputValue);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  }
  return { raw_attributes: attributes };
}

/**
 * Extract output value from span attributes
 */
function extractOutput(
  attributes: Record<string, unknown>
): Record<string, unknown> {
  // OpenInference stores output in 'output.value' attribute
  const outputValue = attributes["output.value"];
  if (outputValue) {
    const parsed = parseJsonValue(outputValue);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  }
  return {};
}

/**
 * Extract metadata from span attributes
 */
function extractMetadata(
  attributes: Record<string, unknown>
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  // Extract common LLM attributes
  if (attributes["llm.model_name"]) {
    metadata.model = attributes["llm.model_name"];
  }
  if (attributes["llm.token_count.total"]) {
    metadata.total_tokens = attributes["llm.token_count.total"];
  }
  if (attributes["llm.token_count.prompt"]) {
    metadata.prompt_tokens = attributes["llm.token_count.prompt"];
  }
  if (attributes["llm.token_count.completion"]) {
    metadata.completion_tokens = attributes["llm.token_count.completion"];
  }

  return metadata;
}

async function main() {
  console.log("=".repeat(60));
  console.log("Phoenix Dataset from Spans - TypeScript Example");
  console.log("=".repeat(60));

  const client = createClient({
    options: {
      baseUrl: PHOENIX_BASE_URL,
    },
  });

  console.log(`\nConnected to Phoenix at ${PHOENIX_BASE_URL}`);

  try {
    // Step 1: Fetch spans from the project
    console.log(`\n[Step 1] Fetching spans from project '${PROJECT_NAME}'...`);

    const { spans } = await getSpans({
      client,
      project: { projectName: PROJECT_NAME },
      limit: 10,
    });

    console.log(`Found ${spans.length} spans`);

    if (spans.length === 0) {
      console.log(
        "\nNo spans found. Please ensure you have traces in your project."
      );
      console.log(
        "You can generate sample traces using the Phoenix instrumentation."
      );
      process.exit(0);
    }

    // Step 2: Transform spans into dataset examples with span ID links
    console.log("\n[Step 2] Transforming spans into dataset examples...");

    const examples: Example[] = spans.map((span) => {
      const attributes = span.attributes || {};

      return {
        input: extractInput(attributes),
        output: extractOutput(attributes),
        metadata: {
          ...extractMetadata(attributes),
          span_name: span.name,
          span_kind: span.span_kind,
        },
        // Link the example back to its source span using the span ID
        spanId: span.context.span_id,
      };
    });

    console.log(`Prepared ${examples.length} examples with span links`);

    // Display first few examples
    console.log("\nSample examples:");
    examples.slice(0, 3).forEach((example, index) => {
      console.log(`\n  Example ${index + 1}:`);
      console.log(`    Span ID: ${example.spanId}`);
      console.log(
        `    Input: ${JSON.stringify(example.input).slice(0, 60)}...`
      );
      console.log(
        `    Output: ${JSON.stringify(example.output).slice(0, 60)}...`
      );
    });

    // Step 3: Create the dataset with span associations
    console.log("\n[Step 3] Creating dataset with span associations...");

    const { datasetId } = await createDataset({
      client,
      name: DATASET_NAME,
      description: "Dataset created from LLM spans with trace associations",
      examples,
    });

    console.log(`\nCreated dataset successfully!`);
    console.log(`  Dataset ID: ${datasetId}`);
    console.log(`  Dataset Name: ${DATASET_NAME}`);
    console.log(`  Example Count: ${examples.length}`);

    console.log("\n" + "=".repeat(60));
    console.log("Example complete!");
    console.log(`View your dataset at: ${PHOENIX_BASE_URL}/datasets`);
    console.log(`  (Look for dataset: '${DATASET_NAME}')`);
    console.log(`View your traces at: ${PHOENIX_BASE_URL}/projects`);
    console.log(`  (Look for project: '${PROJECT_NAME}')`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\nError:", error);

    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      console.error(
        `\nMake sure Phoenix server is running on ${PHOENIX_BASE_URL}`
      );
    }

    process.exit(1);
  }
}

main();
