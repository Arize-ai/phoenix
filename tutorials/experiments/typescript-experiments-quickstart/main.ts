import {
  OpenInferenceSpanKind,
  SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";
import { createOrGetDataset } from "@arizeai/phoenix-client/datasets";
import {
  asExperimentEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";
import type { Example } from "@arizeai/phoenix-client/types/datasets";
import type { EvaluatorParams } from "@arizeai/phoenix-client/types/experiments";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";

import "dotenv/config";
import "./instrumentation.js";

import { openai } from "@ai-sdk/openai";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { generateText } from "ai";

const tracer = trace.getTracer("experiments-tutorial");

const CATEGORIES = ["billing", "technical", "account", "other"] as const;

const POLICIES: Record<string, string> = {
  billing:
    "Billing policy: Refunds are issued for duplicate charges within 7 days.",
  technical:
    "Technical policy: Troubleshoot login issues, outages, and errors.",
  account:
    "Account policy: Users can update email and password in account settings.",
  other: "General support policy: Route to a human agent.",
};

/**
 * Classify a support ticket into billing, technical, account, or other.
 */
async function classifyTicket(ticketText: string) {
  return tracer.startActiveSpan("classify_ticket", async (span) => {
    span.setAttributes({
      [SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.TOOL,
      [SemanticConventions.TOOL_NAME]: "classify_ticket",
      [SemanticConventions.INPUT_VALUE]: ticketText,
    });

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system: `You classify customer support tickets into one of the following categories: billing, technical, account, other. Respond with ONLY the category name.`,
      prompt: ticketText,
      experimental_telemetry: { isEnabled: true },
    });

    const label = result.text.trim().toLowerCase();
    const category = CATEGORIES.includes(label as (typeof CATEGORIES)[number])
      ? label
      : "other";

    span.setAttributes({
      [SemanticConventions.OUTPUT_VALUE]: category,
      [SemanticConventions.OUTPUT_MIME_TYPE]: "text/plain",
    });
    span.setStatus({ code: SpanStatusCode.OK });

    span.end();
    return category;
  });
}

/**
 * Retrieve internal support policy based on category.
 */
function retrievePolicy(category: string): string {
  return tracer.startActiveSpan("retrieve_policy", (span) => {
    span.setAttributes({
      [SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.TOOL,
      [SemanticConventions.TOOL_NAME]: "retrieve_policy",
      [SemanticConventions.TOOL_DESCRIPTION]:
        "Retrieve internal support policy based on ticket category",
      [SemanticConventions.INPUT_VALUE]: category,
    });

    const policy = POLICIES[category] || POLICIES.other;

    span.setAttributes({ [SemanticConventions.OUTPUT_VALUE]: policy });
    span.setStatus({ code: SpanStatusCode.OK });

    span.end();
    return policy;
  });
}

/**
 * The support agent that classifies tickets and retrieves policies.
 */
async function supportAgent(query: string) {
  const category = await classifyTicket(query);
  const policy = retrievePolicy(category);

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    system: `You are a customer support assistant.

Steps:
1. Use the ticket classification to understand the issue category.
2. Use the retrieved policy to inform your response.
3. Write a helpful, polite response grounded in the policy.
Do not invent policies.`,
    prompt: `User query: ${query}
Category: ${category}
Relevant policy: ${policy}

Write a helpful response to the user.`,
    experimental_telemetry: { isEnabled: true },
  });

  return result.text;
}

/**
 * Improved support agent with enhanced instructions for better actionability.
 */
async function improvedSupportAgent(query: string) {
  const category = await classifyTicket(query);
  const policy = retrievePolicy(category);

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    system: `You are a customer support assistant. Your goal is to provide SPECIFIC, ACTIONABLE responses that directly help users resolve their issues.

1. Use the ticket classification to understand the issue category.
2. Use the retrieved policy to inform your response.
3. Write a response that:
   - Directly addresses the user's specific question
   - Includes the policy information you retrieved
   - Provides clear, concrete next steps the user can take
   - Uses specific details from the policy (e.g., "within 7 days" not "soon")
   - Avoids vague phrases like "should be able to" or "might be able to"
   - Gives actionable guidance (ex: "Go to Settings > Account > Email" not "check your settings")

Example of GOOD response:
"Based on your billing issue, here's what you can do: Refunds are issued for duplicate charges within 7 days. To request your refund, please [specific action]. You should see the refund processed within 7 business days."

Example of BAD response:
"I understand your concern about billing. Please contact our support team for assistance with this matter."

Do not invent policies. Always use the policy information provided.`,
    prompt: `User query: ${query}
Category: ${category}
Relevant policy: ${policy}

Write a helpful, actionable response to the user.`,
    experimental_telemetry: { isEnabled: true },
  });

  return result.text;
}

