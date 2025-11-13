// This document is for a correctness eval on tools and goal completion for the agent.

import "dotenv/config";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";
import assert from "assert";

const model = openai("gpt-4o-mini");

const toolCorrectnessPrompt = `
In this task, you will be presented with a tool call input and its output. Your objective is to determine whether the tool's output is correct and appropriate for the given input.

A tool output is considered "correct" if:
1. The output directly addresses the tool's input/parameters
2. The output is in the expected format (e.g., movie list, reviews, summaries)
3. The output contains relevant and useful information
4. The output is coherent and well-formed
5. The output matches what the tool is supposed to produce

A tool output is considered "incorrect" if:
1. The output does not address the tool's input/parameters
2. The output is in the wrong format or structure
3. The output is incomplete or empty when it should contain data
4. The output contains errors or malformed data
5. The output is irrelevant to the tool's purpose

Your response should be a single word: either "correct" or "incorrect", and it should not include any other text or characters.

    [BEGIN DATA]
    ************
    [Tool Input]: {{input}}
    ************
    [Tool Output]: {{output}}
    ************
    [END DATA]

Is the tool output above correct or incorrect based on the tool input?
`;

const agentGoalCompletionPrompt = `
In this task, you will be presented with a user's goal/query and an agent's final response. Your objective is to determine whether the agent successfully completed the user's goal.

A response is considered "completed" if:
1. The response directly addresses the user's goal/query
2. The response provides a complete and satisfactory answer
3. The response includes all necessary information to fulfill the goal
4. The response is coherent and helpful
5. The agent successfully used the appropriate tools to achieve the goal

A response is considered "incomplete" if:
1. The response does not address the user's goal/query
2. The response is incomplete or missing key information
3. The response fails to use necessary tools or resources
4. The response contains errors or is unhelpful
5. The agent did not successfully complete the requested task

Your response should be a single word: either "completed" or "incomplete", and it should not include any other text or characters.

    [BEGIN DATA]
    ************
    [User Goal]: {{input}}
    ************
    [Agent Response]: {{output}}
    ************
    [END DATA]

Did the agent successfully complete the user's goal?
`;

function extractInputOutputFromSpan(span: any): {
  input: string | null;
  output: string | null;
} {
  let input: string | null = null;
  let output: string | null = null;

  if (span.attributes) {
    input = span.attributes["input.value"] || span.attributes["input"] || null;

    output =
      span.attributes["output.value"] || span.attributes["output"] || null;

    if (input && typeof input === "object") {
      input = JSON.stringify(input);
    }
    if (output && typeof output === "object") {
      output = JSON.stringify(output);
    }
  }

  if ((!input || !output) && span.events) {
    for (const event of span.events) {
      if (event.attributes) {
        if (!input && event.attributes["input"]) {
          input =
            typeof event.attributes["input"] === "string"
              ? event.attributes["input"]
              : JSON.stringify(event.attributes["input"]);
        }
        if (!output && event.attributes["output"]) {
          output =
            typeof event.attributes["output"] === "string"
              ? event.attributes["output"]
              : JSON.stringify(event.attributes["output"]);
        }
      }
    }
  }

  return { input, output };
}

