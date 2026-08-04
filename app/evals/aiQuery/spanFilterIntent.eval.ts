import * as px from "@arizeai/phoenix-client/vitest";
import { describe, expect, it } from "vitest";

import { generateFilterCondition } from "@phoenix/components/filter/ai/generateFilterCondition";
import { spanFilterAIQueryDSL } from "@phoenix/pages/project/spanFilterDSL";

import {
  createGoogleEvalModel,
  GOOGLE_EVAL_MODELS,
  googleApiKey,
  JUDGE_MODEL_ID,
} from "./googleModels";
import { createFilterIntentJudge } from "./intentJudge";
import { spanFilterIntentCases } from "./spanFilterIntentCases";

// Registers AI SDK telemetry so every model call is traced (side effect).
import "./telemetry";

/**
 * Hill-climbing harness for the AI query prompt's semantic fidelity: does a
 * request about a phenomenon ("there is an apology in the response")
 * translate into a search that would actually find it ('sorry'/'apolog' in
 * output.value), or into a literal echo of the user's words ('apology' in
 * input.value)? There is no accepted-expression list — expansion has no
 * single right answer — so the gated signal is the intent judge's verdict,
 * with a code-side field check logged alongside for debugging.
 */

if (!googleApiKey) {
  describe("AI query span filter intent", () => {
    it.skip("needs GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) to run", () => {});
  });
}

/**
 * Initial bars, deliberately below the correctness suite's: the prompt has
 * no query-expansion guidance yet, and this suite exists to measure that
 * gap. Raise them as the prompt learns to capture intent.
 */
const INTENT_MIN_PASS_RATE: Record<string, number> = {
  "gemma-4-26b-a4b-it": 0.5,
  "gemini-3.1-flash-lite": 0.65,
  "gemini-3.5-flash-lite": 0.65,
};

const judge = createFilterIntentJudge({
  model: createGoogleEvalModel(JUDGE_MODEL_ID),
  dsl: spanFilterAIQueryDSL,
});

const rows = spanFilterIntentCases.map((evalCase) => ({
  id: evalCase.id,
  input: { query: evalCase.query },
  expected: {
    phenomenon: evalCase.phenomenon,
    expectedFields: evalCase.expectedFields,
    wrongFields: evalCase.wrongFields,
    surfaceForms: evalCase.surfaceForms,
  },
}));

for (const evalModel of googleApiKey ? GOOGLE_EVAL_MODELS : []) {
  px.describe(
    `AI query span filter intent · ${evalModel.modelId}`,
    () => {
      px.test.each(rows)(
        (row) => row.id ?? row.input.query,
        async ({ input, expected }) => {
          const { expression } = await generateFilterCondition({
            model: createGoogleEvalModel(evalModel.modelId),
            dsl: spanFilterAIQueryDSL,
            query: input.query,
          });
          px.logOutput({ expression });

          // Hard invariant: the prompt demands a bare single-line expression.
          expect(expression).not.toMatch(/[\n`]/);

          // Cheap deterministic read on the commonest failure — searching
          // the wrong side of the conversation. A heuristic (it checks the
          // canonical field spellings only), so it is logged for debugging
          // rather than gated.
          const expectedFields = expected?.expectedFields ?? [];
          const wrongFields = expected?.wrongFields ?? [];
          const targetsExpectedField =
            expectedFields.some((field) => expression.includes(field)) &&
            !wrongFields.some((field) => expression.includes(field));
          px.logAnnotation({
            name: "targets_expected_field",
            score: targetsExpectedField ? 1 : 0,
            annotatorKind: "CODE",
          });

          // The gated signal: the judge's verdict on whether the expression
          // would surface the phenomenon rather than echo the request.
          const verdict = await px.evaluate(judge, {
            query: input.query,
            expression,
            phenomenon: expected?.phenomenon ?? "",
            expectedFields: expectedFields.join(", "),
            surfaceForms: (expected?.surfaceForms ?? []).join(", "),
          });
          px.logAnnotation({
            name: "intent_captured",
            score: verdict?.score === 1 ? 1 : 0,
            annotatorKind: "CODE",
            explanation: verdict?.explanation ?? undefined,
          });
        }
      );
    },
    {
      datasetName: "ai-query-span-filter-intent",
      description:
        "Requests about phenomena (apologies, refusals, frustration) that must translate into searches for the text the phenomenon leaves in the data, not literal echoes of the request",
      metadata: {
        model: evalModel.modelId,
        simulates: evalModel.simulates,
        minPassRate: INTENT_MIN_PASS_RATE[evalModel.modelId],
      },
      acceptanceCriteria: [
        {
          annotationName: "intent_captured",
          metric: "passRate",
          passFn: (annotation) => annotation.score === 1,
          minPassRate: INTENT_MIN_PASS_RATE[evalModel.modelId] ?? 0.5,
        },
      ],
    }
  );
}
