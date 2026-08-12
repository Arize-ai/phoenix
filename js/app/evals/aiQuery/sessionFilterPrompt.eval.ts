import * as px from "@arizeai/phoenix-client/vitest";
import { describe, expect, it } from "vitest";

import { generateFilterCondition } from "@phoenix/components/filter/ai/generateFilterCondition";
import { sessionFilterAIQueryDSL } from "@phoenix/pages/project/sessionFilterDSL";

import { createFilterEquivalenceJudge } from "./equivalenceJudge";
import {
  createGoogleEvalModel,
  GOOGLE_EVAL_MODELS,
  googleApiKey,
  JUDGE_MODEL_ID,
} from "./googleModels";
import { matchesAcceptedExpression } from "./normalizeFilterExpression";
import { sessionFilterCases } from "./sessionFilterCases";

import "./telemetry";

if (!googleApiKey) {
  describe("AI query session filter prompt", () => {
    it.skip("needs GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) to run", () => {});
  });
}

const judge = createFilterEquivalenceJudge({
  model: createGoogleEvalModel(JUDGE_MODEL_ID),
  dsl: sessionFilterAIQueryDSL,
});

const rows = sessionFilterCases.map((evalCase) => ({
  id: evalCase.id,
  input: { query: evalCase.query },
  expected: { expression: evalCase.accepted[0], accepted: evalCase.accepted },
}));

for (const evalModel of googleApiKey ? GOOGLE_EVAL_MODELS : []) {
  const generationModel = createGoogleEvalModel(evalModel.modelId);
  px.describe(
    `AI query session filter prompt · ${evalModel.modelId}`,
    () => {
      px.test.each(rows)(
        (row) => row.id ?? row.input.query,
        async ({ input, expected }) => {
          const { expression } = await generateFilterCondition({
            model: generationModel,
            dsl: sessionFilterAIQueryDSL,
            query: input.query,
          });
          px.logOutput({ expression });

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
      datasetName: "ai-query-session-filter-prompt",
      description:
        "Natural-language requests translated into the session filter DSL by the AI query prompt",
      metadata: {
        model: evalModel.modelId,
        simulates: evalModel.simulates,
        minPassRate: evalModel.sessionMinPassRate,
      },
      acceptanceCriteria: [
        {
          annotationName: "filter_correct",
          metric: "passRate",
          passFn: (annotation) => annotation.score === 1,
          minPassRate: evalModel.sessionMinPassRate,
        },
      ],
    }
  );
}
