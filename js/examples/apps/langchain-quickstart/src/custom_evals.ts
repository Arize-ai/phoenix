import "dotenv/config";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";

const EVAL_NAME = "custom_correctness";
const AGENT_SPAN_NAME = "LangGraph";
const PROJECT_NAME =
  process.env.PHOENIX_PROJECT_NAME ?? "langchain-travel-agent";

const correctnessTemplate = `
You are an expert evaluator judging whether a travel planner agent's response is correct. The agent is a friendly travel planner that must combine multiple tools to create a trip plan with: (1) essential info, (2) budget breakdown, and (3) local flavor/experiences.

CORRECT - The response:
- Accurately addresses the user's destination, duration, and stated interests
- Includes essential travel info (e.g., weather, best time to visit, key attractions, etiquette) for the destination
- Includes a budget or cost breakdown appropriate to the destination and trip duration
- Includes local experiences, cultural highlights, or authentic recommendations matching the user's interests
- Is factually accurate, logically consistent, and helpful for planning the trip
- Uses precise, travel-appropriate terminology

INCORRECT - The response contains any of:
- Factual errors about the destination, costs, or local info
- Missing essential info when the user asked for a full trip plan
- Missing or irrelevant budget information for the given destination/duration
- Missing or generic local experiences that do not match the user's interests
- Wrong destination, duration, or interests addressed
- Contradictions, misleading statements, or unhelpful/off-topic content

[BEGIN DATA]
************
[User Input]:
{{input}}

************
[Travel Plan]:
{{output}}
************
[END DATA]

Focus on factual accuracy and completeness of the trip plan (essentials, budget, local flavor). Is the output correct or incorrect?
`;

function toString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v != null) return JSON.stringify(v);
  return null;
}

interface SpanLike {
  name?: string;
  span_name?: string;
  attributes?: Record<string, unknown>;
  context?: { span_id?: string };
  span_id?: string;
  id?: string;
}

function getInputOutput(span: SpanLike): {
  input: string | null;
  output: string | null;
} {
  const attrs = span.attributes ?? {};
  const input = toString(attrs["input.value"] ?? attrs["input"]);
  const output = toString(attrs["output.value"] ?? attrs["output"]);
  return { input, output };
}

function getSpanId(span: SpanLike): string | null {
  const id = span.context?.span_id ?? span.span_id ?? span.id;
  return id != null ? String(id) : null;
}

async function main() {
  const base_model = openai("gpt-4o-mini");

  const evaluator = createClassificationEvaluator({
    model: base_model as Parameters<
      typeof createClassificationEvaluator
    >[0]["model"],
    promptTemplate: correctnessTemplate,
    choices: { correct: 1, incorrect: 0 },
    name: EVAL_NAME,
  });

  const { spans } = await getSpans({
    project: { projectName: PROJECT_NAME },
    limit: 500,
  });

  const toEvaluate: { spanId: string; input: string; output: string }[] = [];
  for (const s of spans as SpanLike[]) {
    if ((s.name ?? s.span_name) !== AGENT_SPAN_NAME) continue;
    const { input, output } = getInputOutput(s);
    const spanId = getSpanId(s);
    if (input && output && spanId) toEvaluate.push({ spanId, input, output });
  }

  const spanAnnotations = await Promise.all(
    toEvaluate.map(async ({ spanId, input, output }) => {
      const { label, score, explanation } = await evaluator.evaluate({
        input,
        output,
      });
      return {
        spanId,
        name: EVAL_NAME as "custom_correctness",
        label,
        score,
        explanation,
        annotatorKind: "LLM" as const,
        metadata: { evaluator: EVAL_NAME, input, output },
      };
    }),
  );

  await logSpanAnnotations({ spanAnnotations, sync: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
