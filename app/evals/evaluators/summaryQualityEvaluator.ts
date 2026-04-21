/**
 * summary-quality evaluator
 *
 * LLM-as-judge that grades whether the generated session summary accurately
 * captures the topic of the conversation. Uses
 * `@arizeai/phoenix-evals`'s {@link createClassificationEvaluator} with a
 * custom rubric tuned to the production prompt in
 * `app/src/components/agent/useGenerateSessionSummary.ts`.
 *
 * Labels:
 *   - accurate    — summary identifies the main topic of the exchange
 *   - partial     — summary touches the topic but is vague or omits the key noun
 *   - inaccurate  — summary is wrong, generic ("user asked a question"), or misleading
 */
import { anthropic } from "@ai-sdk/anthropic";
import { asExperimentEvaluator } from "@arizeai/phoenix-client/experiments";
import {
  createClassificationEvaluator,
  type ClassificationChoicesMap,
} from "@arizeai/phoenix-evals";
import type { LanguageModel } from "ai";

export type SummaryQualityLabel = "accurate" | "partial" | "inaccurate";

const SUMMARY_QUALITY_CHOICES: ClassificationChoicesMap = {
  accurate: 1,
  partial: 0.5,
  inaccurate: 0,
};

const SUMMARY_QUALITY_PROMPT = `You are grading a short (5-10 word) session summary written by an
assistant. The summary should describe the topic of the conversation
between a user and an assistant.

[Conversation]
User: {{userMessage}}
Assistant: {{assistantMessage}}

[Generated summary]
{{output}}

Grade the summary using one of the following labels:

- "accurate": The summary clearly identifies the main subject of the user's
  request. A reader who has not seen the conversation could glance at the
  summary and know what the conversation is about.
- "partial": The summary is on-topic but vague — it gestures at the area
  (e.g. "asking about Phoenix") without naming the specific subject.
- "inaccurate": The summary is wrong, contradicts the conversation, or is
  generic filler that conveys nothing (e.g. "user asked a question").

Return a structured result with the label and a brief explanation.`;

export interface SummaryQualityEvaluatorOptions {
  /**
   * Override the model used to grade summaries. Defaults to
   * Claude Haiku 4.5 to keep evaluation cheap.
   */
  model?: LanguageModel;
  /**
   * Override the evaluator name surfaced in Phoenix. Defaults to
   * "summary-quality".
   */
  name?: string;
}

/**
 * The shape of an evaluation record fed to the underlying classification
 * evaluator. The fields here must match the variables referenced in
 * {@link SUMMARY_QUALITY_PROMPT}.
 */
type SummaryQualityRecord = {
  userMessage: string;
  assistantMessage: string;
  output: string;
};

export function createSummaryQualityEvaluator(
  options: SummaryQualityEvaluatorOptions = {}
) {
  const model = options.model ?? anthropic("claude-haiku-4-5-20251001");
  const name = options.name ?? "summary-quality";

  const classifier = createClassificationEvaluator<SummaryQualityRecord>({
    name,
    model,
    promptTemplate: SUMMARY_QUALITY_PROMPT,
    choices: SUMMARY_QUALITY_CHOICES,
    optimizationDirection: "MAXIMIZE",
  });

  return asExperimentEvaluator({
    name,
    kind: "LLM",
    evaluate: async ({ input, output }) => {
      const { userMessage, assistantMessage } = input as {
        userMessage: string;
        assistantMessage: string;
      };
      return classifier.evaluate({
        userMessage,
        assistantMessage,
        output: typeof output === "string" ? output : "",
      });
    },
  });
}

export const summaryQualityEvaluator = createSummaryQualityEvaluator();
