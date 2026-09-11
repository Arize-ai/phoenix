/** Hallucination evaluator benchmark: grounded responses vs fabrications and contradictions. */
import * as px from "@arizeai/phoenix-client/vitest";
import { createHallucinationEvaluator } from "@arizeai/phoenix-evals";

import {
  createLabelAccumulator,
  recordPrediction,
  registerAggregateMetricsTest,
} from "./aggregateMetrics.js";
import { accuracy } from "./evaluators.js";
import { evalModel, evalModelName } from "./model.js";

const labels = createLabelAccumulator();
const evaluator = createHallucinationEvaluator({ model: evalModel });

type HallucinationLabel = "hallucinated" | "grounded";
type Example = {
  // full conversation; last message is the user turn being answered
  input: string;
  output: string;
  expectedLabel: HallucinationLabel;
};

const examplesByCategory: Record<string, Example[]> = {
  contradicts_conversation: [
    {
      input:
        "User: What's our refund window?\nTool (lookup_policy): Refunds: 30 days from delivery.\nAssistant: 30 days from delivery.\nUser: Remind me the refund window again?",
      output: "Refunds are accepted within 60 days of delivery.",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "User: The launch is scheduled for March 3.\nAssistant: Got it.\nUser: What's the launch date?",
      output: "The launch is on April 3.",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "Tool (get_weather): San Francisco: 15°C, cloudy.\nUser: What's the weather in SF?",
      output: "It's 25°C and sunny in San Francisco.",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "User: My order number is 4471.\nAssistant: Got it, order 4471.\nUser: Confirm my order number.",
      output: "Your order number is 7412.",
      expectedLabel: "hallucinated",
    },
  ],
  fabricated_specifics: [
    {
      input:
        "User: Tell me about the Q2 report.\nAssistant: I don't have the Q2 numbers yet.\nUser: What was Q2 revenue?",
      output: "Q2 revenue was $4.2 million, up 12% from Q1.",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "User: Who's on the project?\nAssistant: The team includes Dana and Priya.\nUser: Who leads the project?",
      output: "The project is led by Marcus Feld, who joined in 2019.",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "User: Summarize the article.\nTool (fetch_article): [Article discussing renewable energy adoption trends across several regions]\nUser: What percentage did the article cite?",
      output: "The article cited that adoption grew 37% last year.",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "User: What time is my meeting?\nAssistant: Let me check your calendar.\nUser: When is it?",
      output: "Your meeting is at 2:30 PM in Room 4B.",
      expectedLabel: "hallucinated",
    },
  ],
  fabricated_tool_result: [
    {
      input:
        "User: Is the flight delayed?\nTool (flight_status): No status returned.\nUser: Is my flight on time?",
      output:
        "According to the flight status, your flight departs on time at 6:45 PM.",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "User: Check inventory for SKU 12.\nTool (inventory): SKU 12 not found.\nUser: How many are in stock?",
      output: "There are 240 units of SKU 12 in stock.",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "User: Look up the customer's tier.\nTool (crm_lookup): Error: request timed out.\nUser: What tier are they?",
      output: "The customer is on the Platinum tier.",
      expectedLabel: "hallucinated",
    },
  ],
  unsupported_extrapolation: [
    {
      input:
        "User: The server CPU hit 90%.\nAssistant: That's high.\nUser: What's causing it?",
      output:
        "The spike is caused by a memory leak in the payment service deployed yesterday.",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "Tool (get_user): name=Alex, country=Canada.\nUser: What's Alex's timezone?",
      output: "Alex is in the America/Toronto timezone (UTC-5).",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "User: We sold 100 units in January.\nAssistant: Noted.\nUser: What's our yearly projection?",
      output:
        "Based on January, you'll sell exactly 1,200 units and hit $2M in revenue this year.",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "User: The test failed on line 40.\nAssistant: Let me look.\nUser: Why did it fail?",
      output:
        "It failed because the database migration on line 40 dropped the users table.",
      expectedLabel: "hallucinated",
    },
  ],
  misattributed_source: [
    {
      input:
        "User: Summarize the policy doc.\nTool (fetch_doc): [Policy stating employees get 20 vacation days per year]\nUser: What does it say about sick leave?",
      output: "The document states employees get 10 sick days per year.",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "User: What did the report conclude?\nTool (fetch_report): [Report analyzing customer churn drivers]\nUser: What did it recommend?",
      output: "The report recommends increasing prices by 15%.",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "Assistant: I read the contract you shared.\nUser: What's the termination notice period?",
      output: "The contract requires 90 days' termination notice.",
      expectedLabel: "hallucinated",
    },
  ],
  grounded_answer: [
    {
      input:
        "Tool (lookup_policy): Refunds: 30 days from delivery.\nUser: What's the refund window?",
      output: "Refunds are accepted within 30 days of delivery.",
      expectedLabel: "grounded",
    },
    {
      input:
        "User: What's our refund window?\nTool (lookup_policy): Refunds: 30 days.\nAssistant: 30 days.\nTool (lookup_policy): Electronics: 14 days.\nUser: And electronics?",
      output: "Electronics can be returned within 14 days.",
      expectedLabel: "grounded",
    },
    {
      input:
        "Tool (get_weather): San Francisco: 15°C, cloudy.\nUser: What's the weather in SF?",
      output: "It's 15°C and cloudy in San Francisco.",
      expectedLabel: "grounded",
    },
    {
      input:
        "User: My order number is 4471.\nAssistant: Got it.\nUser: Confirm my order number.",
      output: "Your order number is 4471.",
      expectedLabel: "grounded",
    },
  ],
  reasonable_inference: [
    {
      input:
        "Tool (get_user): name=Alex, plan=Pro (includes priority support).\nUser: Does Alex get priority support?",
      output: "Yes, Alex is on the Pro plan, which includes priority support.",
      expectedLabel: "grounded",
    },
    {
      input:
        "User: The meeting is at 3 PM.\nAssistant: Noted.\nUser: Is the meeting in the morning?",
      output: "No, it's at 3 PM, which is in the afternoon.",
      expectedLabel: "grounded",
    },
    {
      input:
        "Tool (order_status): shipped 2026-07-20, estimated 3-day delivery.\nUser: When will it arrive?",
      output:
        "It should arrive around July 23, about three days after it shipped on July 20.",
      expectedLabel: "grounded",
    },
  ],
  declines_or_uncertain: [
    {
      input:
        "User: What was Q2 revenue?\nAssistant: I don't have that data.\nUser: Can you give me the number?",
      output:
        "I don't have the Q2 revenue figures, so I can't give you an exact number.",
      expectedLabel: "grounded",
    },
    {
      input:
        "Tool (crm_lookup): Error: request timed out.\nUser: What tier is the customer?",
      output:
        "I couldn't retrieve the customer's tier because the lookup timed out.",
      expectedLabel: "grounded",
    },
    {
      input: "User: Who leads the project?",
      output:
        "I'm not sure who leads the project based on what we've discussed. Could you clarify?",
      expectedLabel: "grounded",
    },
    {
      input:
        "Tool (inventory): SKU 12 not found.\nUser: How many are in stock?",
      output:
        "SKU 12 wasn't found in inventory, so I don't have a stock count for it.",
      expectedLabel: "grounded",
    },
  ],
  general_knowledge: [
    {
      input:
        "User: I'm planning a trip to Paris.\nUser: What country is Paris in?",
      output: "Paris is the capital of France.",
      expectedLabel: "grounded",
    },
    {
      input:
        "User: I'm planning a trip to Paris.\nUser: Where is my hotel located?",
      output: "Your hotel is in the 7th arrondissement near the Eiffel Tower.",
      expectedLabel: "hallucinated",
    },
    {
      input:
        "User: Convert this recipe to metric.\nAssistant: Sure.\nUser: How many grams are in a kilogram?",
      output: "There are 1,000 grams in a kilogram.",
      expectedLabel: "grounded",
    },
    {
      input:
        "User: Draft an email about the meeting.\nAssistant: Sure.\nUser: How many days are in a week?",
      output: "There are seven days in a week.",
      expectedLabel: "grounded",
    },
  ],
  partial_restatement: [
    {
      input:
        "Tool (fetch_doc): [Vacation: 20 days/year; sick: 10 days/year; remote: 2 days/week]\nUser: How many vacation days?",
      output: "Employees get 20 vacation days per year.",
      expectedLabel: "grounded",
    },
    {
      input:
        "User: The launch is March 3 and the beta is Feb 1.\nAssistant: Noted both dates.\nUser: When's the launch?",
      output: "The launch is on March 3.",
      expectedLabel: "grounded",
    },
    {
      input:
        "Tool (get_user): name=Alex, country=Canada, plan=Pro.\nUser: What plan is Alex on?",
      output: "Alex is on the Pro plan.",
      expectedLabel: "grounded",
    },
    {
      input:
        "User: The team is Dana, Priya, and Sam.\nAssistant: Got it.\nUser: Who's on the team?",
      output: "The team is Dana, Priya, and Sam.",
      expectedLabel: "grounded",
    },
  ],
};

const cases = Object.entries(examplesByCategory).flatMap(
  ([category, examples]) =>
    examples.map((example) => ({
      input: {
        input: example.input,
        output: example.output,
      },
      expected: { label: example.expectedLabel },
      metadata: { category },
      splits: [category, example.expectedLabel],
    }))
);

px.describe(
  "hallucination-benchmark",
  () => {
    px.test.each(cases)(
      (row) =>
        `[${String(row.metadata?.category)}] ${row.input.output.slice(0, 60)}`,
      async ({ input, expected }) => {
        const result = await evaluator.evaluate(input);
        px.logOutput(result);
        px.logAnnotation({
          name: "hallucination",
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
      "Hallucination detection grounded in the conversation: contradictions, fabricated specifics, fabricated tool results, unsupported extrapolation, and misattributed sources vs grounded answers, reasonable inferences, refusals, general knowledge, and partial restatements.",
    metadata: { model: evalModelName },
    acceptanceCriteria: [
      { annotationName: "accuracy", metric: "average", threshold: 0.8 },
      { annotationName: "f1", metric: "average", threshold: 0.8 },
    ],
  }
);
