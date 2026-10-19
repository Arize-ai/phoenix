import type { PromptTemplate } from "@arizeai/phoenix-evals";

import {
  DEFAULT_DATA_FORMAT,
  DEFAULT_PROMPT_TECHNIQUE,
} from "../cli/config.js";
import {
  applyDataFormat,
  type SweepRecord,
} from "../formats/applyDataFormat.js";
import { evalModel } from "../model.js";
import { resolvePromptTemplate } from "../prompts/index.js";

type BoundEvaluator<TResult> = {
  promptTemplate: PromptTemplate;
  evaluate: (record: SweepRecord) => Promise<TResult>;
};

/**
 * Bind a classification evaluator to the current sweep cell.
 *
 * Reads `EVAL_PROMPT_TECHNIQUE` and `EVAL_DATA_FORMAT` (overridable) so eval
 * files do not each reimplement format/prompt wiring. `evaluate` must be called
 * with the same field bag the library evaluator expects.
 */
export function bindSweepEvaluator<TResult>({
  evaluatorId,
  createEvaluator,
  promptTechnique = process.env.EVAL_PROMPT_TECHNIQUE ??
    DEFAULT_PROMPT_TECHNIQUE,
  dataFormat = process.env.EVAL_DATA_FORMAT ?? DEFAULT_DATA_FORMAT,
  model = evalModel,
}: {
  evaluatorId: string;
  createEvaluator: (args: {
    model: typeof evalModel;
    promptTemplate?: PromptTemplate;
  }) => BoundEvaluator<TResult>;
  promptTechnique?: string;
  dataFormat?: string;
  model?: typeof evalModel;
}): { evaluate: (record: SweepRecord) => Promise<TResult> } {
  const promptOverride = resolvePromptTemplate({
    evaluator: evaluatorId,
    promptTechnique,
  });
  const baseTemplate =
    promptOverride ?? createEvaluator({ model }).promptTemplate;
  const { promptTemplate } = applyDataFormat({
    promptTemplate: baseTemplate,
    record: {},
    dataFormat,
  });
  const evaluator = createEvaluator({ model, promptTemplate });
  return {
    evaluate: (record: SweepRecord) => {
      const formatted = applyDataFormat({
        promptTemplate: baseTemplate,
        record,
        dataFormat,
      });
      return evaluator.evaluate(formatted.record);
    },
  };
}
