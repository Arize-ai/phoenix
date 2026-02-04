import "dotenv/config";
import { createCorrectnessEvaluator } from "@arizeai/phoenix-evals";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";

const toStr = (v: unknown) =>
  typeof v === "string" ? v : v != null ? JSON.stringify(v) : null;

function getInputOutput(span: any) {
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
    model: base_model as any,
  });

  const projectName =
    process.env.PHOENIX_PROJECT_NAME || "langchain-travel-agent";

  const { spans } = await getSpans({ project: { projectName }, limit: 500 });

  const parentSpans: { spanId: string; input: string; output: string }[] = [];
  for (const s of spans) {
    const name = (s as any).name ?? (s as any).span_name;
    if (name !== "LangGraph") continue;
    const { input, output } = getInputOutput(s);
    const spanId =
      (s as any).context?.span_id ?? (s as any).span_id ?? (s as any).id;
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
    }),
  );

  await logSpanAnnotations({ spanAnnotations, sync: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
