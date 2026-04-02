/* eslint-disable no-console */
/**
 * Example: Using traceId in evaluators to validate tool calls
 *
 * Demonstrates how to:
 * 1. Run an experiment with a task that produces tool call spans
 * 2. Write an evaluator that uses the traceId to fetch spans from Phoenix
 * 3. Validate that specific tool calls occurred during the task
 *
 * Prerequisites:
 * - Phoenix server running on http://localhost:6006
 * - OPENAI_API_KEY set in environment
 * - @ai-sdk/openai and ai packages installed
 */
import { openai } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";

import { createClient } from "../src/client";
import { createDataset } from "../src/datasets";
import { asExperimentEvaluator, runExperiment } from "../src/experiments";
import { getSpans } from "../src/spans/getSpans";

const client = createClient({
  options: {
    baseUrl: "http://localhost:6006",
  },
});

// The project name under which experiment task traces are recorded
const PROJECT_NAME = `tool-call-experiment-${Date.now()}`;

async function main() {
  // Create a dataset of questions that require tool use
  const { datasetId } = await createDataset({
    client,
    name: `tool-call-dataset-${Date.now()}`,
    description: "Questions that require looking up the weather",
    examples: [
      {
        input: { question: "What is the weather in San Francisco?" },
        output: { tool: "getWeather" },
        metadata: {},
      },
      {
        input: { question: "What is the weather in New York?" },
        output: { tool: "getWeather" },
        metadata: {},
      },
      {
        input: { question: "What is the weather in London?" },
        output: { tool: "getWeather" },
        metadata: {},
      },
    ],
  });

  // Run the experiment
  const experiment = await runExperiment({
    client,
    dataset: { datasetId },
    projectName: PROJECT_NAME,
    evaluators: [
      // This evaluator uses the traceId to fetch the task's spans
      // and checks that a TOOL span was executed during the task
      asExperimentEvaluator({
        name: "has-tool-call",
        kind: "CODE",
        evaluate: async ({ traceId, expected }) => {
          if (!traceId) {
            return {
              label: "no trace",
              score: 0,
              explanation: "No trace ID available for this task run",
            };
          }

          // Fetch all TOOL spans from this task's trace
          const { spans: toolSpans } = await getSpans({
            client,
            project: { projectName: PROJECT_NAME },
            traceIds: [traceId],
            spanKind: "TOOL",
          });

          const expectedTool = (expected as { tool?: string })?.tool;
          const toolNames = toolSpans.map((s) => s.name);
          const found = expectedTool
            ? toolNames.some((name) => name.includes(expectedTool))
            : toolSpans.length > 0;

          return {
            label: found ? "tool called" : "no tool call",
            score: found ? 1 : 0,
            explanation: found
              ? `Found tool spans: ${toolNames.join(", ")}`
              : `Expected tool "${expectedTool}" but found: ${toolNames.join(", ") || "none"}`,
            metadata: {
              toolSpanCount: toolSpans.length,
              toolNames,
            },
          };
        },
      }),
    ],
    task: async (example) => {
      const question = example.input.question as string;

      const result = await generateText({
        model: openai("gpt-4o-mini"),
        experimental_telemetry: { isEnabled: true },
        tools: {
          getWeather: tool({
            description: "Get the current weather for a location",
            parameters: z.object({
              location: z.string().describe("The city to get weather for"),
            }),
            execute: async ({ location }) => ({
              location,
              temperature: Math.round(50 + Math.random() * 40),
              condition: "sunny",
            }),
          }),
        },
        maxSteps: 3,
        prompt: question,
      });

      return result.text;
    },
  });

  console.log("\n--- Experiment Runs ---");
  console.table(
    Object.values(experiment.runs).map((r) => ({
      id: r.id,
      traceId: r.traceId,
      output:
        typeof r.output === "string"
          ? r.output.slice(0, 60)
          : JSON.stringify(r.output)?.slice(0, 60),
      error: r.error,
    }))
  );

  console.log("\n--- Evaluation Results ---");
  console.table(
    experiment.evaluationRuns?.map((e) => ({
      name: e.name,
      label: e.result?.label,
      score: e.result?.score,
      explanation: e.result?.explanation,
    }))
  );
}

main().catch(console.error);
