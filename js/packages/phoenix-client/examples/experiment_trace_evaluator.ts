/* eslint-disable no-console */
/**
 * Example: Using traceId in evaluators to validate tool calls
 *
 * Demonstrates how to:
 * 1. Run an experiment where the task creates TOOL spans via OpenTelemetry
 * 2. Use evaluateExperiment with evaluators that fetch spans by traceId
 * 3. Validate that specific tool calls occurred during each task run
 *
 * Prerequisites:
 * - Phoenix server running on http://localhost:6006
 */
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";
import { trace } from "@opentelemetry/api";

import { createClient } from "../src/client";
import { createDataset } from "../src/datasets";
import {
  asExperimentEvaluator,
  evaluateExperiment,
  runExperiment,
} from "../src/experiments";
import { getSpans } from "../src/spans/getSpans";

const client = createClient({
  options: {
    baseUrl: "http://localhost:6006",
  },
});

// Simulated tools that the task can call
const tools: Record<string, (args: Record<string, string>) => object> = {
  getWeather: ({ location }) => ({
    location,
    temperature: Math.round(50 + Math.random() * 40),
    condition: "sunny",
  }),
  getTime: ({ timezone }) => ({
    timezone,
    time: new Date().toLocaleTimeString("en-US", { timeZone: timezone }),
  }),
};

// Simulate a tool call by creating an OpenTelemetry TOOL span
function callTool(name: string, args: Record<string, string>): object {
  const tracer = trace.getTracer("tool-call-example");
  let result: object = {};
  tracer.startActiveSpan(name, (span) => {
    span.setAttribute(SemanticConventions.OPENINFERENCE_SPAN_KIND, "TOOL");
    span.setAttribute(SemanticConventions.INPUT_VALUE, JSON.stringify(args));
    const toolFn = tools[name];
    if (!toolFn) throw new Error(`Unknown tool: ${name}`);
    result = toolFn(args);
    span.setAttribute(SemanticConventions.OUTPUT_VALUE, JSON.stringify(result));
    span.end();
  });
  return result;
}

async function main() {
  const { datasetId } = await createDataset({
    client,
    name: `tool-call-dataset-${Date.now()}`,
    description: "Questions that require tool use",
    examples: [
      {
        input: { question: "What is the weather in San Francisco?" },
        output: { expectedTool: "getWeather" },
        metadata: {},
      },
      {
        input: { question: "What time is it in Tokyo?" },
        output: { expectedTool: "getTime" },
        metadata: {},
      },
      {
        input: { question: "What is the weather in London?" },
        output: { expectedTool: "getWeather" },
        metadata: {},
      },
    ],
  });

  // Step 1: Run the experiment (task only, no evaluators yet).
  // setGlobalTracerProvider lets trace.getTracer() inside the task pick up
  // the experiment's tracer provider, so child TOOL spans land in the same trace.
  const experiment = await runExperiment({
    client,
    dataset: { datasetId },
    setGlobalTracerProvider: true,
    task: async (example) => {
      const question = example.input.question as string;

      if (question.toLowerCase().includes("weather")) {
        const city = question.match(/in (.+)\?/)?.[1] ?? "Unknown";
        const result = callTool("getWeather", { location: city });
        return `The weather in ${(result as { location: string }).location} is ${(result as { temperature: number }).temperature}F and ${(result as { condition: string }).condition}.`;
      }
      if (question.toLowerCase().includes("time")) {
        const tz = question.toLowerCase().includes("tokyo")
          ? "Asia/Tokyo"
          : "UTC";
        const result = callTool("getTime", { timezone: tz });
        return `The time in ${(result as { timezone: string }).timezone} is ${(result as { time: string }).time}.`;
      }
      return "I don't know how to answer that.";
    },
  });

  const projectName = experiment.projectName!;
  console.log(`\nProject: ${projectName}`);

  console.log("\n--- Experiment Runs ---");
  console.table(
    Object.values(experiment.runs).map((r) => ({
      id: r.id,
      traceId: r.traceId,
      output:
        typeof r.output === "string"
          ? r.output.slice(0, 80)
          : JSON.stringify(r.output)?.slice(0, 80),
      error: r.error,
    }))
  );

  // Step 2: Evaluate the experiment using traceId to fetch spans.
  // Wait briefly for Phoenix to finish ingesting the OTLP span export.
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const evaluated = await evaluateExperiment({
    client,
    experiment,
    evaluators: [
      asExperimentEvaluator({
        name: "has-expected-tool-call",
        kind: "CODE",
        evaluate: async ({ traceId, expected }) => {
          if (!traceId) {
            return {
              label: "no trace",
              score: 0,
              explanation: "No trace ID available for this task run",
            };
          }

          // Fetch TOOL spans from this task's trace
          const { spans: toolSpans } = await getSpans({
            client,
            project: { projectName },
            traceIds: [traceId],
            spanKind: "TOOL",
          });

          const expectedTool = (expected as { expectedTool?: string })
            ?.expectedTool;
          const toolNames = toolSpans.map((s) => s.name);
          const found = expectedTool
            ? toolNames.some((name) => name.includes(expectedTool))
            : toolSpans.length > 0;

          return {
            label: found ? "tool called" : "no tool call",
            score: found ? 1 : 0,
            explanation: found
              ? `Found tool spans: ${toolNames.join(", ")}`
              : `Expected "${expectedTool}" but found: ${toolNames.join(", ") || "none"}`,
            metadata: { toolSpanCount: toolSpans.length, toolNames },
          };
        },
      }),
    ],
  });

  console.log("\n--- Evaluation Results ---");
  console.table(
    evaluated.evaluationRuns?.map((e) => ({
      name: e.name,
      label: e.result?.label,
      score: e.result?.score,
      explanation: e.result?.explanation,
    }))
  );
}

main().catch(console.error);
