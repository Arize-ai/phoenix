/**
 * Eval suite for an Acme Analytics customer-support FAQ bot (Vitest).
 *
 * The bot receives a user question alongside a short excerpt from the
 * knowledge base and returns a concise, grounded answer.  When the excerpt
 * is empty (or the question is off-topic) it should decline politely.
 *
 * We track two metrics per run:
 *   latency_ms   — wall-clock response time (CODE annotation)
 *   helpfulness  — LLM-as-judge score: 1 = helpful/grounded, 0 = not
 *
 * The judge runs on a stronger model than the bot (Sonnet judging Haiku) so its
 * verdicts are stable — a noisy judge makes the whole suite flaky.
 *
 * Suite-level acceptance criteria gate CI:
 *   • ≥ 70 % of answers judged helpful across the suite
 *   • mean latency ≤ 5 000 ms across the suite
 *
 * See examples/pytest-example/README.md (in the repo root) for the full
 * walkthrough and run instructions.
 *
 * Run offline (nothing recorded):
 *   PHOENIX_TEST_TRACKING=false pnpm exec vitest run
 *
 * Run against Phoenix:
 *   PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix-host \
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *   pnpm exec vitest run
 */

import Anthropic from "@anthropic-ai/sdk";
import * as px from "@arizeai/phoenix-client/vitest";
import type {
  Evaluator,
  EvaluationParams,
} from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

const anthropic = new Anthropic();

// ---------------------------------------------------------------------------
// Knowledge base (simplified FAQ excerpts)
// ---------------------------------------------------------------------------

const KB: Record<string, string> = {
  billing:
    "Invoices are generated on the 1st of each month and emailed to the " +
    "account owner. You can download past invoices from Settings → Billing. " +
    "We accept Visa, Mastercard, and ACH transfers. Refunds are available " +
    "within 14 days of a charge.",
  password_reset:
    "To reset your password, click 'Forgot password' on the login page. " +
    "An email with a reset link will arrive within 2 minutes. Links expire " +
    "after 24 hours. If you use SSO, contact your identity provider instead.",
  data_export:
    "You can export any chart or table as CSV, PNG, or PDF. Click the " +
    "⋯ menu on any widget and choose Export. Exports respect your current " +
    "date-range and filter selections. Large exports (>100 k rows) are " +
    "queued and emailed when ready.",
  offtopic: "", // no KB context — bot should decline
};

// ---------------------------------------------------------------------------
// System under test
// ---------------------------------------------------------------------------

const BOT_SYSTEM = `\
You are a concise support agent for Acme Analytics. Answer the user's question
using ONLY the provided knowledge-base excerpt. If the excerpt is empty or does
not contain the answer, reply with exactly:
  "I don't have information on that — please contact support@acme.io."
Keep answers under three sentences.`;

async function answerQuestion(
  question: string,
  kbContext: string
): Promise<string> {
  const userMessage = kbContext
    ? `Knowledge base:\n${kbContext}\n\nQuestion: ${question}`
    : `Question: ${question}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: BOT_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected content block type");
  return block.text;
}

// ---------------------------------------------------------------------------
// LLM-as-judge evaluator
// ---------------------------------------------------------------------------

// The judge sees the same knowledge-base excerpt the bot did, so it can tell
// whether an answer was grounded — and whether declining was the right call
// when the excerpt doesn't contain the answer.
const JUDGE_SYSTEM = `\
You are a strict quality reviewer for a B2B software support bot. You are given
the knowledge-base excerpt the bot was working from, the user question, and the
bot's response.
Reply with exactly "1" if the response is accurate and grounded in the excerpt
(or correctly declines when the excerpt does not contain the answer), or "0" if
it is wrong, unsupported, vague, or ignores the question. No other output.`;

type BotInput = { question: string; kbKey: string; expectRefusal: boolean };
type BotOutput = { response: string };
type HelpfulnessResult = { score: number; label: string };

// The evaluator receives `input` and `output` auto-supplied from the run
// (set by px.logOutput) when called without explicit params.
const helpfulness: Evaluator<EvaluationParams, HelpfulnessResult> = {
  name: "helpfulness",
  kind: "LLM",
  evaluate: async ({ input, output }) => {
    const { question, kbKey } = input as BotInput;
    const kbContext = KB[kbKey] ?? "";
    const response = (output as BotOutput | undefined)?.response ?? "";

    const verdict = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4,
      system: JUDGE_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Knowledge base:\n${kbContext || "(empty)"}\n\n` +
            `Question: ${question}\n\nBot response: ${response}`,
        },
      ],
    });

    const block = verdict.content[0];
    const score = block.type === "text" && block.text.trim() === "1" ? 1 : 0;
    return { score, label: score === 1 ? "helpful" : "unhelpful" };
  },
};

// ---------------------------------------------------------------------------
// Eval suite
// ---------------------------------------------------------------------------

px.describe(
  "acme support bot",
  () => {
    px.test.each([
      {
        id: "invoices",
        input: {
          question: "How do I download my invoices?",
          kbKey: "billing",
          expectRefusal: false,
        },
      },
      {
        id: "payment-methods",
        input: {
          question: "What payment methods do you accept?",
          kbKey: "billing",
          expectRefusal: false,
        },
      },
      {
        id: "reset-email",
        input: {
          question: "My reset email never arrived — what should I do?",
          kbKey: "password_reset",
          expectRefusal: false,
        },
      },
      {
        id: "png-export",
        input: {
          question: "Can I export a chart as a PNG?",
          kbKey: "data_export",
          expectRefusal: false,
        },
      },
      {
        id: "offtopic",
        input: {
          question: "What's the capital of France?",
          kbKey: "offtopic",
          expectRefusal: true,
        },
      },
    ])(
      (row) => row.id ?? "case",
      async ({ input }) => {
        const kbContext = KB[input.kbKey] ?? "";

        const start = performance.now();
        const response = await answerQuestion(input.question, kbContext);
        const latencyMs = performance.now() - start;

        px.logOutput({ response });

        // Structural metric — always deterministic.
        px.logAnnotation({
          name: "latency_ms",
          score: latencyMs,
          annotatorKind: "CODE",
        });

        // LLM judge — recorded under its own evaluator span in Phoenix.
        // We don't hard-assert on every run; aggregate quality is gated by
        // the suite's acceptanceCriteria below.
        await px.evaluate(helpfulness);

        // Hard assertion only for the structural refusal check.
        if (input.expectRefusal) {
          expect(response).toContain("I don't have information on that");
        }
      }
    );
  },
  {
    acceptanceCriteria: [
      // At least 70 % of runs must score 1 on helpfulness. The bot reliably
      // clears this; the `reset-email` case is the recurring miss (it adds
      // advice that isn't in the knowledge base), which leaves headroom for a
      // single regression to fail CI rather than passing silently.
      {
        annotationName: "helpfulness",
        metric: "passRate",
        passFn: (a) => a.score === 1,
        minPassRate: 0.7,
      },
      // Mean response time must stay under 5 seconds.
      {
        annotationName: "latency_ms",
        metric: "average",
        threshold: 5000,
        direction: "minimize",
      },
    ],
  }
);
