/** User-friction evaluator benchmark across positive signals and false-positive traps. */
import * as px from "@arizeai/phoenix-client/vitest";
import { createUserFrictionEvaluator } from "@arizeai/phoenix-evals";

import {
  createLabelAccumulator,
  recordPrediction,
  registerAggregateMetricsTest,
} from "./aggregateMetrics.js";
import { accuracy } from "./evaluators.js";
import { evalModel, evalModelName } from "./model.js";

const labels = createLabelAccumulator();
const evaluator = createUserFrictionEvaluator({ model: evalModel });

type UserFrictionLabel = "friction" | "no_friction";
type Example = {
  conversation: string;
  userMessage: string;
  expectedLabel: UserFrictionLabel;
};

const examplesByCategory: Record<string, Example[]> = {
  correction: [
    {
      conversation:
        "User: Show this week's orders.\nAssistant: Here are last month's orders.",
      userMessage: "No, I asked for this week.",
      expectedLabel: "friction",
    },
    {
      conversation:
        "User: Update the staging config.\nAssistant: I changed production.",
      userMessage: "That's the wrong environment—revert it.",
      expectedLabel: "friction",
    },
    {
      conversation:
        "User: Keep the introduction short.\nAssistant: [writes a long introduction]",
      userMessage: "This isn't what I asked for. Cut it to two sentences.",
      expectedLabel: "friction",
    },
    {
      conversation:
        "User: Analyze project Alpha.\nAssistant: Here's the analysis for project Beta.",
      userMessage: "You're looking at the wrong project.",
      expectedLabel: "friction",
    },
  ],
  retry: [
    {
      conversation:
        "User: Export the report.\nAssistant: The export failed with an error.",
      userMessage: "Please try exporting it again.",
      expectedLabel: "friction",
    },
    {
      conversation:
        "User: What is my current balance?\nAssistant: I couldn't retrieve it.",
      userMessage: "Can you check my balance again?",
      expectedLabel: "friction",
    },
    {
      conversation:
        "User: Summarize the attached file.\nAssistant: [empty response]",
      userMessage: "Could you summarize the file?",
      expectedLabel: "friction",
    },
    {
      conversation:
        "User: Book the 9 AM train.\nAssistant: The booking timed out.",
      userMessage: "Try the 9 AM train one more time.",
      expectedLabel: "friction",
    },
  ],
  frustration: [
    {
      conversation:
        "User: Stop the deployment.\nAssistant: The deployment is still running.",
      userMessage: "This is really frustrating. Stop it now.",
      expectedLabel: "friction",
    },
    {
      conversation:
        "User: Use metric units.\nAssistant: The distance is 12 miles.",
      userMessage: "Why do I have to keep repeating myself?",
      expectedLabel: "friction",
    },
    {
      conversation:
        "User: Fix the broken link.\nAssistant: I updated an unrelated page.",
      userMessage: "Ugh, you ignored the link again.",
      expectedLabel: "friction",
    },
    {
      conversation:
        "User: Don't send anything yet.\nAssistant: I sent the email.",
      userMessage: "Seriously? I explicitly said not to send it.",
      expectedLabel: "friction",
    },
  ],
  challenge: [
    {
      conversation:
        "User: Explain this invoice.\nAssistant: I'll delete the disputed charge now.",
      userMessage: "What are you doing? I didn't ask you to delete anything.",
      expectedLabel: "friction",
    },
    {
      conversation:
        "User: Draft a migration plan.\nAssistant: I'm applying the migration now.",
      userMessage: "Why are you changing the database?",
      expectedLabel: "friction",
    },
    {
      conversation:
        "User: Compare these plans.\nAssistant: I have cancelled your current plan.",
      userMessage: "Who told you to cancel it?",
      expectedLabel: "friction",
    },
    {
      conversation:
        "User: Tell me what this command does.\nAssistant: Running the command now.",
      userMessage: "Why did you execute it without asking?",
      expectedLabel: "friction",
    },
  ],
  answers_to_questions: [
    {
      conversation: "Assistant: Should I include archived records?",
      userMessage: "No.",
      expectedLabel: "no_friction",
    },
    {
      conversation: "Assistant: Which option do you prefer, first or second?",
      userMessage: "The second one.",
      expectedLabel: "no_friction",
    },
    {
      conversation: "Assistant: Would you like me to run the evaluation too?",
      userMessage: "Skip the evaluation part.",
      expectedLabel: "no_friction",
    },
    {
      conversation: "Assistant: What date range should I use?",
      userMessage: "Last seven days.",
      expectedLabel: "no_friction",
    },
  ],
  followup_refinement: [
    {
      conversation: "User: Draft an announcement.\nAssistant: [provides draft]",
      userMessage: "Great, make it a little shorter.",
      expectedLabel: "no_friction",
    },
    {
      conversation: "User: Show sales by region.\nAssistant: [provides table]",
      userMessage: "Now break Europe down by country.",
      expectedLabel: "no_friction",
    },
    {
      conversation:
        "User: Suggest three names.\nAssistant: Atlas, Beacon, and Cedar.",
      userMessage: "Give me three more in the style of Beacon.",
      expectedLabel: "no_friction",
    },
    {
      conversation: "User: Explain the error.\nAssistant: [explains cause]",
      userMessage: "Can you also show the relevant code?",
      expectedLabel: "no_friction",
    },
  ],
  new_task_or_topic: [
    {
      conversation:
        "User: Summarize the meeting.\nAssistant: [provides summary]",
      userMessage: "What's the weather tomorrow?",
      expectedLabel: "no_friction",
    },
    {
      conversation: "User: Fix the tests.\nAssistant: All tests now pass.",
      userMessage: "Create a release note next.",
      expectedLabel: "no_friction",
    },
    {
      conversation:
        "User: Find Italian restaurants.\nAssistant: [lists restaurants]",
      userMessage: "Book a dentist appointment for Friday.",
      expectedLabel: "no_friction",
    },
    {
      conversation:
        "User: Convert 20 USD to EUR.\nAssistant: [provides conversion]",
      userMessage: "Tell me a joke.",
      expectedLabel: "no_friction",
    },
  ],
  proposal_rejection: [
    {
      conversation: "Assistant: I can generate a PDF too, if you'd like.",
      userMessage: "No thanks.",
      expectedLabel: "no_friction",
    },
    {
      conversation: "Assistant: Should I notify the team?",
      userMessage: "Don't notify them.",
      expectedLabel: "no_friction",
    },
    {
      conversation:
        "Assistant: One option is to rewrite the module. Want me to?",
      userMessage: "Let's leave it as-is.",
      expectedLabel: "no_friction",
    },
    {
      conversation: "Assistant: I can add charts to the report.",
      userMessage: "Not necessary.",
      expectedLabel: "no_friction",
    },
  ],
  curiosity_and_verification: [
    {
      conversation: "User: Calculate the total.\nAssistant: The total is $42.",
      userMessage: "How did you calculate that?",
      expectedLabel: "no_friction",
    },
    {
      conversation:
        "User: Recommend a database.\nAssistant: PostgreSQL fits these requirements.",
      userMessage: "Why PostgreSQL instead of MySQL?",
      expectedLabel: "no_friction",
    },
    {
      conversation: "User: Show the error rate.\nAssistant: It is 2.1%.",
      userMessage: "Is that based on all requests?",
      expectedLabel: "no_friction",
    },
    {
      conversation:
        "User: Explain the policy.\nAssistant: [provides explanation]",
      userMessage: "Where is that rule documented?",
      expectedLabel: "no_friction",
    },
  ],
  ambiguous_or_first_turn: [
    {
      conversation: "",
      userMessage: "Show me recent activity.",
      expectedLabel: "no_friction",
    },
    {
      conversation:
        "User: Show recent activity.\nAssistant: [provides results]",
      userMessage: "Actually, show only today.",
      expectedLabel: "no_friction",
    },
    {
      conversation: "User: Write a formal note.\nAssistant: [provides note]",
      userMessage: "Maybe casual would be better.",
      expectedLabel: "no_friction",
    },
    {
      conversation: "User: List the options.\nAssistant: A, B, and C.",
      userMessage: "Fine. Let's use B.",
      expectedLabel: "no_friction",
    },
  ],
};

const cases = Object.entries(examplesByCategory).flatMap(
  ([category, examples]) =>
    examples.map((example) => ({
      input: {
        conversation: example.conversation,
        userMessage: example.userMessage,
      },
      expected: { label: example.expectedLabel },
      metadata: { category },
      splits: [category, example.expectedLabel],
    }))
);

px.describe(
  "user-friction-benchmark",
  () => {
    px.test.each(cases)(
      (row) => `[${String(row.metadata?.category)}] ${row.input.userMessage}`,
      async ({ input, expected }) => {
        const result = await evaluator.evaluate(input);
        px.logOutput(result);
        px.logAnnotation({
          name: "user_friction",
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
      "Expressed user friction across corrections, retries, frustration, challenges, cooperative answers, follow-ups, topic switches, proposal rejection, curiosity, and ambiguous cases.",
    metadata: { model: evalModelName },
    acceptanceCriteria: [
      { annotationName: "accuracy", metric: "average", threshold: 0.8 },
      { annotationName: "f1", metric: "average", threshold: 0.8 },
    ],
  }
);
