/** Q&A correctness benchmark: answers judged correct/incorrect against a reference. */
import * as px from "@arizeai/phoenix-client/vitest";
import { createQACorrectnessEvaluator } from "@arizeai/phoenix-evals";

import {
  createLabelAccumulator,
  recordPrediction,
  registerAggregateMetricsTest,
} from "./aggregateMetrics.js";
import { accuracy } from "./evaluators.js";
import { evalModel, evalModelName } from "./model.js";

const labels = createLabelAccumulator();
const evaluator = createQACorrectnessEvaluator({ model: evalModel });

type QACorrectnessLabel = "correct" | "incorrect";
type Example = {
  input: string;
  output: string;
  reference: string;
  expectedLabel: QACorrectnessLabel;
};

const examplesByCategory: Record<string, Example[]> = {
  fully_correct: [
    {
      input: "What is the capital of France?",
      output: "Paris.",
      reference: "France's capital is Paris.",
      expectedLabel: "correct",
    },
    {
      input: "How many days are in the return window?",
      output: "30 days.",
      reference: "Returns are accepted within 30 days of delivery.",
      expectedLabel: "correct",
    },
    {
      input: "Who wrote the report?",
      output: "The report was written by Dana Lee.",
      reference: "Author: Dana Lee.",
      expectedLabel: "correct",
    },
    {
      input: "What port does the service run on?",
      output: "It runs on port 8080.",
      reference: "The service listens on port 8080.",
      expectedLabel: "correct",
    },
  ],
  correct_paraphrase: [
    {
      input: "Is the library open source?",
      output: "Yes, it's freely available under an open-source license.",
      reference: "The library is released under the MIT license.",
      expectedLabel: "correct",
    },
    {
      input: "What's the meeting about?",
      output: "It's to plan the Q3 roadmap.",
      reference: "Agenda: planning for the third-quarter roadmap.",
      expectedLabel: "correct",
    },
    {
      input: "How should users authenticate?",
      output: "By providing an API key in the request header.",
      reference:
        "Authentication requires an API key passed via the Authorization header.",
      expectedLabel: "correct",
    },
  ],
  correct_states_unavailable: [
    {
      input: "What was the company's 2019 revenue?",
      output: "The reference doesn't provide the 2019 revenue.",
      reference: "The document covers 2021 and 2022 financials.",
      expectedLabel: "correct",
    },
    {
      input: "Who is the CEO?",
      output: "The provided text doesn't mention who the CEO is.",
      reference: "The article describes the company's product line.",
      expectedLabel: "correct",
    },
    {
      input: "What is the warranty period for electronics?",
      output:
        "The reference only covers the return policy, not warranty periods.",
      reference: "Returns: 30 days. No warranty information is provided.",
      expectedLabel: "correct",
    },
  ],
  correct_extra_harmless_info: [
    {
      input: "What's the refund window?",
      output: "30 days from delivery. Just contact support to start a refund.",
      reference: "Refunds are accepted within 30 days of delivery.",
      expectedLabel: "correct",
    },
    {
      input: "What language is the SDK written in?",
      output: "Python. It also ships with type hints.",
      reference: "The SDK is written in Python.",
      expectedLabel: "correct",
    },
    {
      input: "When does the sale end?",
      output: "The sale ends on July 31, so shop soon!",
      reference: "Sale ends July 31.",
      expectedLabel: "correct",
    },
  ],
  correct_multi_fact: [
    {
      input: "What are the store's opening and closing times?",
      output: "It opens at 9 AM and closes at 6 PM.",
      reference: "Hours: 9:00 to 18:00.",
      expectedLabel: "correct",
    },
    {
      input: "What are the two supported databases?",
      output: "PostgreSQL and SQLite.",
      reference: "Supported databases: PostgreSQL, SQLite.",
      expectedLabel: "correct",
    },
    {
      input: "Who are the two authors?",
      output: "Dana Lee and Priya Rao.",
      reference: "Authors: Dana Lee, Priya Rao.",
      expectedLabel: "correct",
    },
  ],
  factual_error: [
    {
      input: "What's the refund window?",
      output: "60 days.",
      reference: "Refunds are accepted within 30 days of delivery.",
      expectedLabel: "incorrect",
    },
    {
      input: "What port does the service use?",
      output: "Port 3000.",
      reference: "The service listens on port 8080.",
      expectedLabel: "incorrect",
    },
    {
      input: "What is the capital of Australia?",
      output: "Sydney.",
      reference: "Australia's capital is Canberra.",
      expectedLabel: "incorrect",
    },
    {
      input: "When does the sale end?",
      output: "August 15.",
      reference: "Sale ends July 31.",
      expectedLabel: "incorrect",
    },
  ],
  partial_answer: [
    {
      input: "What are the store's opening and closing times?",
      output: "It opens at 9 AM.",
      reference: "Hours: 9:00 to 18:00.",
      expectedLabel: "incorrect",
    },
    {
      input: "What are the two supported databases?",
      output: "PostgreSQL.",
      reference: "Supported databases: PostgreSQL, SQLite.",
      expectedLabel: "incorrect",
    },
    {
      input: "List the required fields.",
      output: "Name.",
      reference: "Required fields: name, email, and phone.",
      expectedLabel: "incorrect",
    },
    {
      input: "What are the refund and exchange windows?",
      output: "Refunds are 30 days.",
      reference: "Refunds: 30 days. Exchanges: 14 days.",
      expectedLabel: "incorrect",
    },
  ],
  answers_different_question: [
    {
      input: "What is the capital of France?",
      output: "France is in Western Europe.",
      reference: "France's capital is Paris; it is in Western Europe.",
      expectedLabel: "incorrect",
    },
    {
      input: "How do I reset my password?",
      output: "You can change your email in settings.",
      reference:
        "To reset a password, click 'Forgot password' on the login page.",
      expectedLabel: "incorrect",
    },
    {
      input: "When was the company founded?",
      output: "The company has 500 employees.",
      reference: "Founded in 2010; currently 500 employees.",
      expectedLabel: "incorrect",
    },
  ],
  fabricated_from_missing_reference: [
    {
      input: "What was the company's 2019 revenue?",
      output: "2019 revenue was $4.2 million.",
      reference: "The document covers 2021 and 2022 financials.",
      expectedLabel: "incorrect",
    },
    {
      input: "Who is the CEO?",
      output: "The CEO is Marcus Feld.",
      reference: "The article describes the company's product line.",
      expectedLabel: "incorrect",
    },
    {
      input: "What time does the webinar start?",
      output: "It starts at 2 PM EST.",
      reference: "The webinar will be held next Thursday.",
      expectedLabel: "incorrect",
    },
  ],
  unsupported_claim: [
    {
      input: "Is the API rate-limited?",
      output: "Yes, it's limited to 100 requests per minute.",
      reference: "The API requires authentication via an API key.",
      expectedLabel: "incorrect",
    },
    {
      input: "What does the Pro plan include?",
      output: "Email support and a dedicated account manager.",
      reference: "The Pro plan includes email support.",
      expectedLabel: "incorrect",
    },
    {
      input: "How long is onboarding?",
      output:
        "Onboarding takes about two weeks and includes a certification exam.",
      reference: "Onboarding covers account setup and a product walkthrough.",
      expectedLabel: "incorrect",
    },
  ],
};

