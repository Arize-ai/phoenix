/**
 * Conciseness evaluator benchmark.
 *
 * Runs the conciseness evaluator against rubric boundary conditions and gates
 * the suite on how accurately the evaluator reproduces the expected labels.
 * Each example becomes a dataset example / experiment run on Phoenix.
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { createConcisenessEvaluator } from "@arizeai/phoenix-evals";

import {
  createLabelAccumulator,
  recordPrediction,
  registerAggregateMetricsTest,
} from "./aggregateMetrics.js";
import { accuracy } from "./evaluators.js";
import { evalModel, evalModelName } from "./model.js";

// Ground-truth vs predicted labels across cases, scored by the trailing
// aggregate-metrics test.
const labels = createLabelAccumulator();

const concisenessEvaluator = createConcisenessEvaluator({
  model: evalModel,
});

// Examples designed to test the boundary conditions of the conciseness rubric
const examplesByCategory = {
  // === PERFECTLY CONCISE ===
  // Direct, minimal answers that contain only the requested information
  perfectly_concise: [
    {
      input: "What is the capital of France?",
      output: "Paris.",
      expected_label: "concise" as const,
    },
    {
      input: "What year did World War II end?",
      output: "1945.",
      expected_label: "concise" as const,
    },
    {
      input: "What is the chemical symbol for gold?",
      output: "Au.",
      expected_label: "concise" as const,
    },
    {
      input: "How many continents are there?",
      output: "Seven.",
      expected_label: "concise" as const,
    },
    {
      input: "What is the square root of 144?",
      output: "12.",
      expected_label: "concise" as const,
    },
    {
      input: "Explain the three branches of the US government and their roles.",
      output:
        "Legislative (Congress) makes laws, Executive (President) enforces laws, and Judicial (Supreme Court) interprets laws.",
      expected_label: "concise" as const,
    },
  ],

  // === PLEASANTRIES AND FILLER ===
  // Responses with unnecessary greetings, affirmations, or filler phrases
  pleasantries_and_filler: [
    {
      input: "What is the capital of France?",
      output:
        "Great question! The capital of France is Paris. I hope that helps!",
      expected_label: "verbose" as const,
    },
    {
      input: "What is 2 + 2?",
      output:
        "Sure! I'd be happy to help with that. The answer to 2 + 2 is 4. Let me know if you have any other questions!",
      expected_label: "verbose" as const,
    },
    {
      input: "What color is the sky?",
      output:
        "That's a wonderful question! The sky is blue. Thanks for asking!",
      expected_label: "verbose" as const,
    },
    {
      input: "Who wrote Hamlet?",
      output:
        "Ah, great question! William Shakespeare wrote Hamlet. It's truly one of the greatest works of literature ever created!",
      expected_label: "verbose" as const,
    },
    {
      input: "What is the boiling point of water?",
      output:
        "Of course! I'm glad you asked. The boiling point of water is 100°C (212°F) at standard atmospheric pressure. Feel free to ask me anything else!",
      expected_label: "verbose" as const,
    },
  ],

  // === HEDGING AND QUALIFIERS ===
  // Responses with excessive hedging language and unnecessary qualifiers
  hedging_and_qualifiers: [
    {
      input: "What is the speed of light?",
      output:
        "It's worth noting that the speed of light in a vacuum is approximately 299,792 kilometers per second. It's important to understand that this is a fundamental constant in physics.",
      expected_label: "verbose" as const,
    },
    {
      input: "Is water wet?",
      output:
        "Well, this is actually a nuanced topic that depends on how you define 'wet.' Generally speaking, and it's important to consider this carefully, water itself can be considered to make other things wet, though some would argue that water itself isn't technically wet.",
      expected_label: "verbose" as const,
    },
    {
      input: "What language is spoken in Brazil?",
      output:
        "It's important to note that the official language of Brazil is Portuguese. It's also worth mentioning that this is actually different from most other South American countries.",
      expected_label: "verbose" as const,
    },
    {
      input: "How many legs does a spider have?",
      output:
        "It might be worth mentioning that, generally speaking, spiders typically have eight legs. Of course, it's important to keep in mind that this can vary in some rare cases due to injury or developmental issues.",
      expected_label: "verbose" as const,
    },
    {
      input: "What is the tallest mountain?",
      output:
        "It's worth pointing out that Mount Everest, standing at approximately 8,849 meters, is generally considered the tallest mountain in the world. However, it's important to note that this depends on how you measure - some would argue Mauna Kea is taller when measured from base to peak.",
      expected_label: "verbose" as const,
    },
  ],

  // === META-COMMENTARY ===
  // Responses that include self-referential commentary about the model or response
  meta_commentary: [
    {
      input: "What is pi?",
      output:
        "As an AI language model, I can tell you that pi (π) is approximately 3.14159. This is a mathematical constant representing the ratio of a circle's circumference to its diameter.",
      expected_label: "verbose" as const,
    },
    {
      input: "What is the largest ocean?",
      output:
        "Based on my training data, the Pacific Ocean is the largest ocean on Earth. I should note that my knowledge has a cutoff date, but this fact is unlikely to change.",
      expected_label: "verbose" as const,
    },
    {
      input: "What is photosynthesis?",
      output:
        "I'll do my best to explain this clearly. Photosynthesis is the process by which plants convert sunlight, water, and carbon dioxide into glucose and oxygen. I hope my explanation was clear and helpful.",
      expected_label: "verbose" as const,
    },
    {
      input: "How far is the Moon from Earth?",
      output:
        "That's a great topic to explore! The average distance from the Earth to the Moon is about 384,400 kilometers. I'm providing the average distance since the actual distance varies as the Moon's orbit is elliptical.",
      expected_label: "verbose" as const,
    },
  ],

  // === REDUNDANT RESTATEMENTS ===
  // Responses that repeat or restate the same information
  redundant_restatements: [
    {
      input: "What is the capital of Japan?",
      output:
        "The capital of Japan is Tokyo. Tokyo serves as Japan's capital city and is the seat of the Japanese government.",
      expected_label: "verbose" as const,
    },
    {
      input: "What is the freezing point of water?",
      output:
        "The freezing point of water is 0°C. In other words, water freezes at zero degrees Celsius, which is equivalent to 32°F. So to summarize, water turns to ice at 0°C.",
      expected_label: "verbose" as const,
    },
    {
      input: "Who invented the telephone?",
      output:
        "Alexander Graham Bell invented the telephone. Bell, who was the inventor of the telephone, patented his invention in 1876. In summary, the telephone was invented by Alexander Graham Bell.",
      expected_label: "verbose" as const,
    },
    {
      input: "What is the smallest planet in our solar system?",
      output:
        "Mercury is the smallest planet in our solar system. Being the smallest of all eight planets, Mercury is the most compact planet orbiting the Sun.",
      expected_label: "verbose" as const,
    },
  ],

  // === UNSOLICITED EXPLANATIONS ===
  // Responses that provide explanations or context beyond what was asked
  unsolicited_explanations: [
    {
      input: "What is the atomic number of carbon?",
      output:
        "The atomic number of carbon is 6. The atomic number represents the number of protons in an atom's nucleus, which determines the chemical properties of the element. Carbon is particularly important because it forms the basis of organic chemistry and is essential for all known life forms.",
      expected_label: "verbose" as const,
    },
    {
      input: "What year was the Eiffel Tower built?",
      output:
        "The Eiffel Tower was completed in 1889. It was originally built as the entrance arch for the 1889 World's Fair in Paris. Designed by Gustave Eiffel's engineering company, it was initially criticized by many prominent French intellectuals and artists but has since become a global cultural icon of France.",
      expected_label: "verbose" as const,
    },
    {
      input: "How many bytes are in a kilobyte?",
      output:
        "There are 1,024 bytes in a kilobyte. This is because computers use binary (base-2) number systems, so storage units are based on powers of 2. A kilobyte is 2^10 bytes. Note that in some contexts, particularly in storage marketing, 1 KB may refer to 1,000 bytes (decimal) rather than 1,024 bytes (binary).",
      expected_label: "verbose" as const,
    },
    {
      input: "What is the pH of pure water?",
      output:
        "The pH of pure water is 7. pH is a scale from 0 to 14 that measures how acidic or basic a substance is, with 7 being neutral. Values below 7 are acidic and values above 7 are basic. The pH scale is logarithmic, meaning each whole number change represents a tenfold change in acidity.",
      expected_label: "verbose" as const,
    },
    {
      input: "What's the currency of Japan?",
      output:
        "The currency of Japan is the Japanese yen (¥). The yen is the third most traded currency in the foreign exchange market after the US dollar and Euro. It was first introduced by the Meiji government in 1871 as a modernization of the monetary system.",
      expected_label: "verbose" as const,
    },
  ],

  // === EDGE CASES ===
  // Legitimately long answers to complex questions (should be concise),
  // and very short but still verbose answers
  edge_cases: [
    {
      // Complex question that warrants a detailed answer
      input:
        "Compare and contrast TCP and UDP protocols, including their use cases.",
      output:
        "TCP is connection-oriented, guarantees ordered delivery, and handles retransmission, making it suitable for web browsing, email, and file transfers. UDP is connectionless, offers no delivery guarantees, and has lower overhead, making it ideal for streaming, gaming, and DNS lookups. TCP prioritizes reliability; UDP prioritizes speed.",
      expected_label: "concise" as const,
    },
    {
      // Short but still verbose due to filler
      input: "Is Earth round?",
      output: "Great question! Yes, it is.",
      expected_label: "verbose" as const,
    },
    {
      // Multi-part question answered directly
      input: "What are the RGB values for white and black?",
      output: "White: (255, 255, 255). Black: (0, 0, 0).",
      expected_label: "concise" as const,
    },
    {
      // Technical question with appropriately detailed answer
      input: "What is the difference between a stack and a queue?",
      output:
        "A stack is LIFO (last in, first out) — elements are added and removed from the same end. A queue is FIFO (first in, first out) — elements are added at the back and removed from the front.",
      expected_label: "concise" as const,
    },
    {
      // Very short verbose response
      input: "What is 5 * 3?",
      output: "Sure thing! The answer is 15.",
      expected_label: "verbose" as const,
    },
  ],
};

type ConcisenessLabel = "concise" | "verbose";

// One dataset example / experiment run per rubric case. The Q&A pair under
// test is the task input; the rubric's expected verdict is the reference.
const cases = Object.entries(examplesByCategory).flatMap(
  ([category, categoryExamples]) =>
    categoryExamples.map((example) => ({
      input: { question: example.input, answer: example.output },
      expected: { label: example.expected_label as ConcisenessLabel },
      metadata: { category },
      splits: [category],
    }))
);

px.describe(
  "conciseness-rubric-boundary-test",
  () => {
    px.test.each(cases)(
      (row) =>
        `[${String(row.metadata?.category)}] ${String(row.input.question)}`,
      async ({ input, expected }) => {
        const result = await concisenessEvaluator.evaluate({
          input: input.question,
          output: input.answer,
        });
        // The evaluator-under-test's verdict is the run output.
        px.logOutput(result);
        px.logAnnotation({
          name: "conciseness",
          label: result.label,
          score: result.score,
          explanation: result.explanation,
          annotatorKind: "LLM",
        });
        // Score the verdict against the rubric's expected label.
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
      "Boundary conditions of the conciseness evaluator rubric across categories: perfectly concise, pleasantries/filler, hedging/qualifiers, meta-commentary, redundant restatements, unsolicited explanations, and edge cases.",
    metadata: { model: evalModelName },
    acceptanceCriteria: [
      { annotationName: "accuracy", metric: "average", threshold: 0.7 },
      { annotationName: "f1", metric: "average", threshold: 0.7 },
    ],
  }
);
