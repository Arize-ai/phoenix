/* eslint-disable no-console */
/**
 * Example: Evaluating a tool-calling agent with experiments
 *
 * This example simulates a simple tool-calling agent that answers questions by
 * dispatching to the right tool (getWeather, getTime). It then uses Phoenix
 * experiments to verify the agent called the correct tool for each question.
 *
 * Flow:
 * 1. Define the agent's tools (traced with OpenTelemetry so spans are recorded)
 * 2. Create a dataset of questions with expected tool calls
 * 3. Run the agent against each dataset example as an experiment
 * 4. Evaluate by fetching spans from each run's trace to check tool usage
 *
 * Prerequisites:
 * - Phoenix server running on http://localhost:6006
 */
import { traceTool } from "@arizeai/phoenix-otel";

import { createClient } from "../src/client";
import { createOrGetDataset } from "../src/datasets";
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

// ---------------------------------------------------------------------------
// Step 1: Define the agent's tools
// ---------------------------------------------------------------------------
// Each tool is wrapped with `traceTool` so that calling it creates a TOOL span
// in the active OpenTelemetry trace. This is what lets us inspect tool usage
// after the fact.

const getWeather = traceTool(
  ({ location }: { location: string }) => ({
    location,
    temperature: Math.round(50 + Math.random() * 40),
    condition: "sunny",
  }),
  { name: "getWeather" }
);

const getTime = traceTool(
  ({ timezone }: { timezone: string }) => ({
    timezone,
    time: new Date().toLocaleTimeString("en-US", { timeZone: timezone }),
  }),
  { name: "getTime" }
);

// ---------------------------------------------------------------------------
// Step 2: Define the agent
// ---------------------------------------------------------------------------
// A minimal tool-calling agent: it reads the user question, decides which tool
// to call, invokes it, and returns a natural-language answer.

function runAgent(question: string) {
  if (question.toLowerCase().includes("weather")) {
    const city = question.match(/in (.+)\?/)?.[1] ?? "Unknown";
    const result = getWeather({ location: city });
    return `The weather in ${result.location} is ${result.temperature}F and ${result.condition}.`;
  }
  if (question.toLowerCase().includes("time")) {
    const tz = question.toLowerCase().includes("tokyo") ? "Asia/Tokyo" : "UTC";
    const result = getTime({ timezone: tz });
    return `The time in ${result.timezone} is ${result.time}.`;
  }
  return "I don't know how to answer that.";
}

// ---------------------------------------------------------------------------
// Step 3: Build the evaluator
// ---------------------------------------------------------------------------
// After each experiment run, we fetch the TOOL spans from its trace and check
// whether the expected tool was called. This validates the agent's routing
// logic end-to-end.

function createToolCallEvaluator(projectName: string) {
  return asExperimentEvaluator({
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
  });
}

// ---------------------------------------------------------------------------
// Step 4: Run the experiment and evaluate
// ---------------------------------------------------------------------------

async function main() {
  // 4a. Create a dataset of questions, each annotated with which tool the
  //     agent should call.
  const { datasetId } = await createOrGetDataset({
    client,
    name: `tool-call-example-dataset`,
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

  // 4b. Run the agent against every dataset example.
  //     `setGlobalTracerProvider` ensures that traceTool picks up the
  //     experiment's tracer, so TOOL spans land in the same trace as the run.
  const experiment = await runExperiment({
    client,
    dataset: { datasetId },
    setGlobalTracerProvider: true,
    task: async (example) => {
      return runAgent(example.input.question as string);
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

  // 4c. Evaluate: fetch spans from each run's trace and verify tool usage.
  //     Brief pause to let Phoenix finish ingesting the exported spans.
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const evaluated = await evaluateExperiment({
    client,
    experiment,
    evaluators: [createToolCallEvaluator(projectName)],
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
