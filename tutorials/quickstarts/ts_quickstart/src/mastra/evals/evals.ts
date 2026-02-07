import "dotenv/config";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";

const EVAL_NAME = "completeness";
const AGENT_SPAN_NAME = "invoke_agent Financial Analysis Orchestrator";
const PROJECT_NAME =
  process.env.PHOENIX_PROJECT_NAME ?? "mastra-tracing-quickstart";

const financialCompletenessTemplate = `
You are evaluating whether a financial research report correctly completes ALL parts of the user's task.

User input: {{input}}

Generated report:
{{output}}

To be marked as "correct", the report should:
1. Cover ALL companies/tickers mentioned in the input (if multiple are listed, all must be addressed)
2. Address ALL focus areas mentioned in the input (e.g., if user asks for "earnings and outlook", both must be covered)
3. Provide relevant financial information for each company/ticker requested

The report is "incorrect" if:
- It misses any company/ticker mentioned in the input
- It fails to address any focus area mentioned in the input
- It only partially covers the requested companies or topics

Examples:
- Input: "tickers: AAPL, MSFT, focus: earnings and outlook" → Report must cover BOTH AAPL AND MSFT, AND address BOTH earnings AND outlook
- Input: "tickers: TSLA, focus: valuation metrics" → Report must cover TSLA AND address valuation metrics
- Input: "tickers: NVDA, AMD, focus: comparative analysis" → Report must cover BOTH NVDA AND AMD AND provide comparison

Respond with ONLY one word: "complete" or "incomplete"
Then provide a brief explanation of which parts were completed or missed.
`;

async function main() {
  const evaluator = createClassificationEvaluator({
    model: openai("gpt-4o-mini") as Parameters<
      typeof createClassificationEvaluator
    >[0]["model"],
    promptTemplate: financialCompletenessTemplate,
    choices: { complete: 1, incomplete: 0 },
    name: EVAL_NAME,
  });

  const { spans } = await getSpans({
    project: { projectName: PROJECT_NAME },
    limit: 500,
  });

  const toEvaluate: { spanId: string; input: string; output: string }[] = [];
  for (const s of spans) {
    const span = s as {
      name?: string;
      span_name?: string;
      attributes?: Record<string, unknown>;
      context?: { span_id?: string };
      span_id?: string;
      id?: string;
    };
    if ((span.name ?? span.span_name) !== AGENT_SPAN_NAME) continue;
    const attrs = span.attributes ?? {};
    const rawInput = attrs["input.value"] ?? attrs["input"];
    const rawOutput = attrs["output.value"] ?? attrs["output"];
    const input =
      typeof rawInput === "string"
        ? rawInput
        : rawInput != null
          ? JSON.stringify(rawInput)
          : null;
    const output =
      typeof rawOutput === "string"
        ? rawOutput
        : rawOutput != null
          ? JSON.stringify(rawOutput)
          : null;
    const rawId = span.context?.span_id ?? span.span_id ?? span.id;
    const spanId = rawId != null ? String(rawId) : null;
    if (input && output && spanId) toEvaluate.push({ spanId, input, output });
  }

  console.log(`Found ${toEvaluate.length} orchestrator spans to evaluate`);

  const spanAnnotations = await Promise.all(
    toEvaluate.map(async ({ spanId, input, output }) => {
      const { label, score, explanation } = await evaluator.evaluate({
        input,
        output,
      });
      return {
        spanId,
        name: EVAL_NAME as "completeness",
        label,
        score,
        explanation,
        annotatorKind: "LLM" as const,
        metadata: { evaluator: EVAL_NAME, input, output },
      };
    }),
  );

  await logSpanAnnotations({ spanAnnotations, sync: true });
  console.log(
    `Logged ${spanAnnotations.length} ${EVAL_NAME} evaluations to Phoenix`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
