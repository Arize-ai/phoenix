import type { Experimental_EvaluationModel, LanguageModel } from "ai";

/**
 * An AI SDK evaluation model instance (e.g. TypeSafe's Jev). Unlike a
 * {@link LanguageModel}, evaluation models only answer typed questions and
 * cannot generate free-form text.
 */
export type EvaluationModel = Exclude<Experimental_EvaluationModel, string>;

/**
 * Type guard that distinguishes an AI SDK evaluation model from a language model.
 * Evaluation models expose `doEvaluate` instead of `doGenerate`.
 */
export function isEvaluationModel(
  model: LanguageModel | EvaluationModel
): model is EvaluationModel {
  return (
    typeof model === "object" &&
    model !== null &&
    "doEvaluate" in model &&
    typeof model.doEvaluate === "function"
  );
}