async function main() {
  const phoenixEndpoint = process.env.PHOENIX_ENDPOINT;
  const projectName = process.env.PHOENIX_PROJECT_NAME || "mastra-project";

  if (!phoenixEndpoint) {
    throw new Error(
      "PHOENIX_ENDPOINT environment variable is required. Please set it in your .env file.",
    );
  }

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

  let allSpans: any[] = [];
  let cursor: string | null | undefined = undefined;

  do {
    const result = await getSpans({
      project: { projectName },
      startTime,
      endTime,
      cursor,
      limit: 100,
    });

    allSpans = allSpans.concat(result.spans);
    cursor = result.nextCursor || undefined;
  } while (cursor);

  const toolNames = ["movieselector", "reviewer", "previewsummarizer"];
  const toolSpans = allSpans.filter((span) => {
    const name = span.name?.toLowerCase() || "";
    const kind = span.kind?.toLowerCase() || "";

    const matchesToolName = toolNames.some((toolName) =>
      name.includes(toolName),
    );

    const isToolCall = kind === "tool" || kind === "function";

    return matchesToolName || isToolCall;
  });

  if (toolSpans.length === 0) {
    return;
  }

  const testCases: Array<{ input: string; output: string; spanId: string }> =
    [];

  for (const span of toolSpans) {
    const { input, output } = extractInputOutputFromSpan(span);
    if (input && output) {
      const spanId =
        span.global_id ||
        span.context?.span_id ||
        span.span_id ||
        span.id ||
        span.context?.spanId ||
        span.spanId;

      if (spanId) {
        let cleanSpanId = spanId.toString().replace(/^0x/, "");
        if (typeof spanId === "number") {
          cleanSpanId = spanId.toString(16);
        }

        testCases.push({ input, output, spanId: cleanSpanId });
      }
    }
  }

  if (testCases.length === 0) {
    return;
  }

  const evaluator = await createClassificationEvaluator({
    name: "correctness",
    model,
    choices: { correct: 1, incorrect: 0 },
    promptTemplate: toolCorrectnessPrompt,
  });

  const results = [];

  for (const testCase of testCases) {
    const result = await evaluator.evaluate({
      input: testCase.input,
      output: testCase.output,
    });

    results.push({
      spanId: testCase.spanId,
      input: testCase.input,
      output: testCase.output,
      label: result.label,
      score: result.score,
      explanation: result.explanation,
    });
  }

  const correctCount = results.filter((r) => r.label === "correct").length;
  const totalCount = results.length;

  assert(
    correctCount >= totalCount * 0.5,
    `Expected at least 50% of tests to pass, but only ${correctCount}/${totalCount} passed`,
  );

  const spanAnnotations = results.map((result) => ({
    spanId: result.spanId,
    name: "correctness",
    label: result.label,
    score: result.score,
    explanation: result.explanation || undefined,
    annotatorKind: "LLM" as const,
    metadata: {
      evaluator: "correctness",
      input: result.input.substring(0, 500),
      output: result.output.substring(0, 500),
    },
  }));

  try {
    await logSpanAnnotations({
      spanAnnotations,
      sync: true,
    });
  } catch (error) {}

  const toolSpanIds = new Set(
    toolSpans.map(
      (s) =>
        s.global_id ||
        s.context?.span_id ||
        s.span_id ||
        s.id ||
        s.context?.spanId ||
        s.spanId,
    ),
  );

  const spansByTrace = new Map<string, any[]>();
  for (const span of allSpans) {
    const traceId =
      span.context?.trace_id ||
      span.trace_id ||
      span.context?.traceId ||
      span.traceId;
    if (traceId) {
      if (!spansByTrace.has(traceId)) {
        spansByTrace.set(traceId, []);
      }
      spansByTrace.get(traceId)!.push(span);
    }
  }

  const rootSpansPerTrace: any[] = [];
  for (const [traceId, spans] of spansByTrace.entries()) {
    const rootSpansInTrace = spans.filter((span) => {
      const spanId =
        span.global_id ||
        span.context?.span_id ||
        span.span_id ||
        span.id ||
        span.context?.spanId ||
        span.spanId;
      const parentId =
        span.parent_span_id ||
        span.context?.parent_span_id ||
        span.parentSpanId ||
        span.context?.parentSpanId;

      if (!parentId) {
        return true;
      }
      const parentInTrace = spans.some((s) => {
        const sId =
          s.global_id ||
          s.context?.span_id ||
          s.span_id ||
          s.id ||
          s.context?.spanId ||
          s.spanId;
        return sId === parentId;
      });
      return !parentInTrace;
    });
    rootSpansPerTrace.push(...rootSpansInTrace);
  }

  const rootSpans = rootSpansPerTrace.filter((span) => {
    const name = span.name?.toLowerCase() || "";
    const kind = span.kind?.toLowerCase() || "";
    const spanId =
      span.global_id ||
      span.context?.span_id ||
      span.span_id ||
      span.id ||
      span.context?.spanId ||
      span.spanId;

    const matchesAgentName = name.includes("agent") || name.includes("movie");

    const isAgent =
      span.attributes?.["gen_ai.system"] === "agent" ||
      kind === "agent" ||
      kind === "llm";

    const isNotTool = spanId && !toolSpanIds.has(spanId);

    return (matchesAgentName || isAgent) && isNotTool;
  });

  if (rootSpans.length === 0) {
    return;
  }

  const agentTestCases: Array<{
    input: string;
    output: string;
    spanId: string;
  }> = [];

  for (const span of rootSpans) {
    const { input, output } = extractInputOutputFromSpan(span);
    if (input && output) {
      const spanId =
        span.global_id ||
        span.context?.span_id ||
        span.span_id ||
        span.id ||
        span.context?.spanId ||
        span.spanId;

      if (spanId) {
        let cleanSpanId = spanId.toString().replace(/^0x/, "");
        if (typeof spanId === "number") {
          cleanSpanId = spanId.toString(16);
        }

        agentTestCases.push({ input, output, spanId: cleanSpanId });
      }
    }
  }

  if (agentTestCases.length === 0) {
    return;
  }

  const goalEvaluator = await createClassificationEvaluator({
    name: "goal_completion",
    model,
    choices: { completed: 1, incomplete: 0 },
    promptTemplate: agentGoalCompletionPrompt,
  });

  const goalResults = [];

  for (const testCase of agentTestCases) {
    const result = await goalEvaluator.evaluate({
      input: testCase.input,
      output: testCase.output,
    });

    goalResults.push({
      spanId: testCase.spanId,
      input: testCase.input,
      output: testCase.output,
      label: result.label,
      score: result.score,
      explanation: result.explanation,
    });
  }

  const goalAnnotations = goalResults.map((result) => ({
    spanId: result.spanId,
    name: "goal_completion",
    label: result.label,
    score: result.score,
    explanation: result.explanation || undefined,
    annotatorKind: "LLM" as const,
    metadata: {
      evaluator: "goal_completion",
      input: result.input.substring(0, 500),
      output: result.output.substring(0, 500),
    },
  }));

  try {
    await logSpanAnnotations({
      spanAnnotations: goalAnnotations,
      sync: true,
    });
  } catch (error) {}
}

main().catch(() => {
  process.exit(1);
});
