/**
 * summary-format evaluator
 *
 * Code-only check that the generated session summary obeys the production
 * formatting contract enforced by the `summary` output tool prompt in
 * `app/src/components/agent/useGenerateSessionSummary.ts`:
 *
 *   - 5-10 words
 *   - no surrounding quotes
 *   - no trailing sentence punctuation
 *
 * Decision order (first match wins):
 *   1. empty            — model returned nothing
 *   2. quoted           — wrapped in matching quotes
 *   3. trailing-punct   — ends with `.`, `!`, `?`, etc.
 *   4. wrong-length     — outside the 5-10 word window
 *   5. valid            — all checks pass
 */
import { asExperimentEvaluator } from "@arizeai/phoenix-client/experiments";

const TRAILING_PUNCTUATION_RE = /[.!?,;:]$/;

export type SummaryFormatLabel =
  | "empty"
  | "quoted"
  | "trailing-punct"
  | "wrong-length"
  | "valid";

export interface SummaryFormatEvaluatorOptions {
  name?: string;
  minWords?: number;
  maxWords?: number;
}

export function createSummaryFormatEvaluator(
  options: SummaryFormatEvaluatorOptions = {}
) {
  const minWords = options.minWords ?? 5;
  const maxWords = options.maxWords ?? 10;

  return asExperimentEvaluator({
    name: options.name ?? "summary-format",
    kind: "CODE",
    evaluate: ({ output }) => {
      const text = typeof output === "string" ? output.trim() : "";

      if (!text) {
        return {
          score: 0,
          label: "empty" satisfies SummaryFormatLabel,
          explanation: "summary was empty",
        };
      }

      const startsWithQuote = /^["'`]/.test(text);
      const endsWithQuote = /["'`]$/.test(text);
      if (startsWithQuote && endsWithQuote) {
        return {
          score: 0,
          label: "quoted" satisfies SummaryFormatLabel,
          explanation: `summary is wrapped in quotes: ${text}`,
        };
      }

      if (TRAILING_PUNCTUATION_RE.test(text)) {
        return {
          score: 0,
          label: "trailing-punct" satisfies SummaryFormatLabel,
          explanation: `summary ends with punctuation: "${text.slice(-1)}"`,
        };
      }

      const wordCount = text.split(/\s+/).filter(Boolean).length;
      if (wordCount < minWords || wordCount > maxWords) {
        return {
          score: 0,
          label: "wrong-length" satisfies SummaryFormatLabel,
          explanation: `summary has ${wordCount} words, expected ${minWords}-${maxWords}`,
        };
      }

      return {
        score: 1,
        label: "valid" satisfies SummaryFormatLabel,
        explanation: `${wordCount} words, no quotes, no trailing punctuation`,
      };
    },
  });
}

export const summaryFormatEvaluator = createSummaryFormatEvaluator();
