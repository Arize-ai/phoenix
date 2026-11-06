// This document is for a correctness eval on tools and goal completion for the agent.

import assert from "assert";
import { openai } from "@ai-sdk/openai";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";

import "dotenv/config";

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

interface SpanLike {
  attributes?: Record<string, unknown>;
  events?: Array<{ attributes?: Record<string, unknown> }>;
  name?: string;
  kind?: string;
  global_id?: string;
  context?: Record<string, unknown>;
  span_id?: string;
  id?: string;
  spanId?: string;
  parent_span_id?: string;
  parentSpanId?: string;
  trace_id?: string;
  traceId?: string;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value != null) return JSON.stringify(value);
  return null;
}

function extractInputOutputFromSpan(span: SpanLike): {
  input: string | null;
  output: string | null;
} {
  let input: string | null = null;
  let output: string | null = null;

  if (span.attributes) {
    input = toStringValue(
      span.attributes["input.value"] ?? span.attributes["input"]
    );
    output = toStringValue(
      span.attributes["output.value"] ?? span.attributes["output"]
    );
  }

  if ((!input || !output) && span.events) {
    for (const event of span.events) {
      if (event.attributes) {
        if (!input) {
          input = toStringValue(event.attributes["input"]);
        }
        if (!output) {
          output = toStringValue(event.attributes["output"]);
        }
      }
    }
  }

  return { input, output };
}

type EvaluationCase = { input: string; output: string; spanId: string };
type EvaluationResult = EvaluationCase & {
  label: string | null;
  score: number | null;
  explanation: string | null;
};

function getSpanId(span: SpanLike): string | number | undefined {
  return (
    span.global_id ||
    (span.context?.span_id as string | undefined) ||
    span.span_id ||
    span.id ||
    (span.context?.spanId as string | undefined) ||
    span.spanId
  );
}

function getTraceId(span: SpanLike): string | undefined {
  return (
    (span.context?.trace_id as string | undefined) ||
    span.trace_id ||
    (span.context?.traceId as string | undefined) ||
    span.traceId
  );
}

function getParentSpanId(span: SpanLike): string | undefined {
  return (
    span.parent_span_id ||
    (span.context?.parent_span_id as string | undefined) ||
    span.parentSpanId ||
    (span.context?.parentSpanId as string | undefined)
  );
}

async function fetchRecentSpans(projectName: string): Promise<SpanLike[]> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
  const spans: SpanLike[] = [];
  let cursor: string | null | undefined;
  do {
    const result = await getSpans({
      project: { projectName },
      startTime,
      endTime,
      cursor,
      limit: 100,
    });
    spans.push(...result.spans);
    cursor = result.nextCursor || undefined;
  } while (cursor);
  return spans;
}

function toEvaluationCases(spans: SpanLike[]): EvaluationCase[] {
  return spans.flatMap((span) => {
    const { input, output } = extractInputOutputFromSpan(span);
    const spanId = getSpanId(span);
    if (!input || !output || spanId == null) return [];
    const normalizedSpanId =
      typeof spanId === "number"
        ? spanId.toString(16)
        : String(spanId).replace(/^0x/, "");
    return [{ input, output, spanId: normalizedSpanId }];
  });
}

function getToolSpans(spans: SpanLike[]): SpanLike[] {
  const toolNames = ["movieselector", "reviewer", "previewsummarizer"];
  return spans.filter((span) => {
    const name = span.name?.toLowerCase() || "";
    const kind = span.kind?.toLowerCase() || "";
    return (
      toolNames.some((toolName) => name.includes(toolName)) ||
      kind === "tool" ||
      kind === "function"
    );
  });
}

function getAgentRootSpans({
  spans,
  toolSpans,
}: {
  spans: SpanLike[];
  toolSpans: SpanLike[];
}): SpanLike[] {
  const toolSpanIds = new Set(toolSpans.map(getSpanId));
  const spansByTrace = new Map<string, SpanLike[]>();
  for (const span of spans) {
    const traceId = getTraceId(span);
    if (!traceId) continue;
    spansByTrace.set(traceId, [...(spansByTrace.get(traceId) ?? []), span]);
  }
  return Array.from(spansByTrace.values())
    .flatMap((traceSpans) =>
      traceSpans.filter((span) => {
        const parentId = getParentSpanId(span);
        return (
          !parentId ||
          !traceSpans.some((candidate) => getSpanId(candidate) === parentId)
        );
      })
    )
    .filter((span) => {
      const name = span.name?.toLowerCase() || "";
      const kind = span.kind?.toLowerCase() || "";
      const isAgent =
        span.attributes?.["gen_ai.system"] === "agent" ||
        kind === "agent" ||
        kind === "llm";
      return (
        (name.includes("agent") || name.includes("movie") || isAgent) &&
        !toolSpanIds.has(getSpanId(span))
      );
    });
}

async function evaluateCases({
  cases,
  name,
  choices,
  promptTemplate,
}: {
  cases: EvaluationCase[];
  name: string;
  choices: Record<string, number>;
  promptTemplate: string;
}): Promise<EvaluationResult[]> {
  const evaluator = await createClassificationEvaluator({
    name,
    model,
    choices,
    promptTemplate,
  });
  const results: EvaluationResult[] = [];
  for (const testCase of cases) {
    const result = await evaluator.evaluate(testCase);
    results.push({ ...testCase, ...result });
  }
  return results;
}

async function logEvaluationResults({
  results,
  name,
}: {
  results: EvaluationResult[];
  name: string;
}): Promise<void> {
  const spanAnnotations = results.map((result) => ({
    spanId: result.spanId,
    name,
    label: result.label,
    score: result.score,
    explanation: result.explanation || undefined,
    annotatorKind: "LLM" as const,
    metadata: {
      evaluator: name,
      input: result.input.substring(0, 500),
      output: result.output.substring(0, 500),
    },
  }));
  try {
    await logSpanAnnotations({ spanAnnotations, sync: true });
  } catch (_error) {}
}

async function main() {
  if (
    !process.env.PHOENIX_ENDPOINT &&
    !process.env.PHOENIX_COLLECTOR_ENDPOINT
  ) {
    throw new Error(
      "PHOENIX_ENDPOINT (or PHOENIX_COLLECTOR_ENDPOINT) environment variable is required"
    );
  }
  const spans = await fetchRecentSpans(
    process.env.PHOENIX_PROJECT_NAME || "mastra-project"
  );
  const toolSpans = getToolSpans(spans);
  const toolCases = toEvaluationCases(toolSpans);
  if (toolCases.length === 0) return;

  const correctnessResults = await evaluateCases({
    cases: toolCases,
    name: "correctness",
    choices: { correct: 1, incorrect: 0 },
    promptTemplate: toolCorrectnessPrompt,
  });
  const correctCount = correctnessResults.filter(
    (result) => result.label === "correct"
  ).length;
  assert(
    correctCount >= correctnessResults.length * 0.5,
    `Expected at least 50% of tests to pass, but only ${correctCount}/${correctnessResults.length} passed`
  );
  await logEvaluationResults({
    results: correctnessResults,
    name: "correctness",
  });

  const agentCases = toEvaluationCases(getAgentRootSpans({ spans, toolSpans }));
  if (agentCases.length === 0) return;
  const goalResults = await evaluateCases({
    cases: agentCases,
    name: "goal_completion",
    choices: { completed: 1, incomplete: 0 },
    promptTemplate: agentGoalCompletionPrompt,
  });
  await logEvaluationResults({ results: goalResults, name: "goal_completion" });
}

main().catch(() => {
  process.exit(1);
});
