import { openai } from "@ai-sdk/openai";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";
import { createCorrectnessEvaluator } from "@arizeai/phoenix-evals";

import "dotenv/config";

const toStr = (v: unknown) =>
  typeof v === "string" ? v : v != null ? JSON.stringify(v) : null;

interface SpanLike {
  attributes?: Record<string, unknown>;
  name?: string;
  span_name?: string;
  context?: { span_id?: string };
  span_id?: string;
  id?: string;
}

function getInputOutput(span: SpanLike) {
  const attrs = span.attributes ?? {};
  const input = toStr(attrs["input.value"] ?? attrs["input"]);
  const output = toStr(attrs["output.value"] ?? attrs["output"]);
  return { input, output };
}

async function main() {
  const base_model = openai("gpt-4o-mini");

  // **** Uncomment below for a custom endpoint LLM & Change Model in createCorrectnessEvaluator() **** //

  // const fireworks = createOpenAI({
  //   baseURL: "https://api.fireworks.ai/inference/v1",
  //   apiKey: process.env.FIREWORKS_API_KEY,
  // });
  // const custom_llm = fireworks.chat(
  //   "accounts/fireworks/models/qwen3-235b-a22b-instruct-2507",
  // );

  const evaluator = createCorrectnessEvaluator({
    model: base_model,
  });

  const projectName =
    process.env.PHOENIX_PROJECT_NAME || "langchain-travel-agent";

  const { spans } = await getSpans({ project: { projectName }, limit: 500 });

  const parentSpans: { spanId: string; input: string; output: string }[] = [];
  for (const s of spans) {
    const span = s as SpanLike;
    const name = span.name ?? span.span_name;
    if (name !== "LangGraph") continue;
    const { input, output } = getInputOutput(span);
    const spanId = span.context?.span_id ?? span.span_id ?? span.id;
    if (input && output && spanId) {
      parentSpans.push({ spanId: String(spanId), input, output });
    }
  }

  const spanAnnotations = await Promise.all(
    parentSpans.map(async ({ spanId, input, output }) => {
      const r = await evaluator.evaluate({ input, output });
      return {
        spanId,
        name: "correctness" as const,
        label: r.label,
        score: r.score,
        explanation: r.explanation ?? undefined,
        annotatorKind: "LLM" as const,
        metadata: { evaluator: "correctness", input, output },
      };
    })
  );

  await logSpanAnnotations({ spanAnnotations, sync: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