const datasetExamples = [
  {
    query: "I was charged twice for my subscription this month.",
    expected_category: "billing",
  },
  {
    query: "My app crashes every time I try to log in.",
    expected_category: "technical",
  },
  {
    query: "How do I change the email on my account?",
    expected_category: "account",
  },
  {
    query: "I want a refund because I was billed incorrectly.",
    expected_category: "billing",
  },
  { query: "The website shows a 500 error.", expected_category: "technical" },
  {
    query: "I forgot my password and cannot sign in.",
    expected_category: "account",
  },
  {
    query: "I was billed after canceling my subscription.",
    expected_category: "billing",
  },
  { query: "The app freezes on startup.", expected_category: "technical" },
  {
    query: "How can I update my billing address?",
    expected_category: "account",
  },
  {
    query: "Why was my credit card charged twice?",
    expected_category: "billing",
  },
  {
    query: "Push notifications are not working.",
    expected_category: "technical",
  },
  { query: "Can I change my username?", expected_category: "account" },
  {
    query: "I was charged even though my trial should be free.",
    expected_category: "billing",
  },
  {
    query: "The page won't load on mobile.",
    expected_category: "technical",
  },
  { query: "How do I delete my account?", expected_category: "account" },
  {
    query:
      "I canceled last week but still see a pending charge and now the app won't open.",
    expected_category: "billing",
  },
  {
    query: "Nothing works anymore and I don't even know where to start.",
    expected_category: "other",
  },
  {
    query: "I updated my email and now I can't log in - also was billed today.",
    expected_category: "account",
  },
  {
    query: "This service is unusable and I want my money back.",
    expected_category: "billing",
  },
  {
    query:
      "I think something is wrong with my account but support never responds.",
    expected_category: "account",
  },
  {
    query: "My subscription status looks wrong and the app crashes randomly.",
    expected_category: "billing",
  },
  {
    query: "Why am I being charged if I can't access my account?",
    expected_category: "billing",
  },
  {
    query:
      "The app broke after the last update and now billing looks incorrect.",
    expected_category: "technical",
  },
  {
    query: "I'm locked out and still getting charged - please help.",
    expected_category: "billing",
  },
  {
    query: "This feels like both a billing and technical issue.",
    expected_category: "billing",
  },
  {
    query: "Everything worked yesterday, today nothing does.",
    expected_category: "technical",
  },
  {
    query: "I don't recognize this charge and the app won't load.",
    expected_category: "billing",
  },
  {
    query: "Account settings changed on their own and I was billed.",
    expected_category: "account",
  },
  { query: "I want to cancel but can't log in.", expected_category: "account" },
  {
    query: "The system is broken and I'm losing money.",
    expected_category: "billing",
  },
];

async function createSupportTicketDataset() {
  await createOrGetDataset({
    name: "support-ticket-queries",
    description: "Support ticket queries with ground truth categories",
    examples: datasetExamples.map((item) => ({
      input: { query: item.query },
      output: { expected_category: item.expected_category },
    })),
  });
}

/**
 * Task function for evaluating tool call accuracy.
 */
async function classifyTicketTask(example: Example) {
  return classifyTicket(example.input.query as string);
}

/**
 * Code-based evaluator that checks if the classify_ticket tool output
 * matches the expected category from the dataset.
 */
const toolCallAccuracyEvaluator = asExperimentEvaluator({
  name: "tool-call-accuracy",
  kind: "CODE",
  evaluate: ({
    output,
    expected,
  }: EvaluatorParams): { score: number; label: string } => {
    if (!expected) {
      return { score: 0, label: "missing_expected" };
    }

    const expectedCategory = (
      expected as { expected_category: string }
    ).expected_category
      .trim()
      .toLowerCase();
    const actualOutput = String(output).trim().toLowerCase();

    const isCorrect = actualOutput === expectedCategory;
    return {
      score: isCorrect ? 1 : 0,
      label: isCorrect ? "correct" : "incorrect",
    };
  },
});

/**
 * Task function that runs the full support agent.
 */
async function supportAgentTask(example: Example) {
  return supportAgent(example.input.query as string);
}

/**
 * Task function that runs the improved support agent.
 */
async function improvedSupportAgentTask(example: Example) {
  return improvedSupportAgent(example.input.query as string);
}

/**
 * LLM-as-a-Judge evaluator for actionability.
 */
const actionabilityPromptTemplate = `
You are evaluating a customer support agent's response.

Determine whether the response is ACTIONABLE and helps resolve the user's issue.

Mark the response as CORRECT if it:
- Directly addresses the user's specific question
- Provides concrete steps, guidance, or information
- Clearly routes the user toward a solution

Mark the response as INCORRECT if it:
- Is generic, vague, or non-specific
- Avoids answering the question
- Provides no clear next steps
- Deflects with phrases like "contact support" without guidance

User Query:
{{input.query}}

Agent Response:
{{output}}

Return only one label: "correct" or "incorrect".
`;

const actionabilityJudge = createClassificationEvaluator({
  name: "actionability-judge",
  model: openai("gpt-5"),
  promptTemplate: actionabilityPromptTemplate,
  choices: { correct: 1, incorrect: 0 },
});

async function main() {
  await createSupportTicketDataset();
  const datasetSelector = { datasetName: "support-ticket-queries" };

  await runExperiment({
    dataset: datasetSelector,
    experimentName: "tool call accuracy experiment",
    experimentDescription:
      "Evaluating classify_ticket tool accuracy against ground truth labels using a code-based evaluator",
    task: classifyTicketTask,
    evaluators: [toolCallAccuracyEvaluator],
  });

  await runExperiment({
    dataset: datasetSelector,
    experimentName: "support agent",
    experimentDescription:
      "Initial support agent evaluation using actionability judge to measure how actionable and helpful the agent's responses are",
    task: supportAgentTask,
    evaluators: [actionabilityJudge],
  });

  await runExperiment({
    dataset: datasetSelector,
    experimentName: "improved support agent",
    experimentDescription:
      "Agent with enhanced instructions to improve actionability - emphasizes specific, concrete responses with clear next steps",
    task: improvedSupportAgentTask,
    evaluators: [actionabilityJudge],
  });
}

// eslint-disable-next-line no-console
main().catch(console.error);
