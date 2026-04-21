/**
 * Session summarization eval
 *
 * Exercises the session-summary path used by
 * `app/src/components/agent/useGenerateSessionSummary.ts`. The hook forces a
 * structured tool call (`summary`) to produce a 5-10 word topic label for the
 * first user/assistant exchange in a session.
 *
 * This script reproduces that contract directly against the model (no chat
 * server in the loop) so we can measure prompt+tool quality in isolation:
 *
 *   1. Iterate a golden dataset of (userMessage, assistantMessage) pairs.
 *   2. Call the model with the production system prompt + `summary` tool,
 *      with `toolChoice: "required"` to force structured output.
 *   3. Grade each generated summary with two evaluators:
 *        - summary-format  (CODE) — 5-10 words, no quotes, no trailing punct
 *        - summary-quality (LLM)  — does the summary capture the topic
 *
 * Keep the prompt + tool schema in sync with
 * `app/src/components/agent/useGenerateSessionSummary.ts`.
 */
import { anthropic } from "@ai-sdk/anthropic";
import { createClient } from "@arizeai/phoenix-client";
import { createOrGetDataset } from "@arizeai/phoenix-client/datasets";
import { runExperiment } from "@arizeai/phoenix-client/experiments";
import { generateText, tool } from "ai";
import { z } from "zod";

import { summaryFormatEvaluator } from "./evaluators/summaryFormatEvaluator";
import { summaryQualityEvaluator } from "./evaluators/summaryQualityEvaluator";

const DATASET_NAME = "phoenix-session-summarization";

// Mirror of SUMMARY_SYSTEM_PROMPT in
// app/src/components/agent/useGenerateSessionSummary.ts. Keep in sync.
const SUMMARY_SYSTEM_PROMPT =
  "You are a concise summarizer. You MUST call the `summary` tool with a 5-10 word summary of the conversation topic. No quotes, no punctuation at the end.";

const summaryTool = tool({
  description: "Provide the conversation summary",
  inputSchema: z.object({
    summary: z
      .string()
      .describe("A 5-10 word summary of the conversation topic"),
  }),
});

type SummarizationExample = {
  userMessage: string;
  assistantMessage: string;
};

const EXAMPLES: SummarizationExample[] = [
  {
    userMessage: "How do I install Phoenix locally with Docker?",
    assistantMessage:
      "You can run Phoenix locally with `docker run -p 6006:6006 arizephoenix/phoenix:latest`. The UI will be available at http://localhost:6006.",
  },
  {
    userMessage:
      "I'm seeing a 401 from the OpenAI tracer when sending spans to Phoenix Cloud — what header do I need?",
    assistantMessage:
      "Phoenix Cloud requires an API key passed as the `api_key` header on the OTLP exporter. Set `PHOENIX_API_KEY` and re-initialize the tracer provider so the exporter picks it up.",
  },
  {
    userMessage:
      "What's the difference between a dataset and an experiment in Phoenix?",
    assistantMessage:
      "A dataset is a versioned collection of examples (input/output/metadata). An experiment is a run of a task over a dataset, optionally graded by evaluators. You can run many experiments against the same dataset to compare prompt or model changes.",
  },
  {
    userMessage:
      "Can you walk me through wiring up the LangChain instrumentor for tracing?",
    assistantMessage:
      "Install `openinference-instrumentation-langchain`, then call `LangChainInstrumentor().instrument()` after configuring your OTLP exporter. All chains and LLM calls will be captured as spans automatically.",
  },
  {
    userMessage:
      "How do I create an annotation config for thumbs-up / thumbs-down feedback?",
    assistantMessage:
      "Create a categorical annotation config with two values (`thumbs_up`, `thumbs_down`) via the Settings UI or the REST API at `POST /v1/annotation_configs`. You can then attach these annotations to spans, traces, or session entries.",
  },
  {
    userMessage:
      "My experiment evaluators are returning null scores — how do I debug them?",
    assistantMessage:
      "Check the experiment run logs for evaluator exceptions. Most often the evaluator function is throwing because the example output shape doesn't match what it expects. Add a try/catch and log the input it received.",
  },
  {
    userMessage:
      "What's the cheapest way to run Phoenix in production for a small team?",
    assistantMessage:
      "Self-host the Docker image behind a small Postgres instance — a single 1 vCPU / 2 GB node handles light trace volume comfortably. For zero-ops, Phoenix Cloud's free tier covers most small teams.",
  },
  {
    userMessage:
      "How do I export traces from Phoenix as a pandas DataFrame for offline analysis?",
    assistantMessage:
      "Use the Python client: `px.Client().get_spans_dataframe(project_name='my-project')`. You can pass filters and time ranges to scope the export.",
  },
  {
    userMessage: "Does Phoenix support OAuth / SSO for enterprise auth?",
    assistantMessage:
      "Yes — Phoenix supports OIDC providers (Google, Okta, Microsoft Entra) out of the box. Configure your provider's client ID and secret as environment variables and Phoenix will redirect users through the OAuth flow.",
  },
  {
    userMessage:
      "How do I version a prompt template and roll back to a previous version?",
    assistantMessage:
      "Phoenix prompts are versioned automatically on every save. The Prompts UI lists all versions with a diff view; click `Set as latest` on any prior version to roll back. The REST API exposes the same operation under `/v1/prompts/{id}/versions/{version_id}/promote`.",
  },
];

const client = createClient();

async function main() {
  await createOrGetDataset({
    client,
    name: DATASET_NAME,
    description:
      "Golden conversations used to evaluate session summary quality (see useGenerateSessionSummary.ts).",
    examples: EXAMPLES.map((input) => ({ input })),
  });

  await runExperiment({
    client,
    experimentName: "session-summary-quality",
    experimentDescription:
      "Forces the production summary tool against the model and grades the resulting 5-10 word session summary on format and topical accuracy.",
    dataset: { datasetName: DATASET_NAME },
    task: async (example) => {
      const { userMessage, assistantMessage } =
        example.input as SummarizationExample;

      const summarizePrompt = [
        "Summarize this conversation in 5-10 words:",
        `User: ${userMessage}`,
        `Assistant: ${assistantMessage}`,
      ].join("\n");

      const { toolCalls } = await generateText({
        model: anthropic("claude-haiku-4-5-20251001"),
        system: SUMMARY_SYSTEM_PROMPT,
        prompt: summarizePrompt,
        tools: { summary: summaryTool },
        toolChoice: "required",
      });

      const summaryCall = toolCalls.find((c) => c.toolName === "summary");
      if (!summaryCall) return "";
      const input = summaryCall.input as { summary?: string };
      return input.summary?.trim() ?? "";
    },
    evaluators: [summaryFormatEvaluator, summaryQualityEvaluator],
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