const cases = Object.entries(examplesByCategory).flatMap(
  ([category, examples]) =>
    examples.map((example) => ({
      input: {
        input: example.input,
        output: example.output,
        reference: example.reference,
      },
      expected: { label: example.expectedLabel },
      metadata: { category },
      splits: [category, example.expectedLabel],
    }))
);

px.describe(
  "qa-correctness-benchmark",
  () => {
    px.test.each(cases)(
      (row) =>
        `[${String(row.metadata?.category)}] ${row.input.input.slice(0, 60)}`,
      async ({ input, expected }) => {
        const result = await evaluator.evaluate(input);
        px.logOutput(result);
        px.logAnnotation({
          name: "qa_correctness",
          label: result.label,
          explanation: result.explanation,
          annotatorKind: "LLM",
        });
        recordPrediction({
          labels,
          truth: expected?.label,
          predicted: result.label,
        });
        await px.evaluate(accuracy);
      }
    );
    registerAggregateMetricsTest(labels);
  },
  {
    description:
      "Q&A correctness judged against a reference: fully correct, paraphrases, correctly stating info is unavailable, and extra harmless info vs factual errors, partial answers, answering a different question, fabricating from a missing reference, and unsupported claims.",
    metadata: { model: evalModelName },
    acceptanceCriteria: [
      { annotationName: "accuracy", metric: "average", threshold: 0.8 },
      { annotationName: "f1", metric: "average", threshold: 0.8 },
    ],
  }
);
