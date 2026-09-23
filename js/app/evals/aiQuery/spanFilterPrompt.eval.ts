import * as px from "@arizeai/phoenix-client/vitest";
import { describe, expect, it } from "vitest";

import { generateFilterCondition } from "@phoenix/components/filter/ai/generateFilterCondition";
import { spanFilterAIQueryDSL } from "@phoenix/pages/project/spanFilterDSL";

import { createFilterEquivalenceJudge } from "./equivalenceJudge";
import {
  createGoogleEvalModel,
  GOOGLE_EVAL_MODELS,
  googleApiKey,
  JUDGE_MODEL_ID,
} from "./googleModels";
import { matchesAcceptedExpression } from "./normalizeFilterExpression";
import { spanFilterCases } from "./spanFilterCases";

// Registers AI SDK telemetry so every model call is traced (side effect).
import "./telemetry";

/**
 * Hill-climbing harness for the AI query prompt (`buildAIQueryPrompt`):
 * every model in the matrix translates the same natural-language requests
 * into the production span filter DSL, and each suite passes only when its
 * `filter_correct` rate clears the model's bar. Correctness is code-first —
 * a normalized match against the case's accepted expressions — with an LLM
 * judge deciding only the misses, so equivalent-but-differently-shaped
 * answers still count.
 */

if (!googleApiKey) {
  describe("AI query span filter prompt", () => {
    it.skip("needs GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) to run", () => {});
  });
}

const judge = createFilterEquivalenceJudge({
  model: createGoogleEvalModel(JUDGE_MODEL_ID),
  dsl: spanFilterAIQueryDSL,
});

const rows = spanFilterCases.map((evalCase) => ({
  id: evalCase.id,
  input: { query: evalCase.query },
  expected: { expression: evalCase.accepted[0], accepted: evalCase.accepted },
}));

for (const evalModel of googleApiKey ? GOOGLE_EVAL_MODELS : []) {
  // One client per suite rather than per row, like the hoisted judge
  const generationModel = createGoogleEvalModel(evalModel.modelId);
  px.describe(
    `AI query span filter prompt · ${evalModel.modelId}`,
    () => {
      px.test.each(rows)(
        (row) => row.id ?? row.input.query,
        async ({ input, expected }) => {
          const { expression } = await generateFilterCondition({
            model: generationModel,
            dsl: spanFilterAIQueryDSL,
            query: input.query,
          });
          px.logOutput({ expression });

          // Hard invariant: the prompt demands a bare single-line expression.
          expect(expression).not.toMatch(/[\n`]/);

          const accepted = expected?.accepted ?? [];
          const matched = matchesAcceptedExpression(expression, accepted);
          px.logAnnotation({
            name: "exact_match",
            score: matched ? 1 : 0,
            annotatorKind: "CODE",
          });

          let correct = matched;
          if (!matched) {
            const verdict = await px.evaluate(judge, {
              query: input.query,
              expression,
              references: accepted
                .map((reference) => `- ${reference}`)
                .join("\n"),
            });
            correct = verdict?.score === 1;
          }
          // The gated signal: exact match or judge-approved equivalent.
          px.logAnnotation({
            name: "filter_correct",
            score: correct ? 1 : 0,
            annotatorKind: "CODE",
            explanation: matched
              ? "normalized match against an accepted expression"
              : correct
                ? "accepted by the equivalence judge"
                : "rejected by the equivalence judge",
          });
        }
      );
    },
    {
      datasetName: "ai-query-span-filter-prompt",
      description:
        "Natural-language requests translated into the span filter DSL by the AI query prompt",
      metadata: {
        model: evalModel.modelId,
        simulates: evalModel.simulates,
        minPassRate: evalModel.minPassRate,
      },
      acceptanceCriteria: [
        {
          annotationName: "filter_correct",
          metric: "passRate",
          passFn: (annotation) => annotation.score === 1,
          minPassRate: evalModel.minPassRate,
        },
      ],
    }
  );
}
