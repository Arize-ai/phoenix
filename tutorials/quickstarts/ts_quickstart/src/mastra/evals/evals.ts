// This document is for a correctness eval on tools and goal completion for the agent.

import "dotenv/config";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";
import assert from "assert";

const model = openai("gpt-4");

const financial_completeness_template = `
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

const simple_financial_completeness_template = `
You are evaluating whether a financial research report correctly completes all parts of the user's task.

User input: {{input}}

Generated report:
{{output}}

To be marked as "correct", the report should:
Cover companies/tickers mentioned in the input

The report is "incorrect" if:
- It misses any company/ticker mentioned in the input

Respond with ONLY one word: "complete" or "incomplete"
Then provide a brief explanation of which parts were completed or missed.
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
  const projectName =
    process.env.PHOENIX_PROJECT_NAME || "mastra-tracing-quickstart";
  const allSpans = await getSpans({
    project: { projectName },
    limit: 300,
  });
  const orchestratorSpans: typeof allSpans.spans = [];

  for (const span of allSpans.spans) {
    if (span.name === "agent.Financial Analysis Orchestrator") {
      orchestratorSpans.push(span);
    }
  }
  console.log(orchestratorSpans.length);

  // const evaluator = await createClassificationEvaluator({
  //   name: "completeness",
  //   model,
  //   choices: { complete: 1, incomplete: 0 },
  //   promptTemplate: financial_completeness_template,
  // });

  const evaluator = createClassificationEvaluator<{
    input: string;
    output: string;
  }>({
    name: "completeness",
    model: openai("gpt-4o-mini"),
    promptTemplate: simple_financial_completeness_template,
    choices: { complete: 1, incomplete: 0 },
  });

  const parentSpans: Array<{ input: string; output: string; spanId: string }> =
    [];

  for (const span of orchestratorSpans) {
    const { input, output } = extractInputOutputFromSpan(span);
    const spanId = span.context?.span_id || span.id;

    parentSpans.push({
      input: input || "",
      output: output || "",
      spanId: spanId?.toString() || "",
    });
  }

  const spanAnnotations = await Promise.all(
    parentSpans.map(async (parentSpan) => {
      const evaluationResult = await evaluator.evaluate({
        input: parentSpan.input,
        output: parentSpan.output,
      });
      console.log(evaluationResult.explanation);

      return {
        spanId: parentSpan.spanId,
        name: "completeness" as const,
        label: evaluationResult.label,
        score: evaluationResult.score,
        explanation: evaluationResult.explanation || undefined,
        annotatorKind: "LLM" as const,
        metadata: {
          evaluator: "completeness",
          input: parentSpan.input,
          output: parentSpan.output,
        },
      };
    }),
  );

  await logSpanAnnotations({
    spanAnnotations,
    sync: true,
  });
}

main().catch(() => {
  process.exit(1);
});
