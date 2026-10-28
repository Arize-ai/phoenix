import type { Experimental_DecisionModel, LanguageModel } from "ai";

/**
 * An AI SDK decision model instance, e.g. `openai.decisionModel("gpt-6-luna")`
 * or TypeSafe's Jev. Unlike a {@link LanguageModel}, a decision model only
 * answers typed questions (here, which label applies) and cannot generate
 * free-form text, so classifications made with it have no explanation.
 *
 * Gateway string IDs are excluded: a plain string is treated as a language
 * model. Wrap the ID with the provider's `decisionModel()` instead.
 */
export type DecisionModel = Exclude<Experimental_DecisionModel, string>;

/**
 * Type guard that distinguishes an AI SDK decision model from a language model.
 * Decision models expose `doDecide` (or `doEvaluate` for providers written
 * against the older evaluation model spec) instead of `doGenerate`.
 */
export function isDecisionModel(
  model: LanguageModel | DecisionModel
): model is DecisionModel {
  if (typeof model !== "object" || model === null) {
    return false;
  }
  return (
    ("doDecide" in model && typeof model.doDecide === "function") ||
    ("doEvaluate" in model && typeof model.doEvaluate === "function")
  );
}
