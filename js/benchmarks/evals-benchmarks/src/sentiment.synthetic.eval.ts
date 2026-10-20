/**
 * Balanced synthetic sentiment benchmark.
 *
 * Authored cases that exercise the built-in rubric's hard distinctions, which
 * crowd-labeled corpora blur: a negative *topic* stated without affect is
 * neutral; routine courtesy ("thanks", "hello") is neutral, not positive; and
 * the one-directional friction relationship — friction toward the assistant
 * (correcting a mistake it had the information to avoid) always carries
 * negative sentiment, even when phrased flatly, while a user can be negative
 * about their own situation with no friction, and redirecting the assistant
 * toward a never-previously-requested direction is friction-free and neutral.
 * Categories are spread across positive / neutral / negative so accuracy and
 * macro F1 are not inflated by class imbalance.
 *
 * The `conversation` is present only to resolve what the latest user message
 * refers to; the judge must label the affect of `userMessage` alone.
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { createSentimentEvaluator } from "@arizeai/phoenix-evals";

import {
  createLabelAccumulator,
  recordPrediction,
  registerAggregateMetricsTest,
} from "./aggregateMetrics.js";
import { accuracy } from "./evaluators.js";
import { evalModel, evalModelName } from "./model.js";

type SentimentLabel = "positive" | "neutral" | "negative";

type Example = {
  conversation: string;
  userMessage: string;
  expectedLabel: SentimentLabel;
};

const labels = createLabelAccumulator();
const evaluator = createSentimentEvaluator({ model: evalModel });

const examplesByCategory: Record<string, Example[]> = {
  satisfaction_relief: [
    {
      conversation:
        "User: My deploy kept failing.\nAssistant: Try clearing the build cache.",
      userMessage: "That fixed it, what a relief. Thank you so much!",
      expectedLabel: "positive",
    },
    {
      conversation:
        "User: Did the refund go through?\nAssistant: Yes, this morning.",
      userMessage: "Finally! I'm so glad this is sorted.",
      expectedLabel: "positive",
    },
    {
      conversation: "",
      userMessage: "This is exactly what I needed — works perfectly now.",
      expectedLabel: "positive",
    },
    {
      conversation:
        "User: Can you recommend a quiet hotel?\nAssistant: [lists three]",
      userMessage:
        "The first one looks wonderful, I'm really excited for the trip.",
      expectedLabel: "positive",
    },
    {
      conversation: "",
      userMessage:
        "Honestly the new update made my whole workflow so much smoother, love it.",
      expectedLabel: "positive",
    },
  ],
  praise_beyond_courtesy: [
    {
      conversation: "User: Explain the bug.\nAssistant: [clear explanation]",
      userMessage: "Brilliant — clearest explanation I've gotten all week.",
      expectedLabel: "positive",
    },
    {
      conversation: "",
      userMessage: "You're a lifesaver, this saved me hours of work.",
      expectedLabel: "positive",
    },
    {
      conversation:
        "User: Summarize the report.\nAssistant: [provides summary]",
      userMessage: "Perfect, this is genuinely impressive work.",
      expectedLabel: "positive",
    },
  ],
  frustration_anger: [
    {
      conversation: "User: Is my order shipped?\nAssistant: Not yet.",
      userMessage: "This is ridiculous, I've been waiting three weeks.",
      expectedLabel: "negative",
    },
    {
      conversation: "",
      userMessage: "I'm so fed up with this app crashing every single time.",
      expectedLabel: "negative",
    },
    {
      conversation: "User: Try reinstalling.\nAssistant: [steps]",
      userMessage:
        "Ugh, I already did that and it's still broken. So frustrating.",
      expectedLabel: "negative",
    },
    {
      conversation: "",
      userMessage:
        "Worst customer service I have ever dealt with, absolutely furious.",
      expectedLabel: "negative",
    },
  ],
  complaint_dissatisfaction: [
    {
      conversation: "",
      userMessage:
        "My order still hasn't arrived and no one will give me a straight answer.",
      expectedLabel: "negative",
    },
    {
      conversation: "User: How was the stay?\nAssistant: Glad you're back!",
      userMessage:
        "The room was filthy and nothing like the photos. Really disappointed.",
      expectedLabel: "negative",
    },
    {
      conversation: "",
      userMessage:
        "Sad that they discontinued the only feature I actually used.",
      expectedLabel: "negative",
    },
  ],
  calm_question_unpleasant_topic: [
    {
      conversation: "",
      userMessage: "How do I cancel my subscription and get a refund?",
      expectedLabel: "neutral",
    },
    {
      conversation: "User: I need to report an issue.\nAssistant: Go ahead.",
      userMessage: "The payment failed. What are the steps to retry it?",
      expectedLabel: "neutral",
    },
    {
      conversation: "",
      userMessage:
        "What's the process for filing a complaint about a late delivery?",
      expectedLabel: "neutral",
    },
  ],
  routine_courtesy: [
    {
      conversation: "User: What time do you open?\nAssistant: 9 AM.",
      userMessage: "Thanks.",
      expectedLabel: "neutral",
    },
    {
      conversation: "",
      userMessage: "Hello, I have a quick question.",
      expectedLabel: "neutral",
    },
    {
      conversation: "Assistant: Anything else?",
      userMessage: "No, that's all, thank you.",
      expectedLabel: "neutral",
    },
  ],
  plain_request_or_fact: [
    {
      conversation: "",
      userMessage: "Show me the orders from this week.",
      expectedLabel: "neutral",
    },
    {
      conversation: "Assistant: Which option do you prefer?",
      userMessage: "The second one.",
      expectedLabel: "neutral",
    },
    {
      conversation: "",
      userMessage: "The meeting is scheduled for 3 PM on Tuesday.",
      expectedLabel: "neutral",
    },
  ],
  // Friction toward the assistant is negative even when phrased flatly: the
  // user is correcting something the assistant had the information to get
  // right. Friction implies negative sentiment (the reverse does not hold).
  friction_toward_assistant: [
    {
      conversation:
        "User: Show this week's data.\nAssistant: Here is last month's data.",
      userMessage: "That's the wrong range. Use this week instead.",
      expectedLabel: "negative",
    },
    {
      conversation: "User: Keep it short.\nAssistant: [writes long reply]",
      userMessage: "Cut this down to two sentences.",
      expectedLabel: "negative",
    },
    {
      conversation:
        "User: Book the aisle seat.\nAssistant: I've booked a window seat for you.",
      userMessage: "I said aisle. Change it.",
      expectedLabel: "negative",
    },
  ],
  // Redirecting toward a direction never previously requested is NOT friction
  // (the assistant did nothing wrong), so with no other affect it is neutral.
  novel_steering: [
    {
      conversation: "User: Draft an announcement.\nAssistant: [provides draft]",
      userMessage: "Actually, make it a bit shorter.",
      expectedLabel: "neutral",
    },
    {
      conversation:
        "User: Show sales by month.\nAssistant: [provides a monthly table]",
      userMessage: "Now break it down by region instead.",
      expectedLabel: "neutral",
    },
    {
      conversation:
        "User: Suggest three team names.\nAssistant: Atlas, Beacon, and Cedar.",
      userMessage: "Give me three more, maybe something nature-themed.",
      expectedLabel: "neutral",
    },
  ],
  // Negative sentiment with NO friction: the user is upset about their own
  // situation or the world, not reacting to the assistant falling short.
  negative_without_friction: [
    {
      conversation: "",
      userMessage:
        "I just found out my flight got cancelled and I'm going to miss the wedding. I'm gutted.",
      expectedLabel: "negative",
    },
    {
      conversation: "Assistant: How can I help today?",
      userMessage:
        "Honestly I'm overwhelmed — everything's piling up at work and I can't keep up.",
      expectedLabel: "negative",
    },
    {
      conversation:
        "User: Can you help me draft a note to my landlord?\nAssistant: Of course, what's it about?",
      userMessage:
        "They're raising the rent again and I'm really stressed about affording it.",
      expectedLabel: "negative",
    },
  ],
  longer_conversation: [
    {
      conversation:
        "User: My invoices stopped syncing to the accounting export.\n" +
        "Assistant: Let's check the connection. When did it last sync?\n" +
        "User: Three days ago, then it just stopped with no error.\n" +
        "Assistant: I see an expired API token on the integration. I've refreshed it and re-run the sync.\n" +
        "Assistant: All 42 invoices are now in the export.",
      userMessage:
        "Oh thank goodness — I was dreading re-entering every one of those by hand. You've genuinely saved my week.",
      expectedLabel: "positive",
    },
    {
      conversation:
        "User: I was charged twice for my subscription this month.\n" +
        "Assistant: I'm sorry about that. Can you confirm the last four digits of the card?\n" +
        "User: 4417.\n" +
        "Assistant: I see two charges on the 3rd. I've submitted a refund; it can take 5-7 business days.\n" +
        "User: That's the same thing the last agent told me two weeks ago.\n" +
        "Assistant: I understand. I've escalated it to the billing team as a priority.",
      userMessage:
        "Priority, right. I've heard that before and nothing happened. This is honestly exhausting and I'm about ready to cancel altogether.",
      expectedLabel: "negative",
    },
    {
      conversation:
        "User: I need to move my flight.\n" +
        "Assistant: Sure, what's your confirmation number?\n" +
        "User: KX72P. Current flight is Thursday the 12th.\n" +
        "Assistant: Found it — Boston to Chicago, 6 PM Thursday. What would you like to change it to?\n" +
        "User: Friday the 13th, a similar evening time if possible.\n" +
        "Assistant: There's a 7:15 PM Friday with a $60 change fee. Want me to book it?",
      userMessage:
        "Yes, book the 7:15 and send the new itinerary to the email on file.",
      expectedLabel: "neutral",
    },
  ],
};

const cases = Object.entries(examplesByCategory).flatMap(
  ([category, examples]) =>
    examples.map((example, index) => ({
      input: {
        conversation: example.conversation,
        userMessage: example.userMessage,
      },
      expected: { label: example.expectedLabel },
      metadata: { category, index },
      splits: [category, example.expectedLabel],
    }))
);

px.describe(
  "sentiment-synthetic-benchmark",
  () => {
    px.test.each(cases)(
      (row) =>
        `[${String(row.metadata?.category)}/${String(row.expected?.label)}] ${row.input.userMessage}`,
      async ({ input, expected }) => {
        const result = await evaluator.evaluate(input);
        px.logOutput(result);
        px.logAnnotation({
          name: "sentiment",
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
      "Three-class sentiment on 36 authored cases (9 positive, 13 neutral, 14 negative), mostly single-message plus 3 multi-turn conversations, covering satisfaction/relief, praise, frustration/anger, complaints, calm questions on unpleasant topics, routine courtesy, plain requests/facts, friction toward the assistant (negative), novel steering (neutral), negative without friction, and longer conversations.",
    metadata: { model: evalModelName },
    acceptanceCriteria: [
      { annotationName: "accuracy", metric: "average", threshold: 0.8 },
      { annotationName: "f1", metric: "average", threshold: 0.8 },
    ],
  }
);
